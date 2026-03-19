<?php

namespace App\Events;

use Illuminate\Broadcasting\PrivateChannel;
use Illuminate\Broadcasting\InteractsWithSockets;
use Illuminate\Contracts\Broadcasting\ShouldBroadcastNow;
use Illuminate\Foundation\Events\Dispatchable;
use Illuminate\Queue\SerializesModels;

class UnoMoveApplied implements ShouldBroadcastNow
{
    use Dispatchable, InteractsWithSockets, SerializesModels;

    public function __construct(
        public int $gameSessionId,
        public int $serverVersion,
        public array $publicState,
        public array $handCountsByUserId,
        public array $lastMove
    ) {
    }

    public function broadcastOn(): PrivateChannel
    {
        return new PrivateChannel('game-session.' . $this->gameSessionId);
    }

    public function broadcastAs(): string
    {
        return 'UnoMoveApplied';
    }

    public function broadcastWith(): array
    {
        return [
            'gameSessionId' => $this->gameSessionId,
            'serverVersion' => $this->serverVersion,
            'publicState' => $this->publicState,
            'handCountsByUserId' => $this->handCountsByUserId,
            'lastMove' => $this->lastMove,
        ];
    }
}

