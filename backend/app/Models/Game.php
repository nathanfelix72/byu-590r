<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\HasMany;

class Game extends Model
{
    use HasFactory;

    protected $fillable = [
        'key',
        'name',
        'rules_version',
        'min_players',
        'max_players',
    ];

    public function sessions(): HasMany
    {
        return $this->hasMany(GameSession::class);
    }
}

