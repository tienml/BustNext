export type ApiErrorItem = { code?: string; message?: string };

export type ApiEnvelope<T> = {
  data: T;
  meta?: { count?: number; version?: number | null; timezone?: string; [key: string]: unknown };
  errors?: ApiErrorItem[];
  message?: string;
  stops?: Stop[];
  stop_times?: StopTime[];
};

export type Departure = {
  trip_id: string;
  route_id: string;
  route_short_name?: string;
  route_long_name?: string;
  route_type?: number;
  agency_name?: string;
  headsign?: string;
  stop_sequence: number;
  service_date: string;
  departure_time: string;
  departure_seconds: number;
  absolute_timestamp?: number;
  minutes_until: number;
};

export type Stop = {
  stop_id: string;
  code?: string | null;
  name: string;
  lat?: string | number;
  lon?: string | number;
  distance_meters?: number;
};

export type Route = {
  route_id: string;
  short_name?: string | null;
  long_name?: string | null;
  route_type?: number;
  agency_name?: string;
};

export type RouteDetailResponse = ApiEnvelope<Route> & { stops: Stop[] };

export type Trip = {
  trip_id: string;
  route_id?: string;
  service_id?: string;
  /** Backend field name. */
  headsign?: string | null;
  /** Older field name kept for compatibility. */
  trip_headsign?: string | null;
  direction_id?: number;
  departure_time?: string | null;
  short_name?: string | null;
  long_name?: string | null;
  agency_name?: string | null;
  route_short_name?: string;
};

export type StopTime = {
  trip_id?: string;
  stop_id: string;
  stop_sequence: number;
  stop_code?: string | null;
  stop_name?: string | null;
  lat?: string | number | null;
  lon?: string | number | null;
  arrival_time?: string;
  departure_time?: string;
  arrival_seconds?: number;
  departure_seconds?: number;
  stop?: Stop;
};

export type TripDetailResponse = ApiEnvelope<Trip> & { stop_times: StopTime[] };

export type UnifiedSearch = {
  stops: Stop[];
  routes: Route[];
};

export type Health = {
  status?: string;
  database?: string;
  [key: string]: unknown;
};

export type UserRole = 'user' | 'admin';

export type User = {
  id: number;
  name: string;
  email: string;
  role: UserRole;
};

export type AuthResponse = {
  user: User;
  token: string;
};

export type FavoriteEntity = Stop | Route;

export type Favorite = {
  id: number;
  type: 'stop' | 'route';
  entity_id: string;
  entity?: FavoriteEntity | null;
  created_at?: string;
};

export type JourneyStop = {
  stop_id: string;
  stop_code?: string | null;
  stop_name?: string | null;
  service_date?: string;
  lat?: string | number | null;
  lon?: string | number | null;
  stop_sequence: number;
  arrival_seconds: number;
  departure_seconds: number;
  arrival_time: string;
  departure_time: string;
};

export type JourneyLeg = {
  trip_id: string;
  route_id: string;
  service_date?: string;
  route_short_name?: string | null;
  route_long_name?: string | null;
  agency_name?: string | null;
  headsign?: string | null;
  from: JourneyStop;
  to: JourneyStop;
};

export type Journey = {
  type: 'direct' | 'one_transfer';
  transfers: number;
  service_date?: string;
  departure_seconds: number;
  arrival_seconds: number;
  departure_time: string;
  arrival_time: string;
  duration_minutes: number;
  legs: JourneyLeg[];
};

/* ------------------------------ admin types ------------------------------ */

export type VersionStatus = 'pending' | 'validating' | 'failed' | 'ready' | 'active' | 'archived';

export type DatasetVersion = {
  id: number;
  dataset_id: number;
  version_number: number;
  label?: string | null;
  status: VersionStatus;
  source_filename?: string | null;
  stats?: Record<string, number> | null;
  error_count: number;
  warning_count: number;
  imported_at?: string | null;
  activated_at?: string | null;
  created_at?: string;
};

export type Dataset = {
  id: number;
  slug: string;
  name: string;
  timezone: string;
  active_version_id?: number | null;
  active_version?: DatasetVersion | null;
};

export type Paginated<T> = {
  data: T[];
  current_page: number;
  last_page: number;
  total: number;
};

export type ValidationIssue = {
  id?: number;
  file_name: string;
  row_number: number;
  column_name?: string | null;
  code: string;
  severity: 'error' | 'warning' | string;
  value?: string | null;
  message: string;
};

export type ImportResult = {
  status: VersionStatus;
  version: DatasetVersion;
  errors: ValidationIssue[];
  warnings: ValidationIssue[];
};

