<?php

namespace Database\Seeders;

use App\Models\Author;
use Illuminate\Database\Console\Seeds\WithoutModelEvents;
use Illuminate\Database\Seeder;

use Illuminate\Support\Facades\DB;

class AuthorPhonesSeeder extends Seeder
{
    /**
     * Run the database seeds.
     *
     * @return void
     */
    public function run()
    {
        // Clear existing relationships
        DB::table('author_phones')->delete();
        
        $authors = Author::get();
        $author_phones = [];
        foreach($authors as $author) {
            array_push($author_phones, [
                'author_id' => $author->id,
                'phone_id' => rand(1,2),
            ]);
        }
      
        DB::table('author_phones')->insert($author_phones);
    }
}

