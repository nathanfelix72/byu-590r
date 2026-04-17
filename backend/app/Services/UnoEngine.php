<?php

namespace App\Services;

use Illuminate\Support\Arr;

class UnoEngine
{
    public const COLORS = ['r', 'g', 'b', 'y'];

    public function initState(array $userIds, array $rules = []): array
    {
        $deck = $this->buildDeck();
        $this->shuffle($deck);

        $players = array_map(fn ($id) => [
            'user_id' => (int) $id,
            'hand' => [],
        ], $userIds);

        // Deal 7 cards each
        for ($i = 0; $i < 7; $i++) {
            foreach ($players as &$p) {
                $p['hand'][] = array_pop($deck);
            }
        }

        $rules = array_merge($this->defaultRules(), $rules);

        // Start discard: first "real" up-card cannot be +2 / +4 (draw2 / wild_draw4).
        // Wild draw4 is skipped while searching; colored draw2 is put back under the deck.
        $discard = [];
        $currentColor = null;
        $currentValue = null;
        $safety = 0;
        while (!empty($deck) && $safety < 500) {
            $safety++;
            $card = array_pop($deck);
            $color = $card['color'] ?? '';
            $value = $card['value'] ?? '';

            if ($color === 'w') {
                if ($value === 'wild_draw4') {
                    array_unshift($deck, $card);

                    continue;
                }
                $discard[] = $card;

                continue;
            }

            if ($value === 'draw2') {
                array_unshift($deck, $card);

                continue;
            }

            $discard[] = $card;
            $currentColor = $color;
            $currentValue = $value;
            break;
        }

        $top = end($discard);
        if ($top === false) {
            throw new \RuntimeException('Could not start discard pile.');
        }
        $currentColor = $currentColor ?? ($top['color'] === 'w' ? 'r' : $top['color']);
        $currentValue = $currentValue ?? $top['value'];

        $state = [
            'type' => 'uno',
            'version' => 1,
            'rules' => $rules,
            'players' => $players,
            'deck' => array_values($deck),
            'discard' => array_values($discard),
            'direction' => 1,
            'currentTurn' => 0,
            'currentColor' => $currentColor,
            'currentValue' => $currentValue,
            'pendingDraw' => 0,
            'pendingUnoUserId' => null,
            'winnerUserId' => null,
            'moveHistory' => [],
        ];

        if (($rules['startingCardActionsApply'] ?? false) === true) {
            $state = $this->applyStartingCardEffects($state);
        }

        return $state;
    }

    public function applyMove(array $state, int $userId, array $move, bool $unoChatRuleActive = true): array
    {
        if (($state['winnerUserId'] ?? null) !== null) {
            throw new \RuntimeException('Game already finished.');
        }

        if (!$unoChatRuleActive) {
            unset($state['pendingUnoUserId']);
        }

        $players = $state['players'] ?? [];
        $currentIndex = (int) ($state['currentTurn'] ?? 0);
        $currentPlayer = $players[$currentIndex] ?? null;
        if (!$currentPlayer || (int) $currentPlayer['user_id'] !== $userId) {
            throw new \RuntimeException('Not your turn.');
        }

        $type = Arr::get($move, 'type');
        $payload = Arr::get($move, 'payload', []);

        $rules = $this->mergedRules($state);

        if (($state['pendingDraw'] ?? 0) > 0) {
            $allowStacking = (bool) ($rules['allowStackingDraw2'] ?? false) || (bool) ($rules['allowStackingDraw4'] ?? false);
            if ($type !== 'draw' && !$allowStacking) {
                throw new \RuntimeException('You must draw the pending cards.');
            }
        }

        return match ($type) {
            'play_card' => $this->playCard($state, $userId, $payload, $unoChatRuleActive),
            'draw' => $this->drawCard($state, $userId, $unoChatRuleActive),
            default => throw new \RuntimeException('Unknown move type.'),
        };
    }

