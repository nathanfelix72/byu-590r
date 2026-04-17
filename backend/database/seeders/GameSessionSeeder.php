<?php

namespace Database\Seeders;

use App\Models\GameSession;
use Carbon\Carbon;
use Illuminate\Database\Seeder;

class GameSessionSeeder extends Seeder
{
    /**
     * Run the database seeds.
     */
    public function run(): void
    {
        $sessions = [
            [
                'name' => 'Uno With Friends',
                'description' => 'Casual Uno game with friends after class.',
                'game_session_cover_picture' => 'images/uno_friends.jpg',
                'status' => 'in_progress',
                'current_turn' => 0,
                'started_at' => Carbon::now()->subHours(2),
            ],
            [
                'name' => 'Late Night Uno',
                'description' => 'High-stakes late night Uno marathon.',
                'game_session_cover_picture' => 'images/uno_late_night.jpg',
                'status' => 'waiting',
                'current_turn' => null,
            ],
            [
                'name' => 'Family Game Night',
                'description' => 'Family-friendly Uno session with everyone invited.',
                'game_session_cover_picture' => 'images/uno_family_night.jpg',
                'status' => 'in_progress',
                'current_turn' => 1,
                'started_at' => Carbon::now()->subDays(1),
            ],
            [
                'name' => 'Speed Uno',
                'description' => 'Fast-paced Uno with short turn timers.',
                'game_session_cover_picture' => 'images/uno_speed.jpg',
                'status' => 'finished',
                'current_turn' => null,
                'started_at' => Carbon::now()->subDays(3),
            ],
            [
                'name' => 'Tournament Bracket',
                'description' => 'Structured Uno tournament with bracket play.',
                'game_session_cover_picture' => 'images/uno_tournament.jpg',
                'status' => 'waiting',
                'current_turn' => null,
            ],
        ];

        foreach ($sessions as $session) {
            GameSession::updateOrCreate(
                [
                    'name' => $session['name'],
                    'description' => $session['description'],
                ],
                [
                    ...$session,
                    'created_at' => Carbon::now(),
                    'updated_at' => Carbon::now(),
                ]
            );
        }
    }
}

