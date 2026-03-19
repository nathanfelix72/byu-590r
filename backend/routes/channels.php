<?php

use App\Models\UserGameSession;
use Illuminate\Support\Facades\Broadcast;

Broadcast::channel('game-session.{sessionId}', function ($user, $sessionId) {
    return UserGameSession::where('game_session_id', $sessionId)
        ->where('user_id', $user->id)
        ->whereNull('left_at')
        ->exists();
});

