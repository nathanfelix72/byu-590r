<?php

namespace Database\Seeders;

use App\Models\Game;
use Illuminate\Database\Seeder;

class GameSeeder extends Seeder
{
    public function run(): void
    {
        Game::updateOrCreate(
            ['key' => 'uno'],
            [
                'name' => 'Uno',
                'rules_version' => 'v1',
                'min_players' => 2,
                'max_players' => 4,
            ]
        );
    }
}

