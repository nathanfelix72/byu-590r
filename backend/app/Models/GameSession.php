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
        'game_session_background_picture',
        'status',
        'current_turn',
        'join_code',
        'state',
        'version',
        'rules',
    ];

    protected $casts = [
        'state' => 'array',
        'version' => 'integer',
        'current_turn' => 'integer',
        'rules' => 'array',
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

    public function chatMessages(): HasMany
    {
        return $this->hasMany(GameSessionMessage::class, 'game_session_id');
    }
}

