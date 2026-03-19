<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('user_game_sessions', function (Blueprint $table) {
            $table->id();
            $table->foreignId('user_id')->constrained('users')->cascadeOnDelete();
            $table->foreignId('game_session_id')->constrained('game_sessions')->cascadeOnDelete();
            $table->unsignedInteger('seat')->nullable(); // turn order index
            $table->integer('score')->default(0);
            $table->boolean('is_ready')->default(false);
            $table->boolean('is_ai')->default(false); // phase 2
            $table->timestamp('left_at')->nullable();
            $table->timestamps();

            $table->unique(['user_id', 'game_session_id']);
            $table->index(['game_session_id', 'seat']);
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('user_game_sessions');
    }
};

