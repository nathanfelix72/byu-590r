<?php

namespace Database\Seeders;

use App\Models\Genre;
use Illuminate\Database\Console\Seeds\WithoutModelEvents;
use Illuminate\Database\Seeder;

class GenreSeeder extends Seeder
{
    /**
     * Run the database seeds.
     *
     * @return void
     */
    public function run()
    {
        $genres = [
            [
                'name' => 'Fantasy',
                'description' => 'Fantasy is the coolest genre in the world!',
                'world_introduction_date' => date('Y-m-d')
            ],
            [
                'name' => 'Sci-Fi',
                'description' => 'Sci-fi is also the coolest genre in the world!',
                'world_introduction_date' => date('Y-m-d')
            ],
            [
                'name' => 'Romance',
                'description' => 'Romance is the coolest genre in the world!',
                'world_introduction_date' => date('Y-m-d')
            ],
            [
                'name' => 'Religion',
                'description' => 'Religion is the coolest genre in the world!',
                'world_introduction_date' => date('Y-m-d')
            ]
        ];

        foreach ($genres as $genre) {
            Genre::updateOrCreate(
                ['name' => $genre['name']],
                $genre
            );
        }
    }
}

