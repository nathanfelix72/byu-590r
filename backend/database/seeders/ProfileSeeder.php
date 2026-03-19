<?php

namespace Database\Seeders;

use App\Models\Profile;
use App\Models\User;
use Illuminate\Database\Seeder;

class ProfileSeeder extends Seeder
{
    public function run(): void
    {
        User::query()->select(['id'])->chunk(200, function ($users) {
            foreach ($users as $user) {
                Profile::updateOrCreate(
                    ['user_id' => $user->id],
                    ['wins' => 0, 'losses' => 0]
                );
            }
        });
    }
}

