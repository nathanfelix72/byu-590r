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
    }
}