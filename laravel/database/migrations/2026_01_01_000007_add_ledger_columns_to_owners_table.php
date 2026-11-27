<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration {
    public function up(): void
    {
        if (Schema::hasTable('owners')) {
            Schema::table('owners', function (Blueprint $table) {
                if (!Schema::hasColumn('owners', 'invested')) {
                    $table->decimal('invested', 15, 2)->default(0.00)->after('share_percent');
                }
                if (!Schema::hasColumn('owners', 'withdrawn')) {
                    $table->decimal('withdrawn', 15, 2)->default(0.00)->after('invested');
                }
            });
        }
    }

    public function down(): void
    {
        if (Schema::hasTable('owners')) {
            Schema::table('owners', function (Blueprint $table) {
                $cols = array_values(array_filter(['invested', 'withdrawn'], fn ($c) => Schema::hasColumn('owners', $c)));
                if (!empty($cols)) {
                    $table->dropColumn($cols);
                }
            });
        }
    }
};
