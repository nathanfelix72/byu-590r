<?php

namespace App\Http\Controllers\Api;

use App\Models\GameSession;
use App\Models\UserGameSession;
use App\Events\GameSessionUpdated;
use App\Events\UnoMoveApplied;
use App\Services\UnoEngine;
use App\Models\Profile;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Validator;
use Illuminate\Support\Str;

class GameSessionController extends BaseController
{
    public function __construct(private UnoEngine $uno)
    {
    }

    /**
     * Display a listing of the resource.
     */
    public function index()
    {
        $sessions = GameSession::orderBy('name', 'asc')->get();

        foreach ($sessions as $session) {
            if ($session->game_session_cover_picture) {
                $session->game_session_cover_picture = $this->getS3Url($session->game_session_cover_picture);
            }
        }

        return $this->sendResponse($sessions, 'Game Sessions');
    }

    /**
     * Display sessions the authenticated user participates in.
     */
    public function myIndex()
    {
        $userId = auth()->id();

        $sessions = GameSession::query()
            ->whereHas('players', function ($q) use ($userId) {
                $q->where('user_id', $userId)->whereNull('left_at');
            })
            ->with(['game', 'host', 'players'])
            ->orderBy('updated_at', 'desc')
            ->get();

        foreach ($sessions as $session) {
            if ($session->game_session_cover_picture) {
                $session->game_session_cover_picture = $this->getS3Url($session->game_session_cover_picture);
            }
        }

        $presented = $sessions->map(fn ($s) => $this->presentSessionForUser($s, (int) $userId));
        return $this->sendResponse($presented, 'My Game Sessions');
    }

    public function store(Request $request)
    {
        $validator = Validator::make($request->all(), [
            'game_id' => 'required|exists:games,id',
            'name' => 'required|string|min:2|max:80',
            'description' => 'nullable|string|max:500',
        ]);

        if ($validator->fails()) {
            return $this->sendError('Validation Error.', $validator->errors(), 422);
        }

        /** @var int $userId */
        $userId = auth()->id();

        return DB::transaction(function () use ($request, $userId) {
            $session = GameSession::create([
                'game_id' => (int) $request->input('game_id'),
                'host_user_id' => $userId,
                'name' => $request->input('name'),
                'description' => $request->input('description') ?? '',
                'status' => 'waiting',
                'current_turn' => null,
                'join_code' => $this->generateJoinCode(),
                'state' => null,
                'version' => 0,
            ]);

            UserGameSession::create([
                'user_id' => $userId,
                'game_session_id' => $session->id,
                'seat' => 0,
                'score' => 0,
                'is_ready' => true,
                'is_ai' => false,
            ]);

            $session->load(['game', 'host', 'players']);
            event(new GameSessionUpdated($session->id));
            return $this->sendResponse($this->presentSessionForUser($session, (int) $userId), 'Game Session created');
        });
    }

    public function show($id)
    {
        $session = GameSession::with(['game', 'host', 'players.user'])->find($id);
        if (!$session) {
            return $this->sendError('Not found.', ['error' => 'Game session not found'], 404);
        }

        // Only allow members to view for MVP
        $userId = auth()->id();
        $isMember = $session->players()->where('user_id', $userId)->whereNull('left_at')->exists();
        if (!$isMember) {
            return $this->sendError('Forbidden.', ['error' => 'Not a member of this session'], 403);
        }

        if ($session->game_session_cover_picture) {
            $session->game_session_cover_picture = $this->getS3Url($session->game_session_cover_picture);
        }

        return $this->sendResponse($this->presentSessionForUser($session, (int) $userId), 'Game Session');
    }

