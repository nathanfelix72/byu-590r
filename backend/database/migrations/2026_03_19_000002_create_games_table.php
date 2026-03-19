<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('games', function (Blueprint $table) {
            $table->id();
            $table->string('key')->unique(); // e.g. "uno"
            $table->string('name');          // e.g. "Uno"
            $table->string('rules_version')->default('v1');
            $table->unsignedInteger('min_players')->default(2);
            $table->unsignedInteger('max_players')->default(4);
            $table->timestamps();
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('games');
    }
};

