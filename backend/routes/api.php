<?php

use App\Http\Controllers\Api\BookController;
use App\Http\Controllers\Api\GameController;
use App\Http\Controllers\Api\HelloWorldController;
use App\Http\Controllers\Api\GameSessionController;
use App\Http\Controllers\Api\RegisterController;
use App\Http\Controllers\Api\UserController;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Route;

// Hello World API routes
Route::get('/hello', [HelloWorldController::class, 'hello']);
Route::get('/health', [HelloWorldController::class, 'health']);
Route::get('/test-s3', [HelloWorldController::class, 'testS3']);

// Authentication routes
Route::controller(RegisterController::class)->group(function () {
    Route::post('register', 'register');
    Route::post('login', 'login');
    Route::post('logout', 'logout');
    Route::post('forgot_password', 'forgotPassword');
    Route::get('password_reset', 'passwordReset');
    Route::post('password_reset', 'setNewPassword');
});

// Protected routes
Route::middleware(\App\Http\Middleware\AuthenticateApi::class)->group(function () {
    Route::controller(UserController::class)->group(function () {
        Route::get('user', 'getUser');
        Route::post('user/upload_avatar', 'uploadAvatar');
        Route::delete('user/remove_avatar', 'removeAvatar');
        Route::post('user/change_email', 'changeEmail');
    });

    Route::resource('books', BookController::class);
    Route::controller(BookController::class)->group(function () {
        Route::post('books/{id}/checkout', 'checkoutBook');
        Route::patch('books/{id}/return', 'returnBook');
        Route::post('books/{id}/update_book_picture', 'updateBookPicture');
        Route::post('send_book_report', 'sendBookReport');
    });

    Route::get('games', [GameController::class, 'index']);

    // Legacy list endpoint (kept for backward compatibility with existing frontend)
    Route::apiResource('gamesessions', GameSessionController::class)->only(['index']);

    // New sessions API
    Route::controller(GameSessionController::class)->group(function () {
        Route::get('game-sessions', 'myIndex');
        Route::post('game-sessions/join', 'joinByCode');
        Route::post('game-sessions', 'store');
        Route::get('game-sessions/{id}', 'show');
        Route::post('game-sessions/{id}/join', 'join');
        Route::post('game-sessions/{id}/leave', 'leave');
        Route::post('game-sessions/{id}/ready', 'ready');
        Route::post('game-sessions/{id}/start', 'start');
        Route::post('game-sessions/{id}/moves', 'move');
    });
});