    public function join(Request $request, $id)
    {
        $validator = Validator::make($request->all(), [
            'join_code' => 'nullable|string|min:4|max:12',
        ]);
        if ($validator->fails()) {
            return $this->sendError('Validation Error.', $validator->errors(), 422);
        }

        /** @var int $userId */
        $userId = auth()->id();

        $session = GameSession::find($id);
        if (!$session) {
            return $this->sendError('Not found.', ['error' => 'Game session not found'], 404);
        }

        if ($request->filled('join_code') && $session->join_code && $request->input('join_code') !== $session->join_code) {
            return $this->sendError('Invalid join code.', ['error' => 'Invalid join code'], 403);
        }

        if ($session->status !== 'waiting') {
            return $this->sendError('Session already started.', ['error' => 'Session already started'], 409);
        }

        return DB::transaction(function () use ($session, $userId) {
            $existing = UserGameSession::where('game_session_id', $session->id)->where('user_id', $userId)->first();
            if ($existing) {
                $existing->update(['left_at' => null]);
            } else {
                $maxSeat = UserGameSession::where('game_session_id', $session->id)->max('seat');
                $seat = is_null($maxSeat) ? 0 : ((int) $maxSeat + 1);
                UserGameSession::create([
                    'user_id' => $userId,
                    'game_session_id' => $session->id,
                    'seat' => $seat,
                    'score' => 0,
                    'is_ready' => false,
                    'is_ai' => false,
                ]);
            }

            $session->load(['game', 'host', 'players.user']);
            event(new GameSessionUpdated($session->id));
            return $this->sendResponse($this->presentSessionForUser($session, (int) $userId), 'Joined game session');
        });
    }

    /**
     * Join a waiting session by its join code (e.g. W8MBPLZN).
     */
    public function joinByCode(Request $request)
    {
        $validator = Validator::make($request->all(), [
            'join_code' => 'required|string|min:4|max:12',
        ]);

        if ($validator->fails()) {
            return $this->sendError('Validation Error.', $validator->errors(), 422);
        }

        /** @var int $userId */
        $userId = auth()->id();

        $joinCode = (string) $request->input('join_code');
        $session = GameSession::where('join_code', $joinCode)->first();

        if (!$session) {
            return $this->sendError('Not found.', ['error' => 'Game session not found'], 404);
        }

        if ($session->status !== 'waiting') {
            return $this->sendError('Session already started.', ['error' => 'Session already started'], 409);
        }

        return DB::transaction(function () use ($session, $userId) {
            $existing = UserGameSession::where('game_session_id', $session->id)
                ->where('user_id', $userId)
                ->first();

            if ($existing) {
                $existing->update(['left_at' => null]);
            } else {
                $maxSeat = UserGameSession::where('game_session_id', $session->id)->max('seat');
                $seat = is_null($maxSeat) ? 0 : ((int) $maxSeat + 1);
                UserGameSession::create([
                    'user_id' => $userId,
                    'game_session_id' => $session->id,
                    'seat' => $seat,
                    'score' => 0,
                    'is_ready' => false,
                    'is_ai' => false,
                ]);
            }

            $session->load(['game', 'host', 'players.user']);
            event(new GameSessionUpdated($session->id));

            return $this->sendResponse($this->presentSessionForUser($session, (int) $userId), 'Joined game session');
        });
    }

    public function leave($id)
    {
        /** @var int $userId */
        $userId = auth()->id();

        $pivot = UserGameSession::where('game_session_id', $id)->where('user_id', $userId)->first();
        if (!$pivot) {
            return $this->sendError('Not found.', ['error' => 'Not in this session'], 404);
        }

        $pivot->update(['left_at' => now(), 'is_ready' => false]);
        event(new GameSessionUpdated((int) $id));
        return $this->sendResponse(['left' => true], 'Left game session');
    }

