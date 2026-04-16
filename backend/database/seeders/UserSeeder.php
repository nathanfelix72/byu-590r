<?php

namespace Database\Seeders;

use App\Models\User;
use Carbon\Carbon;
use Illuminate\Database\Seeder;

class UserSeeder extends Seeder
{
    /**
     * Run the database seeds.
     *
     * @return void
     */
    public function run()
    {
        // Use updateOrCreate to avoid duplicate email errors
        User::updateOrCreate(
            ['email' => 'nathan.felix@gmail.com'], // Check if this email exists
            [
                'name' => 'Nathan Felix',
                'email' => 'nathan.felix@gmail.com',
                'email_verified_at' => null,
                'password' => bcrypt('securepassword123'),
                'created_at' => Carbon::now(),
                'updated_at' => Carbon::now(),
            ]
        );

        // Pre-seeded account for course grading (submit this email + password in your deliverable).
        User::updateOrCreate(
            ['email' => 'byu590r.grader@example.com'],
            [
                'name' => 'BYU 590R Grader',
                'email' => 'byu590r.grader@example.com',
                'email_verified_at' => null,
                'password' => bcrypt('Byu590rGrader!2026'),
                'created_at' => Carbon::now(),
                'updated_at' => Carbon::now(),
            ]
        );
    }
}