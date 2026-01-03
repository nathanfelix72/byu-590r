<?php

namespace App\Providers;

use Illuminate\Console\Scheduling\Schedule;
use Illuminate\Support\ServiceProvider;

class AppServiceProvider extends ServiceProvider
{
    /**
     * Register any application services.
     */
    public function register(): void
    {
        //
    }

    /**
     * Bootstrap any application services.
     */
    public function boot(): void
    {
        $this->app->booted(function () {
            $schedule = $this->app->make(Schedule::class);
            // Schedule overdue books email - change frequency as needed (currently every minute for testing)
            $schedule->command('auto:overdue-books --email=johnchristiansen@gmail.com')
                ->everyMinute();
                // ->weekly(); // Uncomment for production
        });
    }
}