    private function playCard(array $state, int $userId, array $payload, bool $unoChatRuleActive = true): array
    {
        $idx = (int) Arr::get($payload, 'cardIndex', -1);
        $chosenColor = Arr::get($payload, 'chosenColor'); // for wild
        $rules = $this->mergedRules($state);

        [$playerIndex, $player] = $this->findPlayer($state, $userId);
        $hand = $player['hand'] ?? [];
        if ($idx < 0 || $idx >= count($hand)) {
            throw new \RuntimeException('Invalid card selection.');
        }

        $card = $hand[$idx];
        if (!$this->isPlayable($state, $card)) {
            throw new \RuntimeException('Card is not playable.');
        }

        // Remove from hand, push to discard
        array_splice($hand, $idx, 1);
        $state['players'][$playerIndex]['hand'] = array_values($hand);
        $state['discard'][] = $card;

        // Update current color/value
        if ($card['color'] === 'w') {
            if (!in_array($chosenColor, self::COLORS, true)) {
                throw new \RuntimeException('Wild requires chosenColor.');
            }
            $state['currentColor'] = $chosenColor;
        } else {
            $state['currentColor'] = $card['color'];
        }
        $state['currentValue'] = $card['value'];

        // Apply effects
        $skipNext = false;
        if ($card['value'] === 'reverse') {
            $state['direction'] = ((int) ($state['direction'] ?? 1)) * -1;
        } elseif ($card['value'] === 'skip') {
            $skipNext = true;
        } elseif ($card['value'] === 'draw2') {
            // Next player must draw (pendingDraw) and then loses their turn after drawing.
            // Do NOT skip-turn here: skipNext would advance past the victim so they never
            // become currentTurn with the pending penalty (breaks 2-player and multi-player).
            $state['pendingDraw'] = ((int) ($state['pendingDraw'] ?? 0)) + 2;
        } elseif ($card['value'] === 'wild_draw4') {
            $state['pendingDraw'] = ((int) ($state['pendingDraw'] ?? 0)) + 4;
        }

        $state['moveHistory'][] = [
            'type' => 'play_card',
            'user_id' => $userId,
            'card' => $card,
            'chosenColor' => $chosenColor ?? null,
            'ts' => now()->toISOString(),
        ];

        $this->syncPendingUnoAfterHandChange($state, $rules, $userId, $playerIndex, $unoChatRuleActive);

        // Win condition
        if (count($state['players'][$playerIndex]['hand']) === 0) {
            $state['winnerUserId'] = $userId;
            unset($state['pendingUnoUserId']);

            return $state;
        }

        $state = $this->advanceTurn($state, $skipNext);

        return $state;
    }

    /**
     * After playing to exactly one card, that player must type "uno" in chat before opponents catch them.
     */
    private function syncPendingUnoAfterHandChange(array &$state, array $rules, int $userId, int $playerIndex, bool $unoChatRuleActive = true): void
    {
        if (!(bool) ($rules['unoCallRequired'] ?? false)) {
            return;
        }
        if (!$unoChatRuleActive) {
            unset($state['pendingUnoUserId']);

            return;
        }
        $newCount = count($state['players'][$playerIndex]['hand'] ?? []);
        if ($newCount === 1) {
            $state['pendingUnoUserId'] = $userId;
        } elseif ($newCount === 0) {
            unset($state['pendingUnoUserId']);
        } elseif ((int) ($state['pendingUnoUserId'] ?? 0) === $userId) {
            unset($state['pendingUnoUserId']);
        }
    }

    public function mergedRules(array $state): array
    {
        $merged = array_merge($this->defaultRules(), (array) ($state['rules'] ?? []));
        // Stale session.rules in DB could disable UNO chat; keep house rule on for Uno games.
        if (($state['type'] ?? '') === 'uno') {
            $merged['unoCallRequired'] = (bool) ($this->defaultRules()['unoCallRequired'] ?? true);
        }

        return $merged;
    }

    /**
     * Whole message is "uno" (any casing), optional trailing punctuation / whitespace.
     */
    public function bodyLooksLikeUnoCall(string $body): bool
    {
        $t = trim($body);
        if ($t === '') {
            return false;
        }

        return (bool) preg_match('/^uno[!?.;,\s]*$/i', $t);
    }

