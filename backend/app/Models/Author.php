<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsToMany;

class Author extends Model
{
    use HasFactory;

    protected $fillable = [
        'first_name',
        'last_name'
    ];

    public function phones(): BelongsToMany
    {
        return $this->belongsToMany(Phone::class, 'author_phones', 'author_id', 'phone_id');
    }

    public function books(): BelongsToMany
    {
        return $this->belongsToMany(Book::class, 'author_books', 'author_id', 'book_id');
    }
}

