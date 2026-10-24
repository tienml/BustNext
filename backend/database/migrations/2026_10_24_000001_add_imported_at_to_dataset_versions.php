<?php

declare(strict_types=1);

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration {
    public function up(): void
    {
        if (!Schema::hasColumn('dataset_versions', 'imported_at')) {
            Schema::table('dataset_versions', function (Blueprint $table): void {
                $table->timestampTz('imported_at')->nullable()->after('activated_at');
            });
        }
    }

    public function down(): void
    {
        if (Schema::hasColumn('dataset_versions', 'imported_at')) {
            Schema::table('dataset_versions', function (Blueprint $table): void {
                $table->dropColumn('imported_at');
            });
        }
    }
};