    /**
     * @return array{state: array, effect: string, victimUserId: ?int, catcherUserId: ?int}
     */
    public function applyUnoChatResolution(array $state, int $senderId, string $body, bool $unoChatRuleActive = true): array
    {
        $out = [
            'state' => $state,
            'effect' => 'none',
            'victimUserId' => null,
            'catcherUserId' => null,
        ];
        $rules = $this->mergedRules($state);
        if (!$unoChatRuleActive) {
            return $out;
        }
        if (!(bool) ($rules['unoCallRequired'] ?? false)) {
            return $out;
        }
        if (!$this->bodyLooksLikeUnoCall($body)) {
            return $out;
        }
        $pending = (int) ($state['pendingUnoUserId'] ?? 0);
        if ($pending <= 0) {
            return $out;
        }

        try {
            [$victimIndex, $victimPlayer] = $this->findPlayer($state, $pending);
        } catch (\RuntimeException) {
            unset($state['pendingUnoUserId']);
            $out['state'] = $state;
            $out['effect'] = 'stale_pending_cleared';

            return $out;
        }

        if (count($victimPlayer['hand'] ?? []) !== 1) {
            unset($state['pendingUnoUserId']);
            $out['state'] = $state;
            $out['effect'] = 'stale_pending_cleared';

            return $out;
        }

        if ($senderId === $pending) {
            unset($state['pendingUnoUserId']);
            $out['state'] = $state;
            $out['effect'] = 'cleared';

            return $out;
        }

        $penalty = max(1, (int) ($rules['unoPenaltyCards'] ?? 2));
        $state = $this->drawNCardsForPlayer($state, $pending, $penalty);
        unset($state['pendingUnoUserId']);
        $out['state'] = $state;
        $out['effect'] = 'penalty';
        $out['victimUserId'] = $pending;
        $out['catcherUserId'] = $senderId;

        return $out;
    }

    private function drawNCardsForPlayer(array $state, int $userId, int $n): array
    {
        [$playerIndex, $player] = $this->findPlayer($state, $userId);
        for ($i = 0; $i < $n; $i++) {
            $state = $this->ensureDeck($state);
            $card = array_pop($state['deck']);
            $state['players'][$playerIndex]['hand'][] = $card;
        }
        $state['players'][$playerIndex]['hand'] = array_values($state['players'][$playerIndex]['hand']);
        $state['moveHistory'][] = [
            'type' => 'uno_penalty',
            'user_id' => $userId,
            'drawn' => $n,
            'ts' => now()->toISOString(),
        ];

        return $state;
    }

    private function drawCard(array $state, int $userId, bool $unoChatRuleActive = true): array
    {
        [$playerIndex, $player] = $this->findPlayer($state, $userId);

        $rules = $this->mergedRules($state);
        $drawCount = (int) ($state['pendingDraw'] ?? 0);
        if ($drawCount <= 0) $drawCount = 1;

        // drawToMatch: draw until playable (cap to prevent infinite loops), otherwise draw fixed count
        if (($rules['drawToMatch'] ?? false) === true && ($state['pendingDraw'] ?? 0) === 0) {
            $cap = 20;
            $drawn = 0;
            while ($drawn < $cap) {
                $state = $this->ensureDeck($state);
                $card = array_pop($state['deck']);
                $state['players'][$playerIndex]['hand'][] = $card;
                $drawn++;
                if ($this->isPlayable($state, $card)) {
                    break;
                }
            }
            $drawCount = $drawn;
        } else {
            for ($i = 0; $i < $drawCount; $i++) {
                $state = $this->ensureDeck($state);
                $card = array_pop($state['deck']);
                $state['players'][$playerIndex]['hand'][] = $card;
            }
        }

        $state['moveHistory'][] = [
            'type' => 'draw',
            'user_id' => $userId,
            'count' => $drawCount,
            'ts' => now()->toISOString(),
        ];

        $state['pendingDraw'] = 0;

        if ($unoChatRuleActive && (bool) ($rules['unoCallRequired'] ?? false)) {
            $hc = count($state['players'][$playerIndex]['hand'] ?? []);
            if ($hc !== 1 && (int) ($state['pendingUnoUserId'] ?? 0) === $userId) {
                unset($state['pendingUnoUserId']);
            }
        }

        // MVP rule: drawing ends your turn.
        $state = $this->advanceTurn($state, false);
        return $state;
    }

