-- =====================================================
-- BusFast/BusMap Complete PostgreSQL Schema
-- Backend: PHP Laravel 11 + PostgreSQL 16 + Redis 7
-- =====================================================

-- Enable required extensions
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "postgis";

-- =====================================================
-- PART 1: DATASET VERSION MANAGEMENT
-- =====================================================

CREATE TABLE datasets (
    id BIGSERIAL PRIMARY KEY,
    name VARCHAR(255) NOT NULL,
    slug VARCHAR(255) NOT NULL UNIQUE,
    description TEXT,
    source_url TEXT,
    metadata JSONB DEFAULT '{}',
    created_at TIMESTAMP(0) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP(0) NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_datasets_slug ON datasets(slug);
CREATE INDEX idx_datasets_created_at ON datasets(created_at DESC);

CREATE TABLE dataset_versions (
    id BIGSERIAL PRIMARY KEY,
    dataset_id BIGINT NOT NULL REFERENCES datasets(id) ON DELETE CASCADE,
    version_number VARCHAR(50) NOT NULL,
    status VARCHAR(20) NOT NULL DEFAULT 'pending',
    -- Status: pending, validating, failed, ready, active, archived
    source_file_path TEXT,
    source_file_hash VARCHAR(64),
    imported_at TIMESTAMP(0),
    activated_at TIMESTAMP(0),
    archived_at TIMESTAMP(0),
    metadata JSONB DEFAULT '{}',
    error_summary TEXT,
    created_at TIMESTAMP(0) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP(0) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT chk_status CHECK (status IN ('pending', 'validating', 'failed', 'ready', 'active', 'archived')),
    CONSTRAINT uq_dataset_version UNIQUE (dataset_id, version_number)
);

CREATE INDEX idx_dataset_versions_dataset_id ON dataset_versions(dataset_id);
CREATE INDEX idx_dataset_versions_status ON dataset_versions(status);
CREATE INDEX idx_dataset_versions_activated_at ON dataset_versions(activated_at DESC) WHERE activated_at IS NOT NULL;

CREATE TABLE validation_errors (
    id BIGSERIAL PRIMARY KEY,
    dataset_version_id BIGINT NOT NULL REFERENCES dataset_versions(id) ON DELETE CASCADE,
    file_name VARCHAR(255) NOT NULL,
    row_number INTEGER,
    field_name VARCHAR(255),
    error_type VARCHAR(50) NOT NULL,
    -- Types: missing_required, invalid_format, invalid_reference, duplicate, constraint_violation
    error_message TEXT NOT NULL,
    severity VARCHAR(20) NOT NULL DEFAULT 'error',
    -- Severity: error, warning, info
    context JSONB DEFAULT '{}',
    created_at TIMESTAMP(0) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT chk_severity CHECK (severity IN ('error', 'warning', 'info'))
);

CREATE INDEX idx_validation_errors_version ON validation_errors(dataset_version_id);
CREATE INDEX idx_validation_errors_severity ON validation_errors(dataset_version_id, severity);
CREATE INDEX idx_validation_errors_file ON validation_errors(dataset_version_id, file_name);

-- =====================================================
-- PART 2: GTFS STATIC DATA TABLES
-- =====================================================

-- Agency (agencies)
CREATE TABLE agencies (
    id BIGSERIAL PRIMARY KEY,
    dataset_version_id BIGINT NOT NULL REFERENCES dataset_versions(id) ON DELETE CASCADE,
    agency_id VARCHAR(255) NOT NULL,
    agency_name VARCHAR(255) NOT NULL,
    agency_url TEXT NOT NULL,
    agency_timezone VARCHAR(100) NOT NULL,
    agency_lang VARCHAR(10),
    agency_phone VARCHAR(50),
    agency_fare_url TEXT,
    agency_email VARCHAR(255),
    created_at TIMESTAMP(0) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP(0) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT uq_version_agency UNIQUE (dataset_version_id, agency_id)
);

CREATE INDEX idx_agencies_version ON agencies(dataset_version_id);
CREATE INDEX idx_agencies_agency_id ON agencies(dataset_version_id, agency_id);

-- Routes
CREATE TABLE routes (
    id BIGSERIAL PRIMARY KEY,
    dataset_version_id BIGINT NOT NULL REFERENCES dataset_versions(id) ON DELETE CASCADE,
    route_id VARCHAR(255) NOT NULL,
    agency_id VARCHAR(255),
    route_short_name VARCHAR(50),
    route_long_name VARCHAR(255),
    route_desc TEXT,
    route_type INTEGER NOT NULL,
    route_url TEXT,
    route_color VARCHAR(6),
    route_text_color VARCHAR(6),
    route_sort_order INTEGER,
    created_at TIMESTAMP(0) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP(0) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT uq_version_route UNIQUE (dataset_version_id, route_id)
);

CREATE INDEX idx_routes_version ON routes(dataset_version_id);
CREATE INDEX idx_routes_route_id ON routes(dataset_version_id, route_id);
CREATE INDEX idx_routes_type ON routes(dataset_version_id, route_type);
CREATE INDEX idx_routes_short_name ON routes(dataset_version_id, route_short_name);

-- Stops
CREATE TABLE stops (
    id BIGSERIAL PRIMARY KEY,
    dataset_version_id BIGINT NOT NULL REFERENCES dataset_versions(id) ON DELETE CASCADE,
    stop_id VARCHAR(255) NOT NULL,
    stop_code VARCHAR(50),
    stop_name VARCHAR(255) NOT NULL,
    stop_desc TEXT,
    stop_lat DECIMAL(10, 8) NOT NULL,
    stop_lon DECIMAL(11, 8) NOT NULL,
    stop_location GEOGRAPHY(POINT, 4326),
    zone_id VARCHAR(255),
    stop_url TEXT,
    location_type INTEGER DEFAULT 0,
    parent_station VARCHAR(255),
    stop_timezone VARCHAR(100),
    wheelchair_boarding INTEGER,
    level_id VARCHAR(255),
    platform_code VARCHAR(50),
    created_at TIMESTAMP(0) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP(0) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT uq_version_stop UNIQUE (dataset_version_id, stop_id),
    CONSTRAINT chk_stop_lat CHECK (stop_lat BETWEEN -90 AND 90),
    CONSTRAINT chk_stop_lon CHECK (stop_lon BETWEEN -180 AND 180)
);

CREATE INDEX idx_stops_version ON stops(dataset_version_id);
CREATE INDEX idx_stops_stop_id ON stops(dataset_version_id, stop_id);
CREATE INDEX idx_stops_location ON stops USING GIST (stop_location);
CREATE INDEX idx_stops_parent_station ON stops(dataset_version_id, parent_station) WHERE parent_station IS NOT NULL;
CREATE INDEX idx_stops_name ON stops(dataset_version_id, stop_name);

-- Trips
CREATE TABLE trips (
    id BIGSERIAL PRIMARY KEY,
    dataset_version_id BIGINT NOT NULL REFERENCES dataset_versions(id) ON DELETE CASCADE,
    trip_id VARCHAR(255) NOT NULL,
    route_id VARCHAR(255) NOT NULL,
    service_id VARCHAR(255) NOT NULL,
    trip_headsign VARCHAR(255),
    trip_short_name VARCHAR(50),
    direction_id INTEGER,
    block_id VARCHAR(255),
    shape_id VARCHAR(255),
    wheelchair_accessible INTEGER,
    bikes_allowed INTEGER,
    created_at TIMESTAMP(0) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP(0) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT uq_version_trip UNIQUE (dataset_version_id, trip_id),
    CONSTRAINT chk_direction_id CHECK (direction_id IN (0, 1))
);

CREATE INDEX idx_trips_version ON trips(dataset_version_id);
CREATE INDEX idx_trips_trip_id ON trips(dataset_version_id, trip_id);
CREATE INDEX idx_trips_route_id ON trips(dataset_version_id, route_id);
CREATE INDEX idx_trips_service_id ON trips(dataset_version_id, service_id);
CREATE INDEX idx_trips_shape_id ON trips(dataset_version_id, shape_id) WHERE shape_id IS NOT NULL;

-- Stop Times
CREATE TABLE stop_times (
    id BIGSERIAL PRIMARY KEY,
    dataset_version_id BIGINT NOT NULL REFERENCES dataset_versions(id) ON DELETE CASCADE,
    trip_id VARCHAR(255) NOT NULL,
    stop_id VARCHAR(255) NOT NULL,
    stop_sequence INTEGER NOT NULL,
    arrival_seconds INTEGER NOT NULL,
    departure_seconds INTEGER NOT NULL,
    stop_headsign VARCHAR(255),
    pickup_type INTEGER DEFAULT 0,
    drop_off_type INTEGER DEFAULT 0,
    shape_dist_traveled DECIMAL(10, 2),
    timepoint INTEGER DEFAULT 1,
    created_at TIMESTAMP(0) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP(0) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT chk_arrival_seconds CHECK (arrival_seconds >= 0 AND arrival_seconds < 172800),
    CONSTRAINT chk_departure_seconds CHECK (departure_seconds >= 0 AND departure_seconds < 172800),
    CONSTRAINT chk_stop_sequence CHECK (stop_sequence >= 0)
);

CREATE INDEX idx_stop_times_version ON stop_times(dataset_version_id);
CREATE INDEX idx_stop_times_trip_id ON stop_times(dataset_version_id, trip_id);
CREATE INDEX idx_stop_times_stop_id ON stop_times(dataset_version_id, stop_id);
CREATE INDEX idx_stop_times_departure ON stop_times(dataset_version_id, stop_id, departure_seconds);
CREATE INDEX idx_stop_times_sequence ON stop_times(dataset_version_id, trip_id, stop_sequence);

-- Calendar Services
CREATE TABLE calendar_services (
    id BIGSERIAL PRIMARY KEY,
    dataset_version_id BIGINT NOT NULL REFERENCES dataset_versions(id) ON DELETE CASCADE,
    service_id VARCHAR(255) NOT NULL,
    monday BOOLEAN NOT NULL DEFAULT FALSE,
    tuesday BOOLEAN NOT NULL DEFAULT FALSE,
    wednesday BOOLEAN NOT NULL DEFAULT FALSE,
    thursday BOOLEAN NOT NULL DEFAULT FALSE,
    friday BOOLEAN NOT NULL DEFAULT FALSE,
    saturday BOOLEAN NOT NULL DEFAULT FALSE,
    sunday BOOLEAN NOT NULL DEFAULT FALSE,
    start_date DATE NOT NULL,
    end_date DATE NOT NULL,
    created_at TIMESTAMP(0) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP(0) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT uq_version_service UNIQUE (dataset_version_id, service_id),
    CONSTRAINT chk_date_range CHECK (end_date >= start_date)
);

CREATE INDEX idx_calendar_services_version ON calendar_services(dataset_version_id);
CREATE INDEX idx_calendar_services_service_id ON calendar_services(dataset_version_id, service_id);
CREATE INDEX idx_calendar_services_dates ON calendar_services(dataset_version_id, start_date, end_date);

-- Calendar Dates (Exceptions)
CREATE TABLE calendar_dates (
    id BIGSERIAL PRIMARY KEY,
    dataset_version_id BIGINT NOT NULL REFERENCES dataset_versions(id) ON DELETE CASCADE,
    service_id VARCHAR(255) NOT NULL,
    date DATE NOT NULL,
    exception_type INTEGER NOT NULL,
    -- 1 = added, 2 = removed
    created_at TIMESTAMP(0) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP(0) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT chk_exception_type CHECK (exception_type IN (1, 2)),
    CONSTRAINT uq_version_service_date UNIQUE (dataset_version_id, service_id, date)
);

CREATE INDEX idx_calendar_dates_version ON calendar_dates(dataset_version_id);
CREATE INDEX idx_calendar_dates_service_id ON calendar_dates(dataset_version_id, service_id);
CREATE INDEX idx_calendar_dates_date ON calendar_dates(dataset_version_id, date);
CREATE INDEX idx_calendar_dates_lookup ON calendar_dates(dataset_version_id, service_id, date);

-- Shapes
CREATE TABLE shapes (
    id BIGSERIAL PRIMARY KEY,
    dataset_version_id BIGINT NOT NULL REFERENCES dataset_versions(id) ON DELETE CASCADE,
    shape_id VARCHAR(255) NOT NULL,
    shape_pt_lat DECIMAL(10, 8) NOT NULL,
    shape_pt_lon DECIMAL(11, 8) NOT NULL,
    shape_pt_sequence INTEGER NOT NULL,
    shape_dist_traveled DECIMAL(10, 2),
    shape_point GEOGRAPHY(POINT, 4326),
    created_at TIMESTAMP(0) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP(0) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT chk_shape_pt_lat CHECK (shape_pt_lat BETWEEN -90 AND 90),
    CONSTRAINT chk_shape_pt_lon CHECK (shape_pt_lon BETWEEN -180 AND 180)
);

CREATE INDEX idx_shapes_version ON shapes(dataset_version_id);
CREATE INDEX idx_shapes_shape_id ON shapes(dataset_version_id, shape_id, shape_pt_sequence);
CREATE INDEX idx_shapes_location ON shapes USING GIST (shape_point);

-- =====================================================
-- PART 3: REALTIME OPERATIONS TABLES
-- =====================================================

-- Traffic Incidents
CREATE TABLE traffic_incidents (
    id BIGSERIAL PRIMARY KEY,
    incident_id UUID NOT NULL DEFAULT uuid_generate_v4(),
    title VARCHAR(255) NOT NULL,
    description TEXT,
    incident_type VARCHAR(50) NOT NULL,
    -- Types: accident, congestion, road_closed, construction, weather, event, other
    severity VARCHAR(20) NOT NULL DEFAULT 'moderate',
    -- Severity: low, moderate, high, critical
    location_lat DECIMAL(10, 8) NOT NULL,
    location_lon DECIMAL(11, 8) NOT NULL,
    location_point GEOGRAPHY(POINT, 4326),
    affected_routes JSONB DEFAULT '[]',
    affected_stops JSONB DEFAULT '[]',
    start_time TIMESTAMP(0) NOT NULL,
    end_time TIMESTAMP(0),
    estimated_delay_minutes INTEGER,
    status VARCHAR(20) NOT NULL DEFAULT 'active',
    -- Status: active, resolved, expired
    source VARCHAR(100),
    metadata JSONB DEFAULT '{}',
    created_at TIMESTAMP(0) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP(0) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT chk_incident_severity CHECK (severity IN ('low', 'moderate', 'high', 'critical')),
    CONSTRAINT chk_incident_status CHECK (status IN ('active', 'resolved', 'expired')),
    CONSTRAINT chk_location_lat CHECK (location_lat BETWEEN -90 AND 90),
    CONSTRAINT chk_location_lon CHECK (location_lon BETWEEN -180 AND 180)
);

CREATE UNIQUE INDEX idx_traffic_incidents_uuid ON traffic_incidents(incident_id);
CREATE INDEX idx_traffic_incidents_status ON traffic_incidents(status) WHERE status = 'active';
CREATE INDEX idx_traffic_incidents_location ON traffic_incidents USING GIST (location_point);
CREATE INDEX idx_traffic_incidents_time ON traffic_incidents(start_time, end_time);
CREATE INDEX idx_traffic_incidents_routes ON traffic_incidents USING GIN (affected_routes);

-- Detours (Alternate Routes)
CREATE TABLE detours (
    id BIGSERIAL PRIMARY KEY,
    detour_id UUID NOT NULL DEFAULT uuid_generate_v4(),
    incident_id BIGINT REFERENCES traffic_incidents(id) ON DELETE CASCADE,
    route_id VARCHAR(255) NOT NULL,
    dataset_version_id BIGINT NOT NULL REFERENCES dataset_versions(id) ON DELETE CASCADE,
    detour_name VARCHAR(255) NOT NULL,
    reason TEXT,
    original_path JSONB NOT NULL,
    -- Array of {stop_id, stop_sequence, lat, lon}
    detour_path JSONB NOT NULL,
    -- Array of {stop_id, stop_sequence, lat, lon}
    affected_stops JSONB DEFAULT '[]',
    start_time TIMESTAMP(0) NOT NULL,
    end_time TIMESTAMP(0),
    status VARCHAR(20) NOT NULL DEFAULT 'active',
    -- Status: scheduled, active, completed, cancelled
    metadata JSONB DEFAULT '{}',
    created_at TIMESTAMP(0) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP(0) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT chk_detour_status CHECK (status IN ('scheduled', 'active', 'completed', 'cancelled'))
);

CREATE UNIQUE INDEX idx_detours_uuid ON detours(detour_id);
CREATE INDEX idx_detours_incident ON detours(incident_id);
CREATE INDEX idx_detours_route ON detours(dataset_version_id, route_id);
CREATE INDEX idx_detours_status ON detours(status) WHERE status IN ('scheduled', 'active');
CREATE INDEX idx_detours_time ON detours(start_time, end_time);

-- Vehicles
CREATE TABLE vehicles (
    id BIGSERIAL PRIMARY KEY,
    vehicle_id VARCHAR(255) NOT NULL UNIQUE,
    dataset_version_id BIGINT NOT NULL REFERENCES dataset_versions(id) ON DELETE CASCADE,
    license_plate VARCHAR(50),
    vehicle_type VARCHAR(50),
    capacity INTEGER,
    wheelchair_accessible BOOLEAN DEFAULT FALSE,
    status VARCHAR(20) NOT NULL DEFAULT 'available',
    -- Status: available, in_service, maintenance, retired
    metadata JSONB DEFAULT '{}',
    created_at TIMESTAMP(0) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP(0) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT chk_vehicle_status CHECK (status IN ('available', 'in_service', 'maintenance', 'retired'))
);

CREATE INDEX idx_vehicles_vehicle_id ON vehicles(vehicle_id);
CREATE INDEX idx_vehicles_version ON vehicles(dataset_version_id);
CREATE INDEX idx_vehicles_status ON vehicles(status);

-- Vehicle Positions (Realtime Tracking)
CREATE TABLE vehicle_positions (
    id BIGSERIAL PRIMARY KEY,
    vehicle_id VARCHAR(255) NOT NULL,
    trip_id VARCHAR(255),
    route_id VARCHAR(255),
    dataset_version_id BIGINT NOT NULL REFERENCES dataset_versions(id) ON DELETE CASCADE,
    position_lat DECIMAL(10, 8) NOT NULL,
    position_lon DECIMAL(11, 8) NOT NULL,
    position_point GEOGRAPHY(POINT, 4326),
    bearing DECIMAL(5, 2),
    speed_kmh DECIMAL(5, 2),
    current_stop_sequence INTEGER,
    current_status VARCHAR(20),
    -- Status: incoming_at, stopped_at, in_transit_to
    timestamp TIMESTAMP(0) NOT NULL,
    detour_id BIGINT REFERENCES detours(id) ON DELETE SET NULL,
    -- NULL if on original route, references detour if on alternate route
    metadata JSONB DEFAULT '{}',
    created_at TIMESTAMP(0) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT chk_position_lat CHECK (position_lat BETWEEN -90 AND 90),
    CONSTRAINT chk_position_lon CHECK (position_lon BETWEEN -180 AND 180),
    CONSTRAINT chk_bearing CHECK (bearing IS NULL OR (bearing >= 0 AND bearing < 360)),
    CONSTRAINT chk_speed CHECK (speed_kmh IS NULL OR speed_kmh >= 0),
    CONSTRAINT chk_current_status CHECK (current_status IN ('incoming_at', 'stopped_at', 'in_transit_to'))
);

CREATE INDEX idx_vehicle_positions_vehicle ON vehicle_positions(vehicle_id, timestamp DESC);
CREATE INDEX idx_vehicle_positions_trip ON vehicle_positions(dataset_version_id, trip_id, timestamp DESC);
CREATE INDEX idx_vehicle_positions_location ON vehicle_positions USING GIST (position_point);
CREATE INDEX idx_vehicle_positions_timestamp ON vehicle_positions(timestamp DESC);
CREATE INDEX idx_vehicle_positions_detour ON vehicle_positions(detour_id) WHERE detour_id IS NOT NULL;

-- =====================================================
-- PART 4: USER-RELATED TABLES
-- =====================================================

-- Users (Laravel default structure)
CREATE TABLE users (
    id BIGSERIAL PRIMARY KEY,
    name VARCHAR(255) NOT NULL,
    email VARCHAR(255) NOT NULL UNIQUE,
    email_verified_at TIMESTAMP(0),
    password VARCHAR(255) NOT NULL,
    remember_token VARCHAR(100),
    created_at TIMESTAMP(0) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP(0) NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_users_email ON users(email);

-- Saved Queries (Favorite Searches)
CREATE TABLE saved_queries (
    id BIGSERIAL PRIMARY KEY,
    user_id BIGINT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    query_type VARCHAR(50) NOT NULL,
    -- Types: route_search, stop_search, trip_planning, nearby_stops
    query_name VARCHAR(255) NOT NULL,
    query_params JSONB NOT NULL,
    is_favorite BOOLEAN DEFAULT FALSE,
    use_count INTEGER DEFAULT 0,
    last_used_at TIMESTAMP(0),
    created_at TIMESTAMP(0) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP(0) NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_saved_queries_user ON saved_queries(user_id);
CREATE INDEX idx_saved_queries_type ON saved_queries(user_id, query_type);
CREATE INDEX idx_saved_queries_favorite ON saved_queries(user_id, is_favorite) WHERE is_favorite = TRUE;

-- Favorite Stops
CREATE TABLE favorite_stops (
    id BIGSERIAL PRIMARY KEY,
    user_id BIGINT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    dataset_version_id BIGINT NOT NULL REFERENCES dataset_versions(id) ON DELETE CASCADE,
    stop_id VARCHAR(255) NOT NULL,
    nickname VARCHAR(255),
    notification_enabled BOOLEAN DEFAULT FALSE,
    notification_minutes_before INTEGER,
    created_at TIMESTAMP(0) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP(0) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT uq_user_stop UNIQUE (user_id, dataset_version_id, stop_id)
);

CREATE INDEX idx_favorite_stops_user ON favorite_stops(user_id);
CREATE INDEX idx_favorite_stops_stop ON favorite_stops(dataset_version_id, stop_id);

-- Favorite Routes
CREATE TABLE favorite_routes (
    id BIGSERIAL PRIMARY KEY,
    user_id BIGINT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    dataset_version_id BIGINT NOT NULL REFERENCES dataset_versions(id) ON DELETE CASCADE,
    route_id VARCHAR(255) NOT NULL,
    nickname VARCHAR(255),
    notification_enabled BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMP(0) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP(0) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT uq_user_route UNIQUE (user_id, dataset_version_id, route_id)
);

CREATE INDEX idx_favorite_routes_user ON favorite_routes(user_id);
CREATE INDEX idx_favorite_routes_route ON favorite_routes(dataset_version_id, route_id);

-- =====================================================
-- PART 5: NOTIFICATIONS & FEEDBACK
-- =====================================================

-- Notifications
CREATE TABLE notifications (
    id BIGSERIAL PRIMARY KEY,
    user_id BIGINT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    notification_type VARCHAR(50) NOT NULL,
    -- Types: trip_delay, incident_alert, detour_alert, service_change, system_message
    title VARCHAR(255) NOT NULL,
    message TEXT NOT NULL,
    related_entity_type VARCHAR(50),
    related_entity_id BIGINT,
    priority VARCHAR(20) DEFAULT 'normal',
    -- Priority: low, normal, high, urgent
    is_read BOOLEAN DEFAULT FALSE,
    read_at TIMESTAMP(0),
    created_at TIMESTAMP(0) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT chk_notification_priority CHECK (priority IN ('low', 'normal', 'high', 'urgent'))
);

CREATE INDEX idx_notifications_user ON notifications(user_id, created_at DESC);
CREATE INDEX idx_notifications_unread ON notifications(user_id, is_read) WHERE is_read = FALSE;
CREATE INDEX idx_notifications_type ON notifications(user_id, notification_type);

-- Feedback
CREATE TABLE feedback (
    id BIGSERIAL PRIMARY KEY,
    user_id BIGINT REFERENCES users(id) ON DELETE SET NULL,
    feedback_type VARCHAR(50) NOT NULL,
    -- Types: bug_report, feature_request, data_issue, general_comment, route_issue, stop_issue
    subject VARCHAR(255) NOT NULL,
    description TEXT NOT NULL,
    related_entity_type VARCHAR(50),
    related_entity_id VARCHAR(255),
    screenshot_url TEXT,
    status VARCHAR(20) NOT NULL DEFAULT 'pending',
    -- Status: pending, in_review, resolved, closed
    admin_response TEXT,
    responded_at TIMESTAMP(0),
    created_at TIMESTAMP(0) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP(0) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT chk_feedback_status CHECK (status IN ('pending', 'in_review', 'resolved', 'closed'))
);

CREATE INDEX idx_feedback_user ON feedback(user_id);
CREATE INDEX idx_feedback_status ON feedback(status);
CREATE INDEX idx_feedback_type ON feedback(feedback_type);
CREATE INDEX idx_feedback_created ON feedback(created_at DESC);

-- =====================================================
-- PART 6: AUDIT & ANALYTICS
-- =====================================================

-- Audit Logs
CREATE TABLE audit_logs (
    id BIGSERIAL PRIMARY KEY,
    user_id BIGINT REFERENCES users(id) ON DELETE SET NULL,
    action VARCHAR(100) NOT NULL,
    entity_type VARCHAR(50) NOT NULL,
    entity_id BIGINT,
    old_values JSONB,
    new_values JSONB,
    ip_address VARCHAR(45),
    user_agent TEXT,
    created_at TIMESTAMP(0) NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_audit_logs_user ON audit_logs(user_id, created_at DESC);
CREATE INDEX idx_audit_logs_entity ON audit_logs(entity_type, entity_id);
CREATE INDEX idx_audit_logs_action ON audit_logs(action);
CREATE INDEX idx_audit_logs_created ON audit_logs(created_at DESC);

-- Search Analytics
CREATE TABLE search_analytics (
    id BIGSERIAL PRIMARY KEY,
    user_id BIGINT REFERENCES users(id) ON DELETE SET NULL,
    search_type VARCHAR(50) NOT NULL,
    search_query TEXT NOT NULL,
    search_params JSONB,
    results_count INTEGER,
    clicked_result_index INTEGER,
    session_id VARCHAR(255),
    created_at TIMESTAMP(0) NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_search_analytics_user ON search_analytics(user_id);
CREATE INDEX idx_search_analytics_type ON search_analytics(search_type);
CREATE INDEX idx_search_analytics_created ON search_analytics(created_at DESC);

-- =====================================================
-- PART 7: INTEGRATION TABLES (MoMo, GreenSM, Tickets)
-- =====================================================

-- Ticket Purchases
CREATE TABLE ticket_purchases (
    id BIGSERIAL PRIMARY KEY,
    user_id BIGINT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    ticket_type VARCHAR(50) NOT NULL,
    -- Types: single_trip, daily, weekly, monthly, student, senior
    route_id VARCHAR(255),
    amount DECIMAL(10, 2) NOT NULL,
    currency VARCHAR(3) DEFAULT 'VND',
    payment_method VARCHAR(50) NOT NULL,
    -- Methods: momo, greensm, cash, bank_transfer
    payment_transaction_id VARCHAR(255),
    payment_status VARCHAR(20) NOT NULL DEFAULT 'pending',
    -- Status: pending, completed, failed, refunded
    valid_from TIMESTAMP(0) NOT NULL,
    valid_until TIMESTAMP(0) NOT NULL,
    qr_code TEXT,
    metadata JSONB DEFAULT '{}',
    created_at TIMESTAMP(0) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP(0) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT chk_payment_status CHECK (payment_status IN ('pending', 'completed', 'failed', 'refunded')),
    CONSTRAINT chk_validity CHECK (valid_until > valid_from)
);

CREATE INDEX idx_ticket_purchases_user ON ticket_purchases(user_id);
CREATE INDEX idx_ticket_purchases_status ON ticket_purchases(payment_status);
CREATE INDEX idx_ticket_purchases_valid ON ticket_purchases(user_id, valid_from, valid_until);
CREATE INDEX idx_ticket_purchases_transaction ON ticket_purchases(payment_transaction_id);

-- Payment Integrations
CREATE TABLE payment_integrations (
    id BIGSERIAL PRIMARY KEY,
    provider VARCHAR(50) NOT NULL,
    -- Providers: momo, greensm, vnpay, zalopay
    api_key_encrypted TEXT,
    api_secret_encrypted TEXT,
    webhook_url TEXT,
    webhook_secret TEXT,
    is_active BOOLEAN DEFAULT TRUE,
    is_sandbox BOOLEAN DEFAULT FALSE,
    metadata JSONB DEFAULT '{}',
    created_at TIMESTAMP(0) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP(0) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT uq_provider UNIQUE (provider)
);

CREATE INDEX idx_payment_integrations_provider ON payment_integrations(provider) WHERE is_active = TRUE;

-- =====================================================
-- PART 8: LARAVEL FRAMEWORK TABLES
-- =====================================================

-- Password Reset Tokens
CREATE TABLE password_reset_tokens (
    email VARCHAR(255) PRIMARY KEY,
    token VARCHAR(255) NOT NULL,
    created_at TIMESTAMP(0) NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_password_reset_tokens_email ON password_reset_tokens(email);

-- Sessions
CREATE TABLE sessions (
    id VARCHAR(255) PRIMARY KEY,
    user_id BIGINT,
    ip_address VARCHAR(45),
    user_agent TEXT,
    payload TEXT NOT NULL,
    last_activity INTEGER NOT NULL
);

CREATE INDEX idx_sessions_user_id ON sessions(user_id);
CREATE INDEX idx_sessions_last_activity ON sessions(last_activity);

-- Cache
CREATE TABLE cache (
    key VARCHAR(255) PRIMARY KEY,
    value TEXT NOT NULL,
    expiration INTEGER NOT NULL
);

CREATE INDEX idx_cache_expiration ON cache(expiration);

-- Cache Locks
CREATE TABLE cache_locks (
    key VARCHAR(255) PRIMARY KEY,
    owner VARCHAR(255) NOT NULL,
    expiration INTEGER NOT NULL
);

-- Jobs Queue
CREATE TABLE jobs (
    id BIGSERIAL PRIMARY KEY,
    queue VARCHAR(255) NOT NULL,
    payload TEXT NOT NULL,
    attempts SMALLINT NOT NULL DEFAULT 0,
    reserved_at INTEGER,
    available_at INTEGER NOT NULL,
    created_at INTEGER NOT NULL
);

CREATE INDEX idx_jobs_queue ON jobs(queue, reserved_at);

-- Failed Jobs
CREATE TABLE failed_jobs (
    id BIGSERIAL PRIMARY KEY,
    uuid VARCHAR(255) UNIQUE NOT NULL,
    connection TEXT NOT NULL,
    queue TEXT NOT NULL,
    payload TEXT NOT NULL,
    exception TEXT NOT NULL,
    failed_at TIMESTAMP(0) NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_failed_jobs_uuid ON failed_jobs(uuid);

-- =====================================================
-- PART 9: MATERIALIZED VIEWS FOR PERFORMANCE
-- =====================================================

-- Active Version Quick Lookup
CREATE MATERIALIZED VIEW active_versions AS
SELECT
    d.id AS dataset_id,
    d.name AS dataset_name,
    d.slug AS dataset_slug,
    dv.id AS version_id,
    dv.version_number,
    dv.activated_at,
    dv.metadata
FROM datasets d
INNER JOIN dataset_versions dv ON d.id = dv.dataset_id
WHERE dv.status = 'active';

CREATE UNIQUE INDEX idx_active_versions_dataset ON active_versions(dataset_id);
CREATE UNIQUE INDEX idx_active_versions_slug ON active_versions(dataset_slug);

-- =====================================================
-- PART 10: FUNCTIONS & TRIGGERS
-- =====================================================

-- Update updated_at timestamp automatically
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = CURRENT_TIMESTAMP;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Apply updated_at trigger to all relevant tables
CREATE TRIGGER update_datasets_updated_at BEFORE UPDATE ON datasets
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_dataset_versions_updated_at BEFORE UPDATE ON dataset_versions
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_agencies_updated_at BEFORE UPDATE ON agencies
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_routes_updated_at BEFORE UPDATE ON routes
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_stops_updated_at BEFORE UPDATE ON stops
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_trips_updated_at BEFORE UPDATE ON trips
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_stop_times_updated_at BEFORE UPDATE ON stop_times
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_calendar_services_updated_at BEFORE UPDATE ON calendar_services
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_calendar_dates_updated_at BEFORE UPDATE ON calendar_dates
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_shapes_updated_at BEFORE UPDATE ON shapes
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_traffic_incidents_updated_at BEFORE UPDATE ON traffic_incidents
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_detours_updated_at BEFORE UPDATE ON detours
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_vehicles_updated_at BEFORE UPDATE ON vehicles
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_users_updated_at BEFORE UPDATE ON users
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_saved_queries_updated_at BEFORE UPDATE ON saved_queries
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_favorite_stops_updated_at BEFORE UPDATE ON favorite_stops
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_favorite_routes_updated_at BEFORE UPDATE ON favorite_routes
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_feedback_updated_at BEFORE UPDATE ON feedback
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_ticket_purchases_updated_at BEFORE UPDATE ON ticket_purchases
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_payment_integrations_updated_at BEFORE UPDATE ON payment_integrations
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- Populate geography columns from lat/lon
CREATE OR REPLACE FUNCTION update_stop_location()
RETURNS TRIGGER AS $$
BEGIN
    NEW.stop_location = ST_SetSRID(ST_MakePoint(NEW.stop_lon, NEW.stop_lat), 4326)::geography;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER update_stops_location BEFORE INSERT OR UPDATE ON stops
    FOR EACH ROW EXECUTE FUNCTION update_stop_location();

CREATE OR REPLACE FUNCTION update_shape_point()
RETURNS TRIGGER AS $$
BEGIN
    NEW.shape_point = ST_SetSRID(ST_MakePoint(NEW.shape_pt_lon, NEW.shape_pt_lat), 4326)::geography;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER update_shapes_point BEFORE INSERT OR UPDATE ON shapes
    FOR EACH ROW EXECUTE FUNCTION update_shape_point();

CREATE OR REPLACE FUNCTION update_incident_location()
RETURNS TRIGGER AS $$
BEGIN
    NEW.location_point = ST_SetSRID(ST_MakePoint(NEW.location_lon, NEW.location_lat), 4326)::geography;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER update_traffic_incidents_location BEFORE INSERT OR UPDATE ON traffic_incidents
    FOR EACH ROW EXECUTE FUNCTION update_incident_location();

CREATE OR REPLACE FUNCTION update_vehicle_position_point()
RETURNS TRIGGER AS $$
BEGIN
    NEW.position_point = ST_SetSRID(ST_MakePoint(NEW.position_lon, NEW.position_lat), 4326)::geography;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER update_vehicle_positions_point BEFORE INSERT OR UPDATE ON vehicle_positions
    FOR EACH ROW EXECUTE FUNCTION update_vehicle_position_point();

-- =====================================================
-- PART 11: HELPER FUNCTIONS
-- =====================================================

-- Get active service IDs for a specific date
CREATE OR REPLACE FUNCTION get_active_services(
    p_dataset_version_id BIGINT,
    p_date DATE
) RETURNS TABLE(service_id VARCHAR(255)) AS $$
BEGIN
    RETURN QUERY
    -- Services from calendar that are active on this date
    SELECT DISTINCT cs.service_id
    FROM calendar_services cs
    WHERE cs.dataset_version_id = p_dataset_version_id
      AND p_date BETWEEN cs.start_date AND cs.end_date
      AND (
          (EXTRACT(DOW FROM p_date) = 0 AND cs.sunday) OR
          (EXTRACT(DOW FROM p_date) = 1 AND cs.monday) OR
          (EXTRACT(DOW FROM p_date) = 2 AND cs.tuesday) OR
          (EXTRACT(DOW FROM p_date) = 3 AND cs.wednesday) OR
          (EXTRACT(DOW FROM p_date) = 4 AND cs.thursday) OR
          (EXTRACT(DOW FROM p_date) = 5 AND cs.friday) OR
          (EXTRACT(DOW FROM p_date) = 6 AND cs.saturday)
      )
      AND cs.service_id NOT IN (
          -- Exclude services explicitly removed on this date
          SELECT cd.service_id
          FROM calendar_dates cd
          WHERE cd.dataset_version_id = p_dataset_version_id
            AND cd.date = p_date
            AND cd.exception_type = 2
      )
    UNION
    -- Services explicitly added for this date
    SELECT cd.service_id
    FROM calendar_dates cd
    WHERE cd.dataset_version_id = p_dataset_version_id
      AND cd.date = p_date
      AND cd.exception_type = 1;
END;
$$ LANGUAGE plpgsql;

-- Search nearby stops within radius (in meters)
CREATE OR REPLACE FUNCTION search_nearby_stops(
    p_dataset_version_id BIGINT,
    p_lat DECIMAL(10, 8),
    p_lon DECIMAL(11, 8),
    p_radius_meters INTEGER DEFAULT 500,
    p_limit INTEGER DEFAULT 20
) RETURNS TABLE(
    stop_id VARCHAR(255),
    stop_name VARCHAR(255),
    stop_lat DECIMAL(10, 8),
    stop_lon DECIMAL(11, 8),
    distance_meters DOUBLE PRECISION
) AS $$
BEGIN
    RETURN QUERY
    SELECT
        s.stop_id,
        s.stop_name,
        s.stop_lat,
        s.stop_lon,
        ST_Distance(
            s.stop_location,
            ST_SetSRID(ST_MakePoint(p_lon, p_lat), 4326)::geography
        ) AS distance_meters
    FROM stops s
    WHERE s.dataset_version_id = p_dataset_version_id
      AND ST_DWithin(
          s.stop_location,
          ST_SetSRID(ST_MakePoint(p_lon, p_lat), 4326)::geography,
          p_radius_meters
      )
    ORDER BY distance_meters
    LIMIT p_limit;
END;
$$ LANGUAGE plpgsql;

-- =====================================================
-- PART 12: COMMENTS FOR DOCUMENTATION
-- =====================================================

COMMENT ON TABLE datasets IS 'Transit datasets (e.g., Hanoi Bus, HCMC Bus)';
COMMENT ON TABLE dataset_versions IS 'Versioned GTFS imports with lifecycle management';
COMMENT ON TABLE validation_errors IS 'Import validation errors and warnings';

COMMENT ON TABLE agencies IS 'GTFS agencies.txt - Transit agencies';
COMMENT ON TABLE routes IS 'GTFS routes.txt - Transit routes';
COMMENT ON TABLE stops IS 'GTFS stops.txt - Bus stops and stations';
COMMENT ON TABLE trips IS 'GTFS trips.txt - Individual trips for routes';
COMMENT ON TABLE stop_times IS 'GTFS stop_times.txt - Stop sequences and times for trips';
COMMENT ON TABLE calendar_services IS 'GTFS calendar.txt - Recurring service schedules';
COMMENT ON TABLE calendar_dates IS 'GTFS calendar_dates.txt - Service exceptions (add/remove)';
COMMENT ON TABLE shapes IS 'GTFS shapes.txt - Route path geometries';

COMMENT ON TABLE traffic_incidents IS 'Realtime traffic incidents affecting transit';
COMMENT ON TABLE detours IS 'Alternate routes due to incidents or construction';
COMMENT ON TABLE vehicles IS 'Transit vehicle fleet registry';
COMMENT ON TABLE vehicle_positions IS 'Realtime vehicle location tracking';

COMMENT ON TABLE users IS 'Application users';
COMMENT ON TABLE saved_queries IS 'User saved searches and queries';
COMMENT ON TABLE favorite_stops IS 'User favorite bus stops';
COMMENT ON TABLE favorite_routes IS 'User favorite bus routes';
COMMENT ON TABLE notifications IS 'User notifications for delays, incidents, etc.';
COMMENT ON TABLE feedback IS 'User feedback and issue reports';

COMMENT ON TABLE ticket_purchases IS 'Bus ticket purchases via MoMo, GreenSM, etc.';
COMMENT ON TABLE payment_integrations IS 'Payment gateway configurations';

COMMENT ON TABLE audit_logs IS 'Audit trail for data changes';
COMMENT ON TABLE search_analytics IS 'Search behavior analytics';

COMMENT ON COLUMN stop_times.arrival_seconds IS 'Arrival time in seconds from midnight (supports 25:10:00 as 90600)';
COMMENT ON COLUMN stop_times.departure_seconds IS 'Departure time in seconds from midnight (supports 25:10:00 as 90600)';

-- =====================================================
-- END OF SCHEMA
-- =====================================================
