<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsToMany;

class Checkout extends Model
{
    use HasFactory;

    protected $fillable = [
        'checkout_date',
        'due_date',
        'checkin_date'
    ];

    public function users(): BelongsToMany
    {
        return $this->belongsToMany(User::class, 'user_book_checkouts', 'checkout_id', 'user_id');
    }

    public function books(): BelongsToMany
    {
        return $this->belongsToMany(Book::class, 'user_book_checkouts', 'checkout_id', 'book_id');
    }
}

