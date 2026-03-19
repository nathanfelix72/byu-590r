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
}

