<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class UserGameSession extends Model
{
    use HasFactory;

    protected $table = 'user_game_sessions';

    protected $fillable = [
        'user_id',
        'game_session_id',
        'seat',
        'score',
        'is_ready',
        'left_at',
        'is_ai',
    ];

    protected $casts = [
        'seat' => 'integer',
        'score' => 'integer',
        'is_ready' => 'boolean',
        'is_ai' => 'boolean',
        'left_at' => 'datetime',
    ];

    public function user(): BelongsTo
    {
        return $this->belongsTo(User::class);
    }

    public function gameSession(): BelongsTo
    {
        return $this->belongsTo(GameSession::class);
    }
}

