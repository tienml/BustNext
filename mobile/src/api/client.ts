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
  trip_headsign?: string;
  direction_id?: number;
  departure_time?: string;
  route_short_name?: string;
};

export type StopTime = {
  trip_id?: string;
  stop_id: string;
  stop_sequence: number;
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

export type User = {
  id: number;
  name: string;
  email: string;
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

  private async request<T>(path: string, method: 'GET' | 'POST' | 'DELETE', body?: Record<string, unknown>, signal?: AbortSignal): Promise<ApiEnvelope<T>> {
    let response: Response;
    try {
      response = await fetch(`${this.baseUrl}${path}`, {
        method,
        headers: {
          Accept: 'application/json',
          ...(body ? { 'Content-Type': 'application/json' } : {}),
          ...(this.token ? { Authorization: `Bearer ${this.token}` } : {}),
        },
        ...(body ? { body: JSON.stringify(body) } : {}),
        ...(signal ? { signal } : {}),
      });
    } catch (cause) {
      if (cause instanceof Error && cause.name === 'AbortError') throw cause;
      throw new ApiError('Không thể kết nối đến máy chủ.', 'NETWORK_ERROR');
    }

    let responseBody: ApiEnvelope<T>;
    try {
      responseBody = (await response.json()) as ApiEnvelope<T>;
    } catch {
      throw new ApiError('Máy chủ trả về dữ liệu không hợp lệ.', 'INVALID_RESPONSE', response.status);
    }

    if (!response.ok) {
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
}

export const apiClient = new ApiClient(process.env.EXPO_PUBLIC_API_URL ?? 'http://localhost:8000/api');
