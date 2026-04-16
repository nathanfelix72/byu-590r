<?php

namespace Database\Seeders;

use App\Models\Tag;
use Illuminate\Database\Seeder;
use Illuminate\Support\Str;

class TagSeeder extends Seeder
{
    public function run(): void
    {
        $tags = [
            'Competitive',
            'Casual',
            'Family-friendly',
            'Tournament',
            'Speed',
            'Late night',
        ];

        foreach ($tags as $name) {
            $slug = Str::slug($name);
            Tag::updateOrCreate(
                ['slug' => $slug],
                ['name' => $name]
            );
        }
    }
}