    public function ready(Request $request, $id)
    {
        $validator = Validator::make($request->all(), [
            'is_ready' => 'required|boolean',
        ]);
        if ($validator->fails()) {
            return $this->sendError('Validation Error.', $validator->errors(), 422);
        }

        /** @var int $userId */
        $userId = auth()->id();

        $pivot = UserGameSession::where('game_session_id', $id)->where('user_id', $userId)->whereNull('left_at')->first();
        if (!$pivot) {
            return $this->sendError('Not found.', ['error' => 'Not in this session'], 404);
        }

        $pivot->update(['is_ready' => (bool) $request->boolean('is_ready')]);
        event(new GameSessionUpdated((int) $id));
        return $this->sendResponse(['is_ready' => $pivot->is_ready], 'Ready status updated');
    }

    public function start($id)
    {
        /** @var int $userId */
        $userId = auth()->id();

        $session = GameSession::with(['players', 'game'])->find($id);
        if (!$session) {
            return $this->sendError('Not found.', ['error' => 'Game session not found'], 404);
        }

        if ((int) $session->host_user_id !== (int) $userId) {
            return $this->sendError('Forbidden.', ['error' => 'Only host can start'], 403);
        }

        if ($session->status !== 'waiting') {
            return $this->sendError('Conflict.', ['error' => 'Session already started'], 409);
        }

        $activePlayers = $session->players()->whereNull('left_at')->orderBy('seat')->get();
        if ($activePlayers->count() < 2) {
            return $this->sendError('Not enough players.', ['error' => 'Need at least 2 players'], 422);
        }

        $allReady = $activePlayers->every(fn ($p) => (bool) $p->is_ready);
        if (!$allReady) {
            return $this->sendError('Players not ready.', ['error' => 'All players must be ready'], 422);
        }

        if ($session->game && $session->game->key === 'uno') {
            $userIds = $activePlayers->pluck('user_id')->map(fn ($id) => (int) $id)->values()->all();
            $session->state = $this->uno->initState($userIds, is_array($session->rules) ? $session->rules : []);
        }
        $session->status = 'in_progress';
        $session->current_turn = 0;
        $session->version = (int) $session->version + 1;
        $session->save();

        $session->load(['game', 'host', 'players.user']);
        event(new GameSessionUpdated($session->id));
        return $this->sendResponse($this->presentSessionForUser($session, (int) $userId), 'Session started');
    }

