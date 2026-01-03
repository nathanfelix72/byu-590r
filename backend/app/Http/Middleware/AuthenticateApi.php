<?php

namespace App\Http\Middleware;

use App\Models\PersonalAccessToken;
use Closure;
use Illuminate\Http\Request;
use Symfony\Component\HttpFoundation\Response;

class AuthenticateApi
{
    public function handle(Request $request, Closure $next): Response
    {
        $token = $request->bearerToken();

        if (!$token) {
            return response()->json(['success' => false, 'message' => 'Unauthenticated.'], 401);
        }

        $accessToken = PersonalAccessToken::findToken($token);

        if (!$accessToken) {
            return response()->json(['success' => false, 'message' => 'Invalid token.'], 401);
        }

        if ($accessToken->expires_at && $accessToken->expires_at->isPast()) {
            return response()->json(['success' => false, 'message' => 'Token expired.'], 401);
        }

        $user = $accessToken->tokenable;

        if (!$user) {
            return response()->json(['success' => false, 'message' => 'User not found.'], 401);
        }

        $accessToken->update(['last_used_at' => now()]);

        auth()->setUser($user);

        return $next($request);
    }
}

