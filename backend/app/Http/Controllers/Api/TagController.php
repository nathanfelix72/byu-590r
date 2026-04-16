<?php

namespace App\Http\Controllers\Api;

use App\Models\Tag;

class TagController extends BaseController
{
    public function index()
    {
        $tags = Tag::orderBy('name')->get();

        return $this->sendResponse($tags, 'Tags');
    }
}
