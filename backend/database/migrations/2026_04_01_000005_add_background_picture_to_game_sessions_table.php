<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('game_sessions', function (Blueprint $table) {
            if (!Schema::hasColumn('game_sessions', 'game_session_background_picture')) {
                $table->string('game_session_background_picture')->nullable()->after('game_session_cover_picture');
            }
        });
    }

    public function down(): void
    {
        Schema::table('game_sessions', function (Blueprint $table) {
            if (Schema::hasColumn('game_sessions', 'game_session_background_picture')) {
                $table->dropColumn('game_session_background_picture');
            }
        });
    }
};
