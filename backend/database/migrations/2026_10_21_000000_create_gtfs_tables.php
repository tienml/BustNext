<?php

declare(strict_types=1);

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration {
    public function up(): void
    {
        Schema::create('datasets', function (Blueprint $table): void {
            $table->id();
            $table->string('slug')->unique();
            $table->string('name');
            $table->string('timezone')->default('Asia/Ho_Chi_Minh');
            $table->foreignId('active_version_id')->nullable();
            $table->timestamps();
        });

        Schema::create('dataset_versions', function (Blueprint $table): void {
            $table->id();
            $table->foreignId('dataset_id')->constrained()->cascadeOnDelete();
            $table->unsignedInteger('version_number');
            $table->string('label')->nullable();
            $table->string('status')->default('pending');
            $table->string('source_filename')->nullable();
            $table->string('sha256', 64)->nullable();
            $table->string('timezone')->default('Asia/Ho_Chi_Minh');
            $table->json('stats')->nullable();
            $table->unsignedInteger('error_count')->default(0);
            $table->unsignedInteger('warning_count')->default(0);
            $table->foreignId('imported_by')->nullable();
            $table->timestampTz('activated_at')->nullable();
            $table->timestampTz('imported_at')->nullable();
            $table->timestamps();
            $table->unique(['dataset_id', 'version_number']);
            $table->index(['dataset_id', 'status']);
        });

        Schema::table('datasets', function (Blueprint $table): void {
            $table->foreign('active_version_id')->references('id')->on('dataset_versions')->nullOnDelete();
        });

        Schema::create('validation_errors', function (Blueprint $table): void {
            $table->id();
            $table->foreignId('dataset_version_id')->constrained()->cascadeOnDelete();
            $table->string('file_name');
            $table->unsignedInteger('row_number')->default(0);
            $table->string('column_name')->nullable();
            $table->string('code');
            $table->string('severity')->default('error');
            $table->text('message');
            $table->text('value')->nullable();
            $table->timestamps();
            $table->index(['dataset_version_id', 'severity']);
        });

        $this->createGtfsTables();
    }

    private function createGtfsTables(): void
    {
        Schema::create('agencies', function (Blueprint $table): void {
            $table->id(); $table->foreignId('dataset_version_id')->constrained()->cascadeOnDelete();
            $table->string('agency_id'); $table->string('name'); $table->string('timezone'); $table->timestamps();
            $table->unique(['dataset_version_id', 'agency_id']);
        });
        Schema::create('routes', function (Blueprint $table): void {
            $table->id(); $table->foreignId('dataset_version_id')->constrained()->cascadeOnDelete();
            $table->string('route_id'); $table->foreignId('agency_id')->nullable(); $table->string('short_name')->nullable(); $table->string('long_name')->nullable(); $table->unsignedSmallInteger('route_type')->nullable(); $table->timestamps();
            $table->unique(['dataset_version_id', 'route_id']);
        });
        Schema::create('stops', function (Blueprint $table): void {
            $table->id(); $table->foreignId('dataset_version_id')->constrained()->cascadeOnDelete();
            $table->string('stop_id'); $table->string('code')->nullable(); $table->string('name'); $table->decimal('lat', 9, 6)->nullable(); $table->decimal('lon', 9, 6)->nullable(); $table->timestamps();
            $table->unique(['dataset_version_id', 'stop_id']);
        });
        Schema::create('calendar_services', function (Blueprint $table): void {
            $table->id(); $table->foreignId('dataset_version_id')->constrained()->cascadeOnDelete();
            $table->string('service_id'); $table->date('start_date'); $table->date('end_date');
            foreach (['monday','tuesday','wednesday','thursday','friday','saturday','sunday'] as $day) $table->boolean($day)->default(false);
            $table->timestamps(); $table->unique(['dataset_version_id', 'service_id']);
        });
        Schema::create('calendar_dates', function (Blueprint $table): void {
            $table->id(); $table->foreignId('dataset_version_id')->constrained()->cascadeOnDelete();
            $table->string('service_id'); $table->date('date'); $table->unsignedTinyInteger('exception_type'); $table->timestamps();
            $table->unique(['dataset_version_id', 'service_id', 'date']); $table->index(['dataset_version_id', 'date']);
        });
        Schema::create('trips', function (Blueprint $table): void {
            $table->id(); $table->foreignId('dataset_version_id')->constrained()->cascadeOnDelete();
            $table->string('trip_id'); $table->string('route_id'); $table->string('service_id'); $table->string('headsign')->nullable(); $table->unsignedTinyInteger('direction_id')->nullable(); $table->timestamps();
            $table->unique(['dataset_version_id', 'trip_id']);
        });
        Schema::create('stop_times', function (Blueprint $table): void {
            $table->id(); $table->foreignId('dataset_version_id')->constrained()->cascadeOnDelete();
            $table->string('trip_id'); $table->string('stop_id'); $table->unsignedInteger('arrival_seconds'); $table->unsignedInteger('departure_seconds'); $table->string('arrival_raw'); $table->string('departure_raw'); $table->unsignedInteger('stop_sequence'); $table->timestamps();
            $table->unique(['dataset_version_id', 'trip_id', 'stop_sequence']);
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('stop_times'); Schema::dropIfExists('trips'); Schema::dropIfExists('calendar_dates'); Schema::dropIfExists('calendar_services'); Schema::dropIfExists('stops'); Schema::dropIfExists('routes'); Schema::dropIfExists('agencies'); Schema::dropIfExists('validation_errors'); Schema::table('datasets', fn (Blueprint $table) => $table->dropForeign(['active_version_id'])); Schema::dropIfExists('dataset_versions'); Schema::dropIfExists('datasets');
    }
};