    private function defaultRules(): array
    {
        return [
            'allowStackingDraw2' => false,
            'allowStackingDraw4' => false,
            'drawToMatch' => false,
            'forcePlayIfPossible' => false,
            'allowWildDraw4OnlyIfNoMatch' => false, // unused; Wild Draw 4 is always allowed
            'startingCardActionsApply' => true,
            'unoCallRequired' => true,
            'unoPenaltyCards' => 2,
        ];
    }

    private function applyStartingCardEffects(array $state): array
    {
        $discard = $state['discard'] ?? [];
        if (!is_array($discard) || count($discard) === 0) return $state;
        $top = $discard[count($discard) - 1];
        $value = $top['value'] ?? null;
        if ($value === 'reverse') {
            $state['direction'] = -1;
        } elseif ($value === 'skip') {
            // First player (currentTurn) is skipped; next player in order takes the turn.
            $state = $this->advanceTurn($state, false);
        } elseif ($value === 'draw2') {
            // Opening Draw Two: first player must draw 2 before playing.
            $state['pendingDraw'] = 2;
        }
        return $state;
    }

    private function advanceTurn(array $state, bool $skipNext): array
    {
        $playersCount = count($state['players'] ?? []);
        if ($playersCount <= 0) {
            return $state;
        }

        $dir = (int) ($state['direction'] ?? 1);
        $turn = (int) ($state['currentTurn'] ?? 0);

        $turn = $this->wrapIndex($turn + $dir, $playersCount);
        if ($skipNext) {
            $turn = $this->wrapIndex($turn + $dir, $playersCount);
        }

        $state['currentTurn'] = $turn;
        return $state;
    }

    private function isPlayable(array $state, array $card): bool
    {
        $color = $card['color'] ?? null;
        $value = $card['value'] ?? null;
        // Do not use empty()/!$value: UNO card "0" is the string '0', which is falsy in PHP.
        if ($color === null || $color === '' || !array_key_exists('value', $card)) {
            return false;
        }
        if ($value === null || $value === '') {
            return false;
        }
        if ($color === 'w') return true;
        if (($state['currentColor'] ?? null) === $color) return true;
        if (($state['currentValue'] ?? null) === $value) return true;
        return false;
    }

    private function ensureDeck(array $state): array
    {
        if (!empty($state['deck'])) return $state;
        // Refill deck from discard (keep top card)
        $discard = $state['discard'] ?? [];
        if (count($discard) <= 1) {
            throw new \RuntimeException('No cards left to draw.');
        }

        $top = array_pop($discard);
        $deck = $discard;
        $this->shuffle($deck);
        $state['deck'] = array_values($deck);
        $state['discard'] = [$top];
        return $state;
    }

    private function buildDeck(): array
    {
        $deck = [];
        foreach (self::COLORS as $c) {
            // One 0
            $deck[] = ['color' => $c, 'value' => '0'];
            // Two of 1-9
            for ($n = 1; $n <= 9; $n++) {
                $deck[] = ['color' => $c, 'value' => (string) $n];
                $deck[] = ['color' => $c, 'value' => (string) $n];
            }
            // Two each action cards
            foreach (['skip', 'reverse', 'draw2'] as $v) {
                $deck[] = ['color' => $c, 'value' => $v];
                $deck[] = ['color' => $c, 'value' => $v];
            }
        }
        // Wilds
        for ($i = 0; $i < 4; $i++) {
            $deck[] = ['color' => 'w', 'value' => 'wild'];
            $deck[] = ['color' => 'w', 'value' => 'wild_draw4'];
        }
        return $deck;
    }

    private function shuffle(array &$arr): void
    {
        shuffle($arr);
    }

    private function wrapIndex(int $idx, int $count): int
    {
        $r = $idx % $count;
        return $r < 0 ? $r + $count : $r;
    }

    private function findPlayer(array $state, int $userId): array
    {
        foreach (($state['players'] ?? []) as $i => $p) {
            if ((int) ($p['user_id'] ?? 0) === $userId) {
                return [$i, $p];
            }
        }
        throw new \RuntimeException('Player not found in this game.');
    }
}

