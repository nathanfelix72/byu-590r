<?php

use App\Http\Controllers\Api\BookController;
use App\Http\Controllers\Api\HelloWorldController;
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
    Route::get('verify_email', 'verifyEmail');
});

// Protected routes
Route::middleware(\App\Http\Middleware\AuthenticateApi::class)->group(function () {
    Route::controller(UserController::class)->group(function () {
        Route::get('user', 'getUser');
        Route::post('user/upload_avatar', 'uploadAvatar');
        Route::delete('user/remove_avatar', 'removeAvatar');
        Route::post('user/send_verification_email', 'sendVerificationEmail');
        Route::post('user/change_email', 'changeEmail');
    });

    Route::resource('books', BookController::class);
    Route::controller(BookController::class)->group(function () {
        Route::post('books/{id}/checkout', 'checkoutBook');
        Route::patch('books/{id}/return', 'returnBook');
        Route::post('books/{id}/update_book_picture', 'updateBookPicture');
        Route::post('send_book_report', 'sendBookReport');
    });
});