    public function move(Request $request, $id)
    {
        $validator = Validator::make($request->all(), [
            'type' => 'required|string',
            'payload' => 'nullable|array',
            'clientVersion' => 'required|integer|min:0',
        ]);
        if ($validator->fails()) {
            return $this->sendError('Validation Error.', $validator->errors(), 422);
        }

        /** @var int $userId */
        $userId = auth()->id();

        return DB::transaction(function () use ($request, $id, $userId) {
            /** @var GameSession|null $session */
            $session = GameSession::lockForUpdate()->with(['players'])->find($id);
            if (!$session) {
                return $this->sendError('Not found.', ['error' => 'Game session not found'], 404);
            }

            $isMember = $session->players()->where('user_id', $userId)->whereNull('left_at')->exists();
            if (!$isMember) {
                return $this->sendError('Forbidden.', ['error' => 'Not a member of this session'], 403);
            }

            if ($session->status !== 'in_progress') {
                return $this->sendError('Conflict.', ['error' => 'Game not in progress'], 409);
            }

            $clientVersion = (int) $request->input('clientVersion');
            if ((int) $session->version !== $clientVersion) {
                return $this->sendError('Version conflict.', [
                    'error' => 'Version conflict',
                    'serverVersion' => (int) $session->version,
                    'state' => $session->state,
                ], 409);
            }

            $state = $session->state;
            if (!is_array($state) || ($state['type'] ?? null) !== 'uno') {
                return $this->sendError('Invalid state.', ['error' => 'Session state not initialized'], 500);
            }

            try {
                $newState = $this->uno->applyMove($state, $userId, [
                    'type' => $request->input('type'),
                    'payload' => $request->input('payload', []),
                ]);
            } catch (\RuntimeException $e) {
                return $this->sendError('Invalid move.', ['error' => $e->getMessage()], 422);
            }

            $lastMove = [];
            if (isset($newState['moveHistory']) && is_array($newState['moveHistory']) && count($newState['moveHistory']) > 0) {
                $lastMove = $newState['moveHistory'][count($newState['moveHistory']) - 1];
            }

            // Keep DB-level turn marker aligned with state for quick querying
            $session->state = $newState;
            $session->current_turn = (int) ($newState['currentTurn'] ?? 0);
            $session->version = (int) $session->version + 1;

            if (($newState['winnerUserId'] ?? null) !== null) {
                $session->status = 'finished';
                $session->current_turn = null;

                $winnerId = (int) $newState['winnerUserId'];
                $playerIds = $session->players()->whereNull('left_at')->pluck('user_id')->map(fn ($x) => (int) $x)->all();
                foreach ($playerIds as $pid) {
                    $profile = Profile::firstOrCreate(['user_id' => $pid], ['wins' => 0, 'losses' => 0]);
                    if ($pid === $winnerId) {
                        $profile->increment('wins');
                    } else {
                        $profile->increment('losses');
                    }
                }
            }

            $session->save();
            $session->load(['game', 'host', 'players.user']);

            // Old generic event (kept for other UI pieces)
            event(new GameSessionUpdated($session->id));

            // New no-refresh realtime payload for Uno table UI
            $handCounts = [];
            if (is_array($newState['players'] ?? null)) {
                foreach ($newState['players'] as $p) {
                    $uid = (int) ($p['user_id'] ?? 0);
                    if ($uid > 0) {
                        $hand = $p['hand'] ?? [];
                        $handCounts[$uid] = is_array($hand) ? count($hand) : 0;
                    }
                }
            }

            $publicState = [
                'type' => 'uno',
                'currentTurn' => (int) ($newState['currentTurn'] ?? 0),
                'currentColor' => $newState['currentColor'] ?? null,
                'currentValue' => $newState['currentValue'] ?? null,
                'direction' => (int) ($newState['direction'] ?? 1),
                'pendingDraw' => (int) ($newState['pendingDraw'] ?? 0),
                'winnerUserId' => $newState['winnerUserId'] ?? null,
                // top discard is public
                'topCard' => is_array($newState['discard'] ?? null) && count($newState['discard']) > 0
                    ? $newState['discard'][count($newState['discard']) - 1]
                    : null,
            ];

            event(new UnoMoveApplied(
                (int) $session->id,
                (int) $session->version,
                $publicState,
                $handCounts,
                is_array($lastMove) ? $lastMove : []
            ));

            return $this->sendResponse($this->presentSessionForUser($session, (int) $userId), 'Move applied');
        });
    }

    private function presentSessionForUser(GameSession $session, int $userId): GameSession
    {
        $state = $session->state;
        if (!is_array($state) || ($state['type'] ?? null) !== 'uno') {
            return $session;
        }

        $players = $state['players'] ?? [];
        $presentedPlayers = [];
        foreach ($players as $p) {
            $hand = $p['hand'] ?? [];
            if ((int) ($p['user_id'] ?? 0) === $userId) {
                $presentedPlayers[] = $p + ['handCount' => is_array($hand) ? count($hand) : 0];
            } else {
                $p2 = $p;
                $p2['handCount'] = is_array($hand) ? count($hand) : 0;
                unset($p2['hand']);
                $presentedPlayers[] = $p2;
            }
        }

        $state['players'] = $presentedPlayers;
        $session->state = $state;
        return $session;
    }

    private function generateJoinCode(): string
    {
        // 8-char, URL-safe-ish join code. Retry on collision.
        for ($i = 0; $i < 10; $i++) {
            $code = strtoupper(Str::random(8));
            $exists = GameSession::where('join_code', $code)->exists();
            if (!$exists) {
                return $code;
            }
        }
        // Fallback: include entropy from time
        return strtoupper(substr(hash('sha256', (string) microtime(true)), 0, 10));
    }
}

