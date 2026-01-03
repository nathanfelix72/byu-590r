<?php

namespace Database\Seeders;

use App\Models\Author;
use App\Models\Book;
use Illuminate\Database\Console\Seeds\WithoutModelEvents;
use Illuminate\Database\Seeder;
use Illuminate\Support\Facades\DB;

class AuthorBooksSeeder extends Seeder
{
    /**
     * Run the database seeds.
     *
     * @return void
     */
    public function run()
    {
       $jkrowling = Author::where('first_name','J.K.')->first();
       $harryPotterBooks = Book::where('name','like','Harry%')->get();
       $book_authors = [];

       foreach($harryPotterBooks as $book)  {
        array_push($book_authors, [
            'book_id' => $book->id,
            'author_id' => $jkrowling->id
        ]);
       }

       $sanderson = Author::where('first_name','Brandon')->first();
       $sandersonBooks = Book::where('name','like','Mistborn%')->get();

       foreach($sandersonBooks as $book)  {
        array_push($book_authors, [
            'book_id' => $book->id,
            'author_id' => $sanderson->id
        ]);
       }

       $bookOfMormon = Book::where('name','The Book of Mormon')->first();
       for ($i=1; $i <= 6; $i++) { 
        # code...
        array_push($book_authors, [
            'book_id' => $bookOfMormon->id,
            'author_id' => $i
        ]);
       }
       
       
        // Clear existing relationships
        DB::table('author_books')->delete();
        
        DB::table('author_books')->insert($book_authors);
    }
}

