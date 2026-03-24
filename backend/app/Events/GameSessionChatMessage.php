<?php

namespace App\Events;

use Illuminate\Broadcasting\InteractsWithSockets;
use Illuminate\Broadcasting\PrivateChannel;
use Illuminate\Contracts\Broadcasting\ShouldBroadcastNow;
use Illuminate\Foundation\Events\Dispatchable;
use Illuminate\Queue\SerializesModels;

class GameSessionChatMessage implements ShouldBroadcastNow
{
    use Dispatchable, InteractsWithSockets, SerializesModels;

    public function __construct(
        public int $gameSessionId,
        public array $message
    ) {
    }

    public function broadcastOn(): PrivateChannel
    {
        return new PrivateChannel('game-session.' . $this->gameSessionId);
    }

    public function broadcastAs(): string
    {
        return 'GameSessionChatMessage';
    }

    public function broadcastWith(): array
    {
        return [
            'gameSessionId' => $this->gameSessionId,
            'message' => $this->message,
        ];
    }
}
