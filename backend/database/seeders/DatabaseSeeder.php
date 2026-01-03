<?php

namespace Database\Seeders;

use Illuminate\Database\Seeder;

class DatabaseSeeder extends Seeder
{
    /**
     * Seed the application's database.
     *
     * @return void
     */
    public function run()
    {
        $this->call([
            UsersSeeder::class,
            GenreSeeder::class,
            AuthorSeeder::class,
            PhoneSeeder::class,
            BooksSeeder::class,
            AuthorPhonesSeeder::class,
            AuthorBooksSeeder::class,
            PageSeeder::class,
        ]);
    }
}
