<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\BelongsToMany;
use Illuminate\Database\Eloquent\Relations\HasOne;

class Book extends Model
{
    use HasFactory;

    protected $fillable = [
        'name',
        'description',
        'file',
        'genre_id',
        'checked_qty',
        'inventory_total_qty',
        'created_at',
        'updated_at'
    ];

    public function genre(): BelongsTo
    {
        return $this->belongsTo(Genre::class, 'genre_id');
    }

    public function authors(): BelongsToMany
    {
        return $this->belongsToMany(Author::class, 'author_books', 'book_id', 'author_id');
    }

    public function checkouts(): BelongsToMany
    {
        return $this->belongsToMany(Checkout::class, 'user_book_checkouts', 'book_id')->withPivot('user_id');
    }
}

