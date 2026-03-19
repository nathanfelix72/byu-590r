<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('game_sessions', function (Blueprint $table) {
            if (!Schema::hasColumn('game_sessions', 'game_id')) {
                $table->foreignId('game_id')->nullable()->after('id')->constrained('games')->nullOnDelete();
            }
            if (!Schema::hasColumn('game_sessions', 'host_user_id')) {
                $table->foreignId('host_user_id')->nullable()->after('game_id')->constrained('users')->nullOnDelete();
            }
            if (!Schema::hasColumn('game_sessions', 'join_code')) {
                $table->string('join_code', 12)->nullable()->unique()->after('current_turn');
            }
            if (!Schema::hasColumn('game_sessions', 'state')) {
                $table->json('state')->nullable()->after('join_code');
            }
            if (!Schema::hasColumn('game_sessions', 'version')) {
                $table->unsignedInteger('version')->default(0)->after('state');
            }
        });
    }

    public function down(): void
    {
        Schema::table('game_sessions', function (Blueprint $table) {
            if (Schema::hasColumn('game_sessions', 'version')) {
                $table->dropColumn('version');
            }
            if (Schema::hasColumn('game_sessions', 'state')) {
                $table->dropColumn('state');
            }
            if (Schema::hasColumn('game_sessions', 'join_code')) {
                $table->dropUnique(['join_code']);
                $table->dropColumn('join_code');
            }
            if (Schema::hasColumn('game_sessions', 'host_user_id')) {
                $table->dropConstrainedForeignId('host_user_id');
            }
            if (Schema::hasColumn('game_sessions', 'game_id')) {
                $table->dropConstrainedForeignId('game_id');
            }
        });
    }
};

