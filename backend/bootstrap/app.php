<?php

use Illuminate\Foundation\Application;
use Illuminate\Foundation\Configuration\Exceptions;
use Illuminate\Foundation\Configuration\Middleware;

return Application::configure(basePath: dirname(__DIR__))
    ->withRouting(
        web: __DIR__.'/../routes/web.php',
        api: __DIR__.'/../routes/api.php',
        apiPrefix: 'api',
        commands: __DIR__.'/../routes/console.php',
        health: '/up',
    )
    ->withBroadcasting(
        __DIR__.'/../routes/channels.php',
        ['middleware' => [\App\Http\Middleware\CorsMiddleware::class, \App\Http\Middleware\AuthenticateApi::class]]
    )
    ->withMiddleware(function (Middleware $middleware): void {
        // Apply CORS globally so non-API routes like /broadcasting/auth also include headers.
        $middleware->append(\App\Http\Middleware\CorsMiddleware::class);

        $middleware->api(prepend: [
            \App\Http\Middleware\CorsMiddleware::class,
        ]);
    })
    ->withExceptions(function (Exceptions $exceptions): void {
        //
    })->create();
