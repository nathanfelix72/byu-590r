<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    /**
     * Run the migrations.
     */
    public function up(): void
    {
        Schema::table('game_sessions', function (Blueprint $table) {
            if (!Schema::hasColumn('game_sessions', 'status')) {
                $table->string('status')->default('waiting')->after('game_session_cover_picture');
            }
            if (!Schema::hasColumn('game_sessions', 'current_turn')) {
                $table->unsignedInteger('current_turn')->nullable()->after('status');
            }
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::table('game_sessions', function (Blueprint $table) {
            $cols = array_filter(['status', 'current_turn'], function ($col) {
                return Schema::hasColumn('game_sessions', $col);
            });
            if (!empty($cols)) {
                $table->dropColumn($cols);
            }
        });
    }
};
