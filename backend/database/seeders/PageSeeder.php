<?php

namespace Database\Seeders;

use App\Models\Book;
use App\Models\Page;
use Illuminate\Database\Console\Seeds\WithoutModelEvents;
use Illuminate\Database\Seeder;
use Illuminate\Support\Facades\DB;

class PageSeeder extends Seeder
{
    /**
     * Run the database seeds.
     *
     * @return void
     */
    public function run()
    {
        $books = Book::get();
       $pages = [];
       foreach($books as $book) {
        array_push($pages, [
            'name' => 'Page 1',
            'book_id' => $book->id
        ]);
        array_push($pages, [
            'name' => 'Page 2',
            'book_id' => $book->id
        ]);
        array_push($pages, [
            'name' => 'Page 3',
            'book_id' => $book->id
        ]);
        array_push($pages, [
            'name' => 'Page 4',
            'book_id' => $book->id
        ]);
       }
       

        // Clear existing pages
        Page::query()->delete();
        
        Page::insert($pages);
    }
}

