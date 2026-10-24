export type ApiEnvelope<T> = {
  data: T;
  meta?: { count?: number; version?: number | null; timezone?: string };
  errors?: Array<{ code: string; message: string }>;
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
};

export type Route = {
  route_id: string;
  short_name?: string | null;
  long_name?: string | null;
  route_type?: number;
  agency_name?: string;
};

export class ApiClient {
  constructor(private readonly baseUrl: string, private readonly token?: string) {}

  async get<T>(path: string): Promise<ApiEnvelope<T>> {
    const response = await fetch(`${this.baseUrl}${path}`, {
      headers: {
        Accept: 'application/json',
        ...(this.token ? { Authorization: `Bearer ${this.token}` } : {}),
      },
    });
    const body = (await response.json()) as ApiEnvelope<T>;
    if (!response.ok) {
      const message = body.errors?.[0]?.message ?? `API request failed: ${response.status}`;
      const code = body.errors?.[0]?.code ?? `HTTP_${response.status}`;
      const error = new Error(message);
      error.name = code;
      throw error;
    }
    return body;
  }

  nextDepartures(stopId: string, date: string, after: string, limit = 10) {
    const params = new URLSearchParams({ date, time: after, limit: String(limit) });
    return this.get<Departure[]>(`/v1/gtfs/stops/${encodeURIComponent(stopId)}/departures?${params}`);
  }

  searchStops(query: string) {
    return this.get<Stop[]>(`/v1/gtfs/stops?q=${encodeURIComponent(query)}`);
  }

  searchRoutes(query: string) {
    return this.get<Route[]>(`/v1/gtfs/routes?q=${encodeURIComponent(query)}`);
  }
}

export const apiClient = new ApiClient(process.env.EXPO_PUBLIC_API_URL ?? 'http://localhost:8000/api');
