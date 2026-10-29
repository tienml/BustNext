<?php

declare(strict_types=1);

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

/**
 * Sample queries an operator saves once and re-runs after every activation,
 * so a schedule switch can be checked against known answers.
 */
return new class extends Migration {
    public function up(): void
    {
        Schema::create('saved_queries', function (Blueprint $table): void {
            $table->id();
            $table->foreignId('dataset_id')->constrained()->cascadeOnDelete();
            $table->string('name', 120);
            $table->string('type', 30);
            $table->json('params');
            $table->timestampTz('last_run_at')->nullable();
            $table->foreignId('last_version_id')->nullable()->constrained('dataset_versions')->nullOnDelete();
            $table->unsignedSmallInteger('last_status')->nullable();
            $table->unsignedInteger('last_result_count')->nullable();
            $table->timestamps();
            $table->index('dataset_id');
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('saved_queries');
    }
};
