<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class GameSessionDetail extends Model
{
    use HasFactory;

    protected $fillable = [
        'game_session_id',
        'notes',
        'max_players_cap',
    ];

    protected $casts = [
        'max_players_cap' => 'integer',
    ];

    public function gameSession(): BelongsTo
    {
        return $this->belongsTo(GameSession::class);
    }
}
