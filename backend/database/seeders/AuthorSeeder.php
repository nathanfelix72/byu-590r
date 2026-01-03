<?php

namespace Database\Seeders;

use App\Models\Author;
use Illuminate\Database\Console\Seeds\WithoutModelEvents;
use Illuminate\Database\Seeder;

class AuthorSeeder extends Seeder
{
    /**
     * Run the database seeds.
     *
     * @return void
     */
    public function run()
    {
        $authors = [
            [
                'first_name' => 'Mormon',
                'last_name' => 'Nephite'
            ],
            [

                'first_name' => 'Moroni',
                'last_name' => 'Nephite'
            ],
            [

                'first_name' => 'Enos',
                'last_name' => 'Nephite'
            ],
            [

                'first_name' => 'Alma',
                'last_name' => 'Nephite'
            ],
            [
    
                'first_name' => 'Nephi',
                'last_name' => 'Nephite'
            ],
            [
                'first_name' => 'Samuel',
                'last_name' => 'Lamanite'
            ],
            [
 
                'first_name' => 'J.K.',
                'last_name' => 'Rowling'
            ],
            [
 
                'first_name' => 'Brandon',
                'last_name' => 'Sanderson'
            ],
            

        ];
        foreach ($authors as $author) {
            Author::updateOrCreate(
                [
                    'first_name' => $author['first_name'],
                    'last_name' => $author['last_name']
                ],
                $author
            );
        }
    }
}