export type FieldChange = { field: string; from: unknown; to: unknown };

export type StopTimeChange = {
  stop_sequence: number;
  type: 'time_changed' | 'stop_changed' | 'stop_added' | 'stop_removed';
  from: { stop_id: string; arrival_time: string; departure_time: string } | null;
  to: { stop_id: string; arrival_time: string; departure_time: string } | null;
};

export type ComparedTrip = { trip_id: string; route_id?: string; service_id?: string; headsign?: string | null };
export type ChangedTrip = { trip_id: string; route_id?: string; changes: FieldChange[]; stop_times: StopTimeChange[] };
export type ComparedRoute = { route_id: string; short_name?: string | null; long_name?: string | null };

export type VersionComparison = {
  base: Pick<DatasetVersion, 'id' | 'version_number' | 'label' | 'status'>;
  target: Pick<DatasetVersion, 'id' | 'version_number' | 'label' | 'status'>;
  summary: Record<'routes_added' | 'routes_removed' | 'routes_changed' | 'trips_added' | 'trips_removed' | 'trips_changed', number>;
  routes: { added: ComparedRoute[]; removed: ComparedRoute[]; changed: (ComparedRoute & { changes: FieldChange[] })[] };
  trips: { added: ComparedTrip[]; removed: ComparedTrip[]; changed: ChangedTrip[] };
  by_route: { route_id: string; trips_added: string[]; trips_removed: string[]; trips_changed: string[] }[];
};

export type SavedQueryType = 'stops' | 'routes' | 'trip' | 'route_trips' | 'departures' | 'journey';

export type SavedQuery = {
  id: number;
  dataset_id: number;
  name: string;
  type: SavedQueryType;
  params: Record<string, string | number>;
  last_run_at?: string | null;
  last_version_id?: number | null;
  last_status?: number | null;
  last_result_count?: number | null;
};

export type SavedQueryRun = {
  query: Pick<SavedQuery, 'id' | 'name' | 'type' | 'params'>;
  status: number;
  ok: boolean;
  count: number;
  version: number | null;
  data: unknown;
  stop_times?: StopTime[] | null;
  errors?: ApiErrorItem[] | null;
};

const REQUEST_TIMEOUT_MS = 20_000;
const UPLOAD_TIMEOUT_MS = 180_000;

export class ApiError extends Error {
  constructor(
    message: string,
    public readonly code: string,
    public readonly status?: number,
  ) {
    super(message);
    this.name = 'ApiError';
  }
}

export class ApiClient {
  private readonly baseUrl: string;

  constructor(baseUrl: string, private readonly token?: string) {
    this.baseUrl = baseUrl.replace(/\/$/, '');
  }

  withToken(token: string) {
    return new ApiClient(this.baseUrl, token);
  }

  async get<T>(path: string, signal?: AbortSignal): Promise<ApiEnvelope<T>> {
    return this.request<T>(path, 'GET', undefined, signal);
  }

  async post<T>(path: string, body?: Record<string, unknown>, signal?: AbortSignal): Promise<ApiEnvelope<T>> {
    return this.request<T>(path, 'POST', body, signal);
  }

  async delete<T>(path: string, signal?: AbortSignal): Promise<ApiEnvelope<T>> {
    return this.request<T>(path, 'DELETE', undefined, signal);
  }

  async put<T>(path: string, body?: Record<string, unknown>, signal?: AbortSignal): Promise<ApiEnvelope<T>> {
    return this.request<T>(path, 'PUT', body, signal);
  }

  url(path: string) {
    return `${this.baseUrl}${path}`;
  }

