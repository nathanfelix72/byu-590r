<?php

namespace App\Events;

use App\Models\GameSession;
use Illuminate\Broadcasting\Channel;
use Illuminate\Broadcasting\PrivateChannel;
use Illuminate\Broadcasting\InteractsWithSockets;
use Illuminate\Contracts\Broadcasting\ShouldBroadcastNow;
use Illuminate\Foundation\Events\Dispatchable;
use Illuminate\Queue\SerializesModels;

class GameSessionUpdated implements ShouldBroadcastNow
{
    use Dispatchable, InteractsWithSockets, SerializesModels;

    public function __construct(public int $gameSessionId)
    {
    }

    public function broadcastOn(): Channel
    {
        return new PrivateChannel('game-session.' . $this->gameSessionId);
    }

    public function broadcastAs(): string
    {
        return 'GameSessionUpdated';
    }

    public function broadcastWith(): array
    {
        return [
            'gameSessionId' => $this->gameSessionId,
        ];
    }
}

