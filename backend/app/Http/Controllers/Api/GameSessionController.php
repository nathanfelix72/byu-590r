<?php

namespace App\Http\Controllers\Api;

use App\Models\GameSession;

class GameSessionController extends BaseController
{
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
}

