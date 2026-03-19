<?php

namespace App\Http\Controllers\Api;

use App\Models\Game;

class GameController extends BaseController
{
    public function index()
    {
        $games = Game::orderBy('name', 'asc')->get();
        return $this->sendResponse($games, 'Games');
    }
}

