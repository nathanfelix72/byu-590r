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
        $this->assertNull($state['pendingUnoUserId'] ?? null);
        $this->assertCount(3, $state['players']);
        foreach ($state['players'] as $p) {
            $this->assertCount(7, $p['hand']);
        }
    }

    public function test_initState_up_card_is_never_draw2_or_wild_draw4(): void
    {
        $engine = new UnoEngine();
        for ($i = 0; $i < 80; $i++) {
            $state = $engine->initState([1, 2]);
            $discard = $state['discard'] ?? [];
            $this->assertNotEmpty($discard);
            $top = $discard[count($discard) - 1];
            $this->assertNotSame('draw2', $top['value'] ?? null);
            $this->assertNotSame('wild_draw4', $top['value'] ?? null);
        }
    }

    public function test_wild_draw4_allowed_even_with_matching_color_in_hand(): void
    {
        $engine = new UnoEngine();

        $state = [
            'type' => 'uno',
            'rules' => [],
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

        $next = $engine->applyMove($state, 1, [
            'type' => 'play_card',
            'payload' => ['cardIndex' => 1, 'chosenColor' => 'g'],
        ]);

        $this->assertSame('g', $next['currentColor']);
        $this->assertSame(4, (int) $next['pendingDraw']);
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

    public function test_pending_uno_set_when_playing_down_to_one_card(): void
    {
        $engine = new UnoEngine();

        $state = [
            'type' => 'uno',
            'rules' => [],
            'players' => [
                [
                    'user_id' => 1,
                    'hand' => [
                        ['color' => 'r', 'value' => '3'],
                        ['color' => 'r', 'value' => '5'],
                    ],
                ],
                [
                    'user_id' => 2,
                    'hand' => [['color' => 'g', 'value' => '2']],
                ],
            ],
            'deck' => array_fill(0, 20, ['color' => 'y', 'value' => '1']),
            'discard' => [['color' => 'r', 'value' => '7']],
            'direction' => 1,
            'currentTurn' => 0,
            'currentColor' => 'r',
            'currentValue' => '7',
            'pendingDraw' => 0,
            'winnerUserId' => null,
            'moveHistory' => [],
        ];

        $next = $engine->applyMove($state, 1, [
            'type' => 'play_card',
            'payload' => ['cardIndex' => 0],
        ]);

        $this->assertSame(1, (int) $next['pendingUnoUserId']);
        $this->assertCount(1, $next['players'][0]['hand']);
    }

    public function test_uno_chat_penalty_when_opponent_says_uno_first(): void
    {
        $engine = new UnoEngine();

        $state = [
            'type' => 'uno',
            'rules' => [],
            'players' => [
                [
                    'user_id' => 1,
                    'hand' => [
                        ['color' => 'r', 'value' => '8'],
                    ],
                ],
                [
                    'user_id' => 2,
                    'hand' => [['color' => 'g', 'value' => '2']],
                ],
            ],
            'deck' => array_fill(0, 10, ['color' => 'y', 'value' => '1']),
            'discard' => [['color' => 'r', 'value' => '5']],
            'direction' => 1,
            'currentTurn' => 0,
            'currentColor' => 'r',
            'currentValue' => '5',
            'pendingDraw' => 0,
            'pendingUnoUserId' => 1,
            'winnerUserId' => null,
            'moveHistory' => [],
        ];

        $res = $engine->applyUnoChatResolution($state, 2, 'uno', true);

        $this->assertSame('penalty', $res['effect']);
        $this->assertSame(1, (int) $res['victimUserId']);
        $this->assertSame(2, (int) $res['catcherUserId']);
        $this->assertCount(3, $res['state']['players'][0]['hand']);
        $this->assertArrayNotHasKey('pendingUnoUserId', $res['state']);
    }

    public function test_body_looks_like_uno_call_accepts_common_variants(): void
    {
        $engine = new UnoEngine();
        $this->assertTrue($engine->bodyLooksLikeUnoCall('uno'));
        $this->assertTrue($engine->bodyLooksLikeUnoCall('Uno'));
        $this->assertTrue($engine->bodyLooksLikeUnoCall('  UNO  '));
        $this->assertTrue($engine->bodyLooksLikeUnoCall('uno!'));
        $this->assertFalse($engine->bodyLooksLikeUnoCall('I said uno'));
        $this->assertFalse($engine->bodyLooksLikeUnoCall(''));
    }

    public function test_uno_chat_cleared_when_victim_says_uno(): void
    {
        $engine = new UnoEngine();

        $state = [
            'type' => 'uno',
            'rules' => [],
            'players' => [
                [
                    'user_id' => 1,
                    'hand' => [
                        ['color' => 'r', 'value' => '8'],
                    ],
                ],
                [
                    'user_id' => 2,
                    'hand' => [['color' => 'g', 'value' => '2']],
                ],
            ],
            'deck' => [],
            'discard' => [['color' => 'r', 'value' => '5']],
            'direction' => 1,
            'currentTurn' => 0,
            'currentColor' => 'r',
            'currentValue' => '5',
            'pendingDraw' => 0,
            'pendingUnoUserId' => 1,
            'winnerUserId' => null,
            'moveHistory' => [],
        ];

        $res = $engine->applyUnoChatResolution($state, 1, 'uno');

        $this->assertSame('cleared', $res['effect']);
        $this->assertArrayNotHasKey('pendingUnoUserId', $res['state']);
    }

    public function test_uno_chat_penalty_skipped_when_chat_rule_inactive(): void
    {
        $engine = new UnoEngine();

        $state = [
            'type' => 'uno',
            'rules' => [],
            'players' => [
                [
                    'user_id' => 1,
                    'hand' => [
                        ['color' => 'r', 'value' => '8'],
                    ],
                ],
                [
                    'user_id' => 2,
                    'hand' => [['color' => 'g', 'value' => '2']],
                ],
            ],
            'deck' => array_fill(0, 10, ['color' => 'y', 'value' => '1']),
            'discard' => [['color' => 'r', 'value' => '5']],
            'direction' => 1,
            'currentTurn' => 0,
            'currentColor' => 'r',
            'currentValue' => '5',
            'pendingDraw' => 0,
            'pendingUnoUserId' => 1,
            'winnerUserId' => null,
            'moveHistory' => [],
        ];

        $res = $engine->applyUnoChatResolution($state, 2, 'uno', false);

        $this->assertSame('none', $res['effect']);
        $this->assertSame(1, (int) ($res['state']['pendingUnoUserId'] ?? 0));
        $this->assertCount(1, $res['state']['players'][0]['hand']);
    }

    public function test_pending_uno_not_set_when_chat_rule_inactive(): void
    {
        $engine = new UnoEngine();

        $state = [
            'type' => 'uno',
            'rules' => [],
            'players' => [
                [
                    'user_id' => 1,
                    'hand' => [
                        ['color' => 'r', 'value' => '3'],
                        ['color' => 'r', 'value' => '5'],
                    ],
                ],
                [
                    'user_id' => 2,
                    'hand' => [['color' => 'g', 'value' => '2']],
                ],
            ],
            'deck' => array_fill(0, 20, ['color' => 'y', 'value' => '1']),
            'discard' => [['color' => 'r', 'value' => '7']],
            'direction' => 1,
            'currentTurn' => 0,
            'currentColor' => 'r',
            'currentValue' => '7',
            'pendingDraw' => 0,
            'winnerUserId' => null,
            'moveHistory' => [],
        ];

        $next = $engine->applyMove($state, 1, [
            'type' => 'play_card',
            'payload' => ['cardIndex' => 0],
        ], false);

        $this->assertArrayNotHasKey('pendingUnoUserId', $next);
        $this->assertCount(1, $next['players'][0]['hand']);
    }
}

