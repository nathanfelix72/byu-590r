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

        // Start discard (optionally applying action effects based on rules)
        $discard = [];
        while (!empty($deck)) {
            $card = array_pop($deck);
            $discard[] = $card;
            if ($card['color'] !== 'w') {
                $currentColor = $card['color'];
                $currentValue = $card['value'];
                break;
            }
        }

        $top = end($discard);
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
            'winnerUserId' => null,
            'moveHistory' => [],
        ];

        if (($rules['startingCardActionsApply'] ?? false) === true) {
            $state = $this->applyStartingCardEffects($state);
        }

        return $state;
    }

    public function applyMove(array $state, int $userId, array $move): array
    {
        if (($state['winnerUserId'] ?? null) !== null) {
            throw new \RuntimeException('Game already finished.');
        }

        $players = $state['players'] ?? [];
        $currentIndex = (int) ($state['currentTurn'] ?? 0);
        $currentPlayer = $players[$currentIndex] ?? null;
        if (!$currentPlayer || (int) $currentPlayer['user_id'] !== $userId) {
            throw new \RuntimeException('Not your turn.');
        }

        $type = Arr::get($move, 'type');
        $payload = Arr::get($move, 'payload', []);

        $rules = array_merge($this->defaultRules(), (array) ($state['rules'] ?? []));

        if (($state['pendingDraw'] ?? 0) > 0) {
            $allowStacking = (bool) ($rules['allowStackingDraw2'] ?? false) || (bool) ($rules['allowStackingDraw4'] ?? false);
            if ($type !== 'draw' && !$allowStacking) {
                throw new \RuntimeException('You must draw the pending cards.');
            }
        }

        return match ($type) {
            'play_card' => $this->playCard($state, $userId, $payload),
            'draw' => $this->drawCard($state, $userId),
            default => throw new \RuntimeException('Unknown move type.'),
        };
    }

    private function playCard(array $state, int $userId, array $payload): array
    {
        $idx = (int) Arr::get($payload, 'cardIndex', -1);
        $chosenColor = Arr::get($payload, 'chosenColor'); // for wild
        $rules = array_merge($this->defaultRules(), (array) ($state['rules'] ?? []));

        [$playerIndex, $player] = $this->findPlayer($state, $userId);
        $hand = $player['hand'] ?? [];
        if ($idx < 0 || $idx >= count($hand)) {
            throw new \RuntimeException('Invalid card selection.');
        }

        $card = $hand[$idx];
        if (!$this->isPlayable($state, $card)) {
            throw new \RuntimeException('Card is not playable.');
        }

        // Classic rule: Wild Draw 4 only legal if you have no card matching current color.
        if (($rules['allowWildDraw4OnlyIfNoMatch'] ?? false) === true && ($card['value'] ?? null) === 'wild_draw4') {
            $hasColorMatch = false;
            foreach ($hand as $h) {
                if (($h['color'] ?? null) !== 'w' && ($h['color'] ?? null) === ($state['currentColor'] ?? null)) {
                    $hasColorMatch = true;
                    break;
                }
            }
            if ($hasColorMatch) {
                throw new \RuntimeException('Wild Draw 4 is only allowed when you have no matching color.');
            }
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
            $state['pendingDraw'] = ((int) ($state['pendingDraw'] ?? 0)) + 2;
            $skipNext = true;
        } elseif ($card['value'] === 'wild_draw4') {
            $state['pendingDraw'] = ((int) ($state['pendingDraw'] ?? 0)) + 4;
            $skipNext = true;
        }

        $state['moveHistory'][] = [
            'type' => 'play_card',
            'user_id' => $userId,
            'card' => $card,
            'chosenColor' => $chosenColor ?? null,
            'ts' => now()->toISOString(),
        ];

        // Win condition
        if (count($state['players'][$playerIndex]['hand']) === 0) {
            $state['winnerUserId'] = $userId;
            return $state;
        }

        $state = $this->advanceTurn($state, $skipNext);
        return $state;
    }

    private function drawCard(array $state, int $userId): array
    {
        [$playerIndex, $player] = $this->findPlayer($state, $userId);

        $rules = array_merge($this->defaultRules(), (array) ($state['rules'] ?? []));
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
            'allowWildDraw4OnlyIfNoMatch' => true,
            'startingCardActionsApply' => true,
            'unoCallRequired' => false,
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
            $state = $this->advanceTurn($state, true);
        } elseif ($value === 'draw2') {
            $state['pendingDraw'] = 2;
            $state = $this->advanceTurn($state, true);
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
        if (!$color || !$value) return false;
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

