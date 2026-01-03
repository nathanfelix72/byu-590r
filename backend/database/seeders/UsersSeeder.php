<?php

namespace Database\Seeders;

use App\Models\User;
use Carbon\Carbon;
use Illuminate\Database\Console\Seeds\WithoutModelEvents;
use Illuminate\Database\Seeder;

class UsersSeeder extends Seeder
{
    /**
     * Run the database seeds.
     *
     * @return void
     */
    public function run()
    {
       
        $userData = [
            'name' => 'John Christiansen',
            'email' => 'johnchristiansen@gmail.com',
            'email_verified_at' => Carbon::now(),
            'avatar' => null,
            'password' => bcrypt('trees243'),
        ];
        
        User::updateOrCreate(
            ['email' => 'johnchristiansen@gmail.com'],
            $userData
        );
        
    }
}