  private async request<T>(
    path: string,
    method: 'GET' | 'POST' | 'PUT' | 'DELETE',
    body?: Record<string, unknown> | FormData,
    signal?: AbortSignal,
    options: { timeoutMs?: number; acceptStatuses?: number[] } = {},
  ): Promise<ApiEnvelope<T>> {
    const isForm = typeof FormData !== 'undefined' && body instanceof FormData;
    // Without a timeout a dead tunnel leaves fetch hanging until the OS gives
    // up, and whatwg-fetch then throws a RangeError for status 0.
    const controller = new AbortController();
    let timedOut = false;
    const timer = setTimeout(() => {
      timedOut = true;
      controller.abort();
    }, options.timeoutMs ?? REQUEST_TIMEOUT_MS);
    const forwardAbort = () => controller.abort();
    signal?.addEventListener('abort', forwardAbort);

    let response: Response;
    try {
      response = await fetch(this.url(path), {
        method,
        headers: {
          Accept: 'application/json',
          'ngrok-skip-browser-warning': '1',
          ...(body && !isForm ? { 'Content-Type': 'application/json' } : {}),
          ...(this.token ? { Authorization: `Bearer ${this.token}` } : {}),
        },
        ...(body ? { body: isForm ? body : JSON.stringify(body) } : {}),
        signal: controller.signal,
      });
    } catch (cause) {
      if (timedOut) throw new ApiError('Máy chủ không phản hồi. Kiểm tra kết nối hoặc địa chỉ API.', 'TIMEOUT');
      if (signal?.aborted) throw cause;
      throw new ApiError('Không thể kết nối đến máy chủ.', 'NETWORK_ERROR');
    } finally {
      clearTimeout(timer);
      signal?.removeEventListener('abort', forwardAbort);
    }

    if (response.status === 204) return { data: null as T };

    let responseBody: ApiEnvelope<T>;
    try {
      responseBody = (await response.json()) as ApiEnvelope<T>;
    } catch {
      throw new ApiError('Máy chủ trả về dữ liệu không hợp lệ.', 'INVALID_RESPONSE', response.status);
    }

    if (!response.ok && !options.acceptStatuses?.includes(response.status)) {
      const validationMessage = responseBody.errors?.[0]?.message;
      const message = validationMessage ?? responseBody.message ?? `API request failed: ${response.status}`;
      const code = responseBody.errors?.[0]?.code ?? `HTTP_${response.status}`;
      throw new ApiError(message, code, response.status);
    }
    return responseBody;
  }

  health() {
    return this.get<Health>('/health');
  }

  nextDepartures(stopId: string, date: string, after: string, limit = 10, signal?: AbortSignal) {
    const params = new URLSearchParams({ date, time: after, limit: String(limit) });
    return this.get<Departure[]>(`/v1/gtfs/stops/${encodeURIComponent(stopId)}/departures?${params}`, signal);
  }

  searchStops(query: string, limit = 20, signal?: AbortSignal) {
    const params = new URLSearchParams({ q: query, limit: String(limit) });
    return this.get<Stop[]>(`/v1/gtfs/stops?${params}`, signal);
  }

  getStop(stopId: string, signal?: AbortSignal) {
    return this.get<Stop>(`/v1/gtfs/stops/${encodeURIComponent(stopId)}`, signal);
  }

  nearbyStops(lat: number, lon: number, radius = 1000, limit = 10, signal?: AbortSignal) {
    const params = new URLSearchParams({ lat: String(lat), lon: String(lon), radius: String(radius), limit: String(limit) });
    return this.get<Stop[]>(`/v1/gtfs/stops/nearby?${params}`, signal);
  }

  searchRoutes(query: string, routeType?: number, limit = 20, signal?: AbortSignal) {
    const params = new URLSearchParams({ q: query, limit: String(limit) });
    if (routeType !== undefined) params.set('route_type', String(routeType));
    return this.get<Route[]>(`/v1/gtfs/routes?${params}`, signal);
  }

  unifiedSearch(query: string, limit = 10, signal?: AbortSignal) {
    const params = new URLSearchParams({ q: query, limit: String(limit) });
    return this.get<UnifiedSearch>(`/v1/search?${params}`, signal);
  }

  getRoute(routeId: string, signal?: AbortSignal) {
    return this.get<RouteDetailResponse['data']>(`/v1/gtfs/routes/${encodeURIComponent(routeId)}`, signal) as Promise<RouteDetailResponse>;
  }

  getRouteTrips(routeId: string, date: string, signal?: AbortSignal) {
    const params = new URLSearchParams({ date });
    return this.get<Trip[]>(`/v1/gtfs/routes/${encodeURIComponent(routeId)}/trips?${params}`, signal);
  }

  getTrip(tripId: string, signal?: AbortSignal) {
    return this.get<TripDetailResponse['data']>(`/v1/gtfs/trips/${encodeURIComponent(tripId)}`, signal) as Promise<TripDetailResponse>;
  }

  getTripStopTimes(tripId: string, signal?: AbortSignal) {
    return this.get<StopTime[]>(`/v1/gtfs/trips/${encodeURIComponent(tripId)}/stop-times`, signal);
  }

  planJourney(fromStopId: string, toStopId: string, date: string, time: string, maxTransfers = 1, limit = 5, signal?: AbortSignal) {
    const params = new URLSearchParams({
      from_stop_id: fromStopId,
      to_stop_id: toStopId,
      date,
      time,
      max_transfers: String(maxTransfers),
      limit: String(limit),
    });
    return this.get<Journey[]>(`/v1/journeys/plan?${params}`, signal);
  }

