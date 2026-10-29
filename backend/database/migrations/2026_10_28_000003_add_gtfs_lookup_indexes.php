<?php

declare(strict_types=1);

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration {
    public function up(): void
    {
        $indexes = [
            'routes' => [
                ['dataset_version_id', 'long_name'],
                ['dataset_version_id', 'short_name'],
            ],
            'stops' => [
                ['dataset_version_id', 'name'],
                ['dataset_version_id', 'code'],
            ],
            'trips' => [
                ['dataset_version_id', 'route_id'],
                ['dataset_version_id', 'service_id'],
                ['dataset_version_id', 'route_id', 'service_id'],
            ],
            'stop_times' => [
                ['dataset_version_id', 'stop_id', 'departure_seconds'],
                ['dataset_version_id', 'trip_id', 'stop_id', 'stop_sequence'],
            ],
        ];

        foreach ($indexes as $tableName => $columns) {
            Schema::table($tableName, function (Blueprint $table) use ($tableName, $columns): void {
                foreach ($columns as $columnList) {
                    $indexName = $tableName . '_' . implode('_', $columnList) . '_index';
                    if (!Schema::hasIndex($tableName, $indexName)) {
                        $table->index($columnList, $indexName);
                    }
                }
            });
        }
    }

    public function down(): void
    {
        $indexNames = [
            'routes' => [
                'routes_dataset_version_id_long_name_index',
                'routes_dataset_version_id_short_name_index',
            ],
            'stops' => [
                'stops_dataset_version_id_name_index',
                'stops_dataset_version_id_code_index',
            ],
            'trips' => [
                'trips_dataset_version_id_route_id_index',
                'trips_dataset_version_id_service_id_index',
                'trips_dataset_version_id_route_id_service_id_index',
            ],
            'stop_times' => [
                'stop_times_dataset_version_id_stop_id_departure_seconds_index',
                'stop_times_dataset_version_id_trip_id_stop_id_stop_sequence_index',
            ],
        ];

        foreach ($indexNames as $tableName => $names) {
            Schema::table($tableName, function (Blueprint $table) use ($names): void {
                foreach ($names as $indexName) {
                    $table->dropIndex($indexName);
                }
            });
        }
    }
};
