<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;
use Illuminate\Database\Eloquent\SoftDeletes;

class GameSession extends Model
{
    use HasFactory;
    use SoftDeletes;

    protected $fillable = [
        'game_id',
        'host_user_id',
        'name',
        'description',
        'game_session_cover_picture',
        'status',
        'current_turn',
        'join_code',
        'state',
        'version',
    ];

    protected $casts = [
        'state' => 'array',
        'version' => 'integer',
        'current_turn' => 'integer',
    ];

    public function game(): BelongsTo
    {
        return $this->belongsTo(Game::class);
    }

    public function host(): BelongsTo
    {
        return $this->belongsTo(User::class, 'host_user_id');
    }

    public function players(): HasMany
    {
        return $this->hasMany(UserGameSession::class, 'game_session_id');
    }
}

