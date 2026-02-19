<?php

namespace Database\Seeders;

use Carbon\Carbon;
use Illuminate\Database\Seeder;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Hash;

class UserSeeder extends Seeder
{
    /**
     * Run the database seeds.
     *
     * @return void
     */
    public function run()
    {
        // Insert user data directly into the database
        DB::table('users')->insert([
            'name' => 'Nathan Felix',
            'email' => 'nathan.felix@gmail.com',
            'email_verified_at' => null,
            'password' => bcrypt('securepassword123'),
            'created_at' => Carbon::now(),
            'updated_at' => Carbon::now(),
        ]);
    }
}