  register(name: string, email: string, password: string, passwordConfirmation: string) {
    return this.post<AuthResponse>('/v1/auth/register', { name, email, password, password_confirmation: passwordConfirmation });
  }

  login(email: string, password: string) {
    return this.post<AuthResponse>('/v1/auth/login', { email, password });
  }

  logout() {
    return this.post<{ logged_out: boolean }>('/v1/auth/logout');
  }

  me() {
    return this.get<User>('/v1/auth/me');
  }

  favorites(type?: Favorite['type'], signal?: AbortSignal) {
    const query = type ? `?type=${encodeURIComponent(type)}` : '';
    return this.get<Favorite[]>(`/v1/favorites${query}`, signal);
  }

  addFavorite(type: Favorite['type'], entityId: string, signal?: AbortSignal) {
    return this.post<Favorite>('/v1/favorites', { type, entity_id: entityId }, signal);
  }

  removeFavorite(favoriteId: number, signal?: AbortSignal) {
    return this.delete<{ deleted: boolean }>(`/v1/favorites/${favoriteId}`, signal);
  }

  /* ------------------------------- admin -------------------------------- */

  datasets(signal?: AbortSignal) {
    return this.get<Paginated<Dataset>>('/v1/datasets', signal);
  }

  versions(datasetId: number, signal?: AbortSignal) {
    return this.get<Paginated<DatasetVersion>>(`/v1/datasets/${datasetId}/versions`, signal);
  }

  validationIssues(versionId: number, page = 1, signal?: AbortSignal) {
    return this.get<Paginated<ValidationIssue>>(`/v1/versions/${versionId}/validation?page=${page}`, signal);
  }

  activateVersion(versionId: number) {
    return this.post<DatasetVersion>(`/v1/versions/${versionId}/activate`);
  }

  /**
   * Uploads a GTFS zip. A failed validation (422) is a normal outcome here, so
   * it resolves with the import result instead of throwing.
   */
  async importVersion(datasetId: number, file: { uri: string; name: string; mimeType?: string; file?: Blob }, label?: string): Promise<ImportResult> {
    const form = new FormData();
    if (file.file) {
      form.append('file', file.file, file.name);
    } else {
      // React Native's FormData accepts a { uri, name, type } descriptor.
      form.append('file', { uri: file.uri, name: file.name, type: file.mimeType ?? 'application/zip' } as unknown as Blob);
    }
    if (label) form.append('label', label);
    const result = await this.request<unknown>(`/v1/datasets/${datasetId}/versions`, 'POST', form, undefined, {
      timeoutMs: UPLOAD_TIMEOUT_MS,
      acceptStatuses: [422],
    });
    const body = result as unknown as Partial<ImportResult> & { message?: string };
    if (!body.version) throw new ApiError(body.message ?? 'Tệp tải lên không hợp lệ.', 'INVALID_UPLOAD', 422);
    return body as ImportResult;
  }

  compareVersions(baseId: number, targetId: number, signal?: AbortSignal) {
    return this.get<VersionComparison>(`/v1/versions/compare?base=${baseId}&target=${targetId}`, signal);
  }

  /**
   * Asks for a short-lived signed download path, then turns it into an
   * absolute URL the browser can open without the Bearer token.
   */
  async exportUrl(versionId: number, kind: 'schedule' | 'validation', routeId?: string) {
    const query = routeId ? `?route_id=${encodeURIComponent(routeId)}` : '';
    const response = await this.post<{ path: string; expires_at: string }>(`/v1/versions/${versionId}/export/${kind}/link${query}`);
    const origin = this.baseUrl.replace(/^(https?:\/\/[^/]+).*$/, '$1');
    return `${origin}${response.data.path}`;
  }

  savedQueries(datasetId: number, signal?: AbortSignal) {
    return this.get<SavedQuery[]>(`/v1/datasets/${datasetId}/queries`, signal);
  }

  createSavedQuery(datasetId: number, input: Pick<SavedQuery, 'name' | 'type' | 'params'>) {
    return this.post<SavedQuery>(`/v1/datasets/${datasetId}/queries`, input);
  }

  deleteSavedQuery(queryId: number) {
    return this.delete<null>(`/v1/queries/${queryId}`);
  }

  runSavedQuery(queryId: number) {
    return this.post<SavedQueryRun>(`/v1/queries/${queryId}/run`);
  }

  runAllSavedQueries(datasetId: number) {
    return this.post<SavedQueryRun[]>(`/v1/datasets/${datasetId}/queries/run`);
  }
}

export const apiClient = new ApiClient(process.env.EXPO_PUBLIC_API_URL ?? 'http://localhost:8000/api');
