<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('user_game_sessions', function (Blueprint $table) {
            $table->boolean('chat_muted')->default(false)->after('is_ai');
        });
    }

    public function down(): void
    {
        Schema::table('user_game_sessions', function (Blueprint $table) {
            $table->dropColumn('chat_muted');
        });
    }
};
