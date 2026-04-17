<?php

namespace App\Http\Controllers\Api;

use App\Models\GameSession;
use App\Models\GameSessionDetail;
use App\Models\GameSessionMessage;
use App\Models\UserGameSession;
use App\Events\GameSessionChatMessage;
use App\Events\GameSessionUpdated;
use App\Events\UnoMoveApplied;
use App\Services\ImageGenerationService;
use App\Services\UnoEngine;
use App\Models\Profile;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Validator;
use Illuminate\Support\Str;

class GameSessionController extends BaseController
{
    public function __construct(private UnoEngine $uno, private ImageGenerationService $imageGenerationService)
    {
    }

    /**
     * Display a listing of the resource.
     */
    public function index()
    {
        $sessions = GameSession::with(['game', 'detail', 'tags'])->orderBy('name', 'asc')->get();

        foreach ($sessions as $session) {
            $session->game_session_cover_picture = $this->resolveStoredImagePath($session->game_session_cover_picture);
            $session->game_session_background_picture = $this->resolveStoredImagePath($session->game_session_background_picture);
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
            ->with(['game', 'host', 'players.user', 'detail', 'tags'])
            ->orderBy('updated_at', 'desc')
            ->get();

        \Log::info('Fetched sessions for user', [
            'user_id' => $userId,
            'session_count' => count($sessions),
            'first_session_cover_picture' => $sessions->first()?->game_session_cover_picture ?? 'N/A',
        ]);

        $presented = $sessions->map(fn ($s) => $this->presentSessionForUser($s, (int) $userId));
        return $this->sendResponse($presented, 'My Game Sessions');
    }

    public function chatIndex($id)
    {
        $userId = auth()->id();
        $session = GameSession::find($id);
        if (!$session) {
            return $this->sendError('Not found.', ['error' => 'Game session not found'], 404);
        }
        $isMember = $session->players()->where('user_id', $userId)->whereNull('left_at')->exists();
        if (!$isMember) {
            return $this->sendError('Forbidden.', ['error' => 'Not a member of this session'], 403);
        }

        $messages = GameSessionMessage::query()
            ->where('game_session_id', (int) $id)
            ->with(['user:id,name'])
            ->orderBy('id', 'asc')
            ->limit(300)
            ->get()
            ->map(fn ($m) => [
                'id' => $m->id,
                'body' => $m->body,
                'user_id' => $m->user_id,
                'user_name' => $m->user?->name ?? ('Player ' . $m->user_id),
                'created_at' => $m->created_at?->toISOString(),
            ]);

        return $this->sendResponse($messages, 'Chat messages');
    }

    public function chatStore(Request $request, $id)
    {
        $validator = Validator::make($request->all(), [
            'body' => 'required|string|min:1|max:2000',
        ]);
        if ($validator->fails()) {
            return $this->sendError('Validation Error.', $validator->errors(), 422);
        }

        $userId = auth()->id();

        return DB::transaction(function () use ($request, $id, $userId) {
            /** @var GameSession|null $session */
            $session = GameSession::lockForUpdate()->find($id);
            if (!$session) {
                return $this->sendError('Not found.', ['error' => 'Game session not found'], 404);
            }
            $isMember = $session->players()->where('user_id', $userId)->whereNull('left_at')->exists();
            if (!$isMember) {
                return $this->sendError('Forbidden.', ['error' => 'Not a member of this session'], 403);
            }
            if ($session->status === 'waiting') {
                return $this->sendError('Conflict.', ['error' => 'Chat is available once the game has started'], 409);
            }
            if ($session->status === 'finished') {
                return $this->sendError('Conflict.', ['error' => 'Chat is closed for finished games'], 409);
            }

            $msg = GameSessionMessage::create([
                'game_session_id' => (int) $id,
                'user_id' => (int) $userId,
                'body' => (string) $request->input('body'),
            ]);
            $msg->load('user:id,name');

            $payload = [
                'id' => $msg->id,
                'body' => $msg->body,
                'user_id' => $msg->user_id,
                'user_name' => $msg->user?->name ?? ('Player ' . $msg->user_id),
                'created_at' => $msg->created_at?->toISOString(),
            ];

            if ($session->status === 'in_progress' && is_array($session->state) && ($session->state['type'] ?? null) === 'uno') {
                $session->refresh();
                $unoChatRuleActive = $this->allActivePlayersHaveChatUnmuted($session);
                $resolution = $this->uno->applyUnoChatResolution(
                    $session->state ?? [],
                    (int) $userId,
                    (string) $msg->body,
                    $unoChatRuleActive
                );
                if (($resolution['effect'] ?? 'none') !== 'none') {
                    $session->state = $resolution['state'];
                    $session->version = (int) $session->version + 1;
                    $session->save();

                    event(new GameSessionUpdated($session->id));
                }
            }

            event(new GameSessionChatMessage((int) $id, $payload));

            return $this->sendResponse($payload, 'Message sent');
        });
    }

    public function store(Request $request)
    {
        $validator = Validator::make($request->all(), [
            'game_id' => 'required|exists:games,id',
            'name' => 'required|string|min:2|max:80',
            'description' => 'nullable|string|max:500',
            'notes' => 'nullable|string|max:2000',
            'max_players_cap' => 'nullable|integer|min:2|max:20',
            'tag_ids' => 'nullable|array',
            'tag_ids.*' => 'integer|exists:tags,id',
        ]);

        if ($validator->fails()) {
            return $this->sendError('Validation Error.', $validator->errors(), 422);
        }

        /** @var int $userId */
        $userId = auth()->id();
        $imageGenerationService = app(ImageGenerationService::class);

        try {
            return DB::transaction(function () use ($request, $userId, $imageGenerationService) {
                $session = $this->provisionNewGameSession(
                    (int) $request->input('game_id'),
                    (int) $userId,
                    (string) $request->input('name'),
                    (string) ($request->input('description') ?? ''),
                    $request->input('notes'),
                    $request->input('max_players_cap'),
                    $request->has('tag_ids') && is_array($request->input('tag_ids'))
                        ? array_values(array_unique(array_map('intval', $request->input('tag_ids'))))
                        : [],
                    [
                        [
                            'user_id' => (int) $userId,
                            'seat' => 0,
                            'is_ready' => true,
                            'is_ai' => false,
                        ],
                    ],
                    $imageGenerationService
                );

                $session->load(['game', 'host', 'players.user', 'detail', 'tags']);
                event(new GameSessionUpdated($session->id));
                return $this->sendResponse($this->presentSessionForUser($session, (int) $userId), 'Game Session created');
            });
        } catch (\Throwable $e) {
            \Log::error('Failed to create game session with generated images', [
                'error' => $e->getMessage(),
            ]);
            return $this->sendError('Failed to create game session', ['error' => 'Image generation failed. Please try again.'], 500);
        }
    }

    public function show($id)
    {
        $session = GameSession::with(['game', 'host', 'players.user', 'detail', 'tags'])->find($id);
        if (!$session) {
            return $this->sendError('Not found.', ['error' => 'Game session not found'], 404);
        }

        // Only allow members to view for MVP
        $userId = auth()->id();
        $isMember = $session->players()->where('user_id', $userId)->whereNull('left_at')->exists();
        if (!$isMember) {
            return $this->sendError('Forbidden.', ['error' => 'Not a member of this session'], 403);
        }

        return $this->sendResponse($this->presentSessionForUser($session, (int) $userId), 'Game Session');
    }

    public function update(Request $request, $id)
    {
        $session = GameSession::with(['detail', 'tags'])->find($id);
        if (!$session) {
            return $this->sendError('Not found.', ['error' => 'Game session not found'], 404);
        }

        // Only allow host to update
        $userId = auth()->id();
        if ($session->host_user_id !== $userId) {
            return $this->sendError('Forbidden.', ['error' => 'Only the host can update this session'], 403);
        }

        $validator = Validator::make($request->all(), [
            'name' => 'sometimes|required|string|min:2|max:80',
            'description' => 'nullable|string|max:500',
            'game_id' => 'sometimes|required|exists:games,id',
            'notes' => 'nullable|string|max:2000',
            'max_players_cap' => 'nullable|integer|min:2|max:20',
            'tag_ids' => 'sometimes|array',
            'tag_ids.*' => 'integer|exists:tags,id',
        ]);

        if ($validator->fails()) {
            return $this->sendError('Validation Error.', $validator->errors(), 422);
        }

        if ($request->has('game_id')) {
            if ($session->status !== 'waiting') {
                return $this->sendError('Conflict.', ['error' => 'Cannot change game after the session has started'], 409);
            }
            $session->game_id = (int) $request->input('game_id');
        }

        if ($request->has('name')) {
            $session->name = (string) $request->input('name');
        }
        if ($request->has('description')) {
            $session->description = (string) $request->input('description');
        }

        $detailInput = [];
        if ($request->has('notes')) {
            $detailInput['notes'] = $request->input('notes');
        }
        if ($request->has('max_players_cap')) {
            $detailInput['max_players_cap'] = $request->input('max_players_cap');
        }
        if ($detailInput !== []) {
            $session->detail()->updateOrCreate(
                ['game_session_id' => $session->id],
                $detailInput
            );
        }

        if ($request->has('tag_ids')) {
            $tagIds = array_values(array_unique(array_map('intval', $request->input('tag_ids', []))));
            $session->tags()->sync($tagIds);
        }

        $session->save();

        $session->load(['game', 'host', 'players.user', 'detail', 'tags']);
        return $this->sendResponse($this->presentSessionForUser($session, (int) $userId), 'Game session updated');
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

            $session->load(['game', 'host', 'players.user', 'detail', 'tags']);
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

            $session->load(['game', 'host', 'players.user', 'detail', 'tags']);
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

    public function destroy($id)
    {
        /** @var int $userId */
        $userId = auth()->id();

        $session = GameSession::find($id);
        if (!$session) {
            return $this->sendError('Not found.', ['error' => 'Game session not found'], 404);
        }

        // Only the host can delete the session
        if ($session->host_user_id !== $userId) {
            return $this->sendError('Forbidden.', ['error' => 'Only the host can delete this session'], 403);
        }

        // Hard delete so FK cascades remove pivot rows, messages, and 1:1 detail (no orphan rows).
        $session->forceDelete();
        event(new GameSessionUpdated((int) $id));
        return $this->sendResponse(['deleted' => true], 'Game session deleted successfully');
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
        $session->started_at = now();
        $session->current_turn = 0;
        $session->version = (int) $session->version + 1;
        $session->save();

        $session->load(['game', 'host', 'players.user', 'detail', 'tags']);
        event(new GameSessionUpdated($session->id));
        return $this->sendResponse($this->presentSessionForUser($session, (int) $userId), 'Session started');
    }

    /**
     * Record a "play again" vote after a finished game. When every human player has voted,
     * a new waiting session is created with the same roster (non-AI).
     */
    public function playAgain($id)
    {
        /** @var int $userId */
        $userId = auth()->id();

        return DB::transaction(function () use ($id, $userId) {
            /** @var GameSession|null $session */
            $session = GameSession::lockForUpdate()->with(['players', 'detail', 'tags'])->find($id);
            if (!$session) {
                return $this->sendError('Not found.', ['error' => 'Game session not found'], 404);
            }

            $isMember = $session->players()->where('user_id', $userId)->whereNull('left_at')->exists();
            if (!$isMember) {
                return $this->sendError('Forbidden.', ['error' => 'Not a member of this session'], 403);
            }

            if ($session->status !== 'finished') {
                return $this->sendError('Conflict.', ['error' => 'Play again is only available after the game ends'], 409);
            }

            $state = $session->state;
            if (!is_array($state) || ($state['type'] ?? null) !== 'uno') {
                return $this->sendError('Conflict.', ['error' => 'Play again is not available for this session'], 409);
            }

            if (($state['rematch_session_id'] ?? null) !== null) {
                return $this->sendError('Conflict.', ['error' => 'A rematch session already exists'], 409);
            }

            $humanRows = $session->players()
                ->whereNull('left_at')
                ->where('is_ai', false)
                ->orderBy('seat')
                ->get();

            if ($humanRows->isEmpty()) {
                return $this->sendError('Conflict.', ['error' => 'No human players in this session'], 409);
            }

            $humanUserIds = $humanRows->pluck('user_id')->map(fn ($x) => (int) $x)->values()->all();
            if (!in_array((int) $userId, $humanUserIds, true)) {
                return $this->sendError('Forbidden.', ['error' => 'Only participating human players can vote'], 403);
            }

            $votes = $state['playAgainUserIds'] ?? [];
            if (!is_array($votes)) {
                $votes = [];
            }
            $votes = array_values(array_unique(array_map('intval', $votes)));
            $votes = array_values(array_filter($votes, fn ($uid) => in_array($uid, $humanUserIds, true)));
            if (!in_array((int) $userId, $votes, true)) {
                $votes[] = (int) $userId;
            }
            sort($votes);

            $state['playAgainUserIds'] = $votes;
            $session->state = $state;
            $session->version = (int) $session->version + 1;

            $allIn = count($votes) === count($humanUserIds) && empty(array_diff($humanUserIds, $votes));

            if (!$allIn) {
                $session->save();
                $session->load(['game', 'host', 'players.user', 'detail', 'tags']);
                event(new GameSessionUpdated($session->id));
                return $this->sendResponse([
                    'session' => $this->presentSessionForUser($session, (int) $userId),
                    'new_session_id' => null,
                ], 'Play again vote recorded');
            }

            $imageGenerationService = app(ImageGenerationService::class);

            $rematchName = $this->nextRematchSessionName((string) $session->name);

            $tagIds = $session->tags->pluck('id')->map(fn ($x) => (int) $x)->values()->all();

            $seatedPlayers = [];
            foreach ($humanRows as $row) {
                $seatedPlayers[] = [
                    'user_id' => (int) $row->user_id,
                    'seat' => (int) $row->seat,
                    'is_ready' => true,
                    'is_ai' => false,
                ];
            }

            $reuseCover = $session->game_session_cover_picture;
            $reuseBg = $session->game_session_background_picture;

            try {
                $newSession = $this->provisionNewGameSession(
                    (int) $session->game_id,
                    (int) $session->host_user_id,
                    $rematchName,
                    (string) $session->description,
                    $session->detail?->notes,
                    $session->detail?->max_players_cap,
                    $tagIds,
                    $seatedPlayers,
                    $imageGenerationService,
                    is_string($reuseCover) && $reuseCover !== '' ? $reuseCover : null,
                    is_string($reuseBg) && $reuseBg !== '' ? $reuseBg : null
                );
            } catch (\Throwable $e) {
                \Log::error('Failed to create rematch session', [
                    'error' => $e->getMessage(),
                    'from_session_id' => $session->id,
                ]);

                return $this->sendError('Failed to create rematch', ['error' => 'Could not create the new session. Please try again.'], 500);
            }

            $state['rematch_session_id'] = (int) $newSession->id;
            $session->state = $state;
            $session->save();

            $session->load(['game', 'host', 'players.user', 'detail', 'tags']);
            event(new GameSessionUpdated($session->id));

            $newSession->load(['game', 'host', 'players.user', 'detail', 'tags']);
            event(new GameSessionUpdated($newSession->id));

            return $this->sendResponse([
                'session' => $this->presentSessionForUser($session, (int) $userId),
                'new_session_id' => (int) $newSession->id,
            ], 'Rematch created');
        });
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

            $unoChatRuleActive = $this->allActivePlayersHaveChatUnmuted($session);

            try {
                $newState = $this->uno->applyMove($state, $userId, [
                    'type' => $request->input('type'),
                    'payload' => $request->input('payload', []),
                ], $unoChatRuleActive);
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
            $session->load(['game', 'host', 'players.user', 'detail', 'tags']);

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

    public function updateChatMute(Request $request, $id)
    {
        $validator = Validator::make($request->all(), [
            'chat_muted' => 'required|boolean',
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

            $pivot = UserGameSession::query()
                ->where('game_session_id', (int) $id)
                ->where('user_id', $userId)
                ->whereNull('left_at')
                ->first();
            if (!$pivot) {
                return $this->sendError('Forbidden.', ['error' => 'Not a member of this session'], 403);
            }

            $pivot->chat_muted = $request->boolean('chat_muted');
            $pivot->save();

            if ($session->status === 'in_progress'
                && is_array($session->state)
                && ($session->state['type'] ?? null) === 'uno'
                && !$this->allActivePlayersHaveChatUnmuted($session)) {
                $state = $session->state;
                unset($state['pendingUnoUserId']);
                $session->state = $state;
                $session->version = (int) $session->version + 1;
                $session->save();
            }

            $session->load(['game', 'host', 'players.user', 'detail', 'tags']);
            event(new GameSessionUpdated($session->id));

            return $this->sendResponse($this->presentSessionForUser($session, (int) $userId), 'Chat preference updated');
        });
    }

    /**
     * UNO "say uno in chat" rule only applies when every active player has chat unmuted.
     */
    private function allActivePlayersHaveChatUnmuted(GameSession $session): bool
    {
        return ! $session->players()
            ->whereNull('left_at')
            ->where('chat_muted', true)
            ->exists();
    }

    private function presentSessionForUser(GameSession $session, int $userId): GameSession
    {
        $session->game_session_cover_picture = $this->resolveStoredImagePath($session->game_session_cover_picture);
        $session->game_session_background_picture = $this->resolveStoredImagePath($session->game_session_background_picture);

        if ($session->relationLoaded('players')) {
            foreach ($session->players as $p) {
                if ((int) $p->user_id !== (int) $userId) {
                    $p->makeHidden(['chat_muted']);
                }
            }
        }

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

    private function resolveStoredImagePath(?string $path): ?string
    {
        if (!$path) {
            return null;
        }

        if (str_starts_with($path, 'http://') || str_starts_with($path, 'https://')) {
            return $path;
        }

        // Use ImageGenerationService to convert storage paths to presigned URLs
        return $this->imageGenerationService->storedPathToUrl($path);
    }

    private function buildImagePrompt(string $name, string $description): string
    {
        $prompt = trim($name);
        $description = trim($description);
        if ($description !== '') {
            $prompt .= ' - ' . $description;
        }
        return $prompt;
    }

    /**
     * Strip any trailing "— rematch" / "- rematch" segments so chained rematches stay "Title — rematch".
     */
    private function nextRematchSessionName(string $currentName): string
    {
        $base = trim(preg_replace('/(?:\s*[—-]\s*rematch)+$/iu', '', trim($currentName)));

        return $base . ' — rematch';
    }

    /**
     * @param  list<int>  $tagIds
     * @param  list<array{user_id: int, seat: int, is_ready: bool, is_ai?: bool}>  $seatedPlayers
     */
    private function provisionNewGameSession(
        int $gameId,
        int $hostUserId,
        string $name,
        string $description,
        mixed $notes,
        mixed $maxPlayersCap,
        array $tagIds,
        array $seatedPlayers,
        ImageGenerationService $imageGenerationService,
        ?string $reuseCoverPath = null,
        ?string $reuseBackgroundPath = null
    ): GameSession {
        $session = GameSession::create([
            'game_id' => $gameId,
            'host_user_id' => $hostUserId,
            'name' => $name,
            'description' => $description,
            'game_session_cover_picture' => null,
            'game_session_background_picture' => null,
            'status' => 'waiting',
            'current_turn' => null,
            'join_code' => $this->generateJoinCode(),
            'state' => null,
            'version' => 0,
        ]);

        $sid = (int) $session->id;
        $reuseBoth = $reuseCoverPath !== null && $reuseCoverPath !== ''
            && $reuseBackgroundPath !== null && $reuseBackgroundPath !== '';

        if ($reuseBoth) {
            $coverPath = $imageGenerationService->duplicateStoredImage($reuseCoverPath, 'game_cover', $sid) ?? $reuseCoverPath;
            $backgroundPath = $imageGenerationService->duplicateStoredImage($reuseBackgroundPath, 'uno_background', $sid) ?? $reuseBackgroundPath;
        } else {
            $prompt = $this->buildImagePrompt($name, $description);
            $coverPath = $imageGenerationService->generateAndStoreImage($prompt, 'game_cover', $sid);
            $backgroundPath = $imageGenerationService->generateAndStoreImage($prompt, 'uno_background', $sid);
        }

        $session->game_session_cover_picture = $coverPath;
        $session->game_session_background_picture = $backgroundPath;
        $session->save();

        foreach ($seatedPlayers as $row) {
            UserGameSession::create([
                'user_id' => (int) $row['user_id'],
                'game_session_id' => $session->id,
                'seat' => (int) $row['seat'],
                'score' => 0,
                'is_ready' => (bool) $row['is_ready'],
                'is_ai' => (bool) ($row['is_ai'] ?? false),
            ]);
        }

        GameSessionDetail::create([
            'game_session_id' => $session->id,
            'notes' => $notes,
            'max_players_cap' => $maxPlayersCap,
        ]);

        if ($tagIds !== []) {
            $session->tags()->sync($tagIds);
        }

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

