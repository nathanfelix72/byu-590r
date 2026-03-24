<?php

namespace Tests\Unit;

use App\Services\UnoEngine;
use PHPUnit\Framework\TestCase;

class UnoEngineTest extends TestCase
{
    public function test_initState_deals_seven_cards_each(): void
    {
        $engine = new UnoEngine();
        $state = $engine->initState([1, 2, 3]);

        $this->assertSame('uno', $state['type']);
        $this->assertCount(3, $state['players']);
        foreach ($state['players'] as $p) {
            $this->assertCount(7, $p['hand']);
        }
    }

    public function test_wild_draw4_illegal_when_color_match_exists_if_rule_enabled(): void
    {
        $engine = new UnoEngine();

        $state = [
            'type' => 'uno',
            'rules' => [
                'allowWildDraw4OnlyIfNoMatch' => true,
            ],
            'players' => [
                [
                    'user_id' => 1,
                    'hand' => [
                        ['color' => 'r', 'value' => '3'],
                        ['color' => 'w', 'value' => 'wild_draw4'],
                    ],
                ],
                [
                    'user_id' => 2,
                    'hand' => [],
                ],
            ],
            'deck' => [],
            'discard' => [['color' => 'r', 'value' => '5']],
            'direction' => 1,
            'currentTurn' => 0,
            'currentColor' => 'r',
            'currentValue' => '5',
            'pendingDraw' => 0,
            'winnerUserId' => null,
            'moveHistory' => [],
        ];

        $this->expectExceptionMessage('Wild Draw 4 is only allowed');
        $engine->applyMove($state, 1, [
            'type' => 'play_card',
            'payload' => ['cardIndex' => 1, 'chosenColor' => 'g'],
        ]);
    }

    public function test_draw2_advances_to_victim_with_pending_draw_not_past_them(): void
    {
        $engine = new UnoEngine();

        $rules = $engine->initState([10, 20])['rules'];

        $state = [
            'type' => 'uno',
            'rules' => $rules,
            'players' => [
                [
                    'user_id' => 10,
                    'hand' => [
                        ['color' => 'r', 'value' => 'draw2'],
                        ['color' => 'y', 'value' => '7'],
                    ],
                ],
                [
                    'user_id' => 20,
                    'hand' => [['color' => 'g', 'value' => '3']],
                ],
            ],
            'deck' => array_fill(0, 10, ['color' => 'y', 'value' => '1']),
            'discard' => [['color' => 'r', 'value' => '5']],
            'direction' => 1,
            'currentTurn' => 0,
            'currentColor' => 'r',
            'currentValue' => '5',
            'pendingDraw' => 0,
            'winnerUserId' => null,
            'moveHistory' => [],
        ];

        $next = $engine->applyMove($state, 10, [
            'type' => 'play_card',
            'payload' => ['cardIndex' => 0],
        ]);

        $this->assertSame(1, (int) $next['currentTurn']);
        $this->assertSame(20, (int) $next['players'][1]['user_id']);
        $this->assertSame(2, (int) $next['pendingDraw']);

        $this->expectExceptionMessage('You must draw the pending cards.');
        $engine->applyMove($next, 20, [
            'type' => 'play_card',
            'payload' => ['cardIndex' => 0],
        ]);
    }

    public function test_is_playable_treats_string_zero_as_valid_value(): void
    {
        $engine = new UnoEngine();
        $m = new \ReflectionMethod(UnoEngine::class, 'isPlayable');
        $m->setAccessible(true);
        $state = ['currentColor' => 'b', 'currentValue' => '3'];
        // Same color: string "0" must count as a real card value (not treated as empty).
        $this->assertTrue($m->invoke($engine, $state, ['color' => 'b', 'value' => '0']));
        $this->assertFalse($m->invoke($engine, $state, ['color' => 'g', 'value' => '0']));
        $stateZeroTop = ['currentColor' => 'b', 'currentValue' => '0'];
        $this->assertTrue($m->invoke($engine, $stateZeroTop, ['color' => 'g', 'value' => '0']));
    }
}

