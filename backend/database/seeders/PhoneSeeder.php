<?php

namespace Database\Seeders;

use Illuminate\Database\Console\Seeds\WithoutModelEvents;
use Illuminate\Database\Seeder;
use App\Models\Phone;

class PhoneSeeder extends Seeder
{
    /**
     * Run the database seeds.
     *
     * @return void
     */
    public function run()
    {
        Phone::updateOrCreate(
            ['phone_number' => '8011112222'],
            ['type' => 'Mobile']
        );

        Phone::updateOrCreate(
            ['phone_number' => '8011113333'],
            ['type' => 'Work']
        );
    }
}

