<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('game_session_details', function (Blueprint $table) {
            $table->id();
            $table->foreignId('game_session_id')->constrained('game_sessions')->cascadeOnDelete()->unique();
            $table->text('notes')->nullable();
            $table->unsignedTinyInteger('max_players_cap')->nullable();
            $table->timestamps();
        });

        // Backfill one detail row per existing session (1:1)
        $ids = DB::table('game_sessions')->pluck('id');
        foreach ($ids as $id) {
            DB::table('game_session_details')->insert([
                'game_session_id' => $id,
                'notes' => null,
                'max_players_cap' => null,
                'created_at' => now(),
                'updated_at' => now(),
            ]);
        }
    }

    public function down(): void
    {
        Schema::dropIfExists('game_session_details');
    }
};
