# 📋 KẾ HOẠCH IMPLEMENTATION & GIẢI THÍCH TECH STACK - BUSFAST

## 📊 TỔNG QUAN DỰ ÁN

**BusFast** là ứng dụng tra cứu lịch trình xe bus theo chuẩn GTFS (General Transit Feed Specification) với kiến trúc **Backend API (Laravel) + Mobile App (React Native Expo)**.

---

## 🎯 PHẦN 1: GIẢI THÍCH CHI TIẾT TECH STACK

### 🔧 BACKEND - PHP Laravel 11

#### **Tại sao chọn Laravel?**

Laravel là PHP framework mạnh mẽ nhất hiện nay, được chọn vì:

1. **Rapid Development** - Phát triển nhanh
   - ORM Eloquent: Query database dễ dàng không cần viết SQL thô
   - Migration: Quản lý database schema như Git (version control cho DB)
   - Artisan CLI: Tạo controller, model, migration tự động
   
2. **RESTful API Ready**
   - Route system rõ ràng (`routes/api.php`)
   - JSON response built-in
   - API Resource để format data chuẩn
   
3. **Ecosystem phong phú**
   - Composer packages (giống npm của Node.js)
   - Laravel Sanctum cho authentication
   - Laravel Queue cho async jobs
   
4. **Testing tích hợp sẵn**
   - PHPUnit framework
   - Feature tests, Unit tests
   - Database seeding và factories

**Ví dụ code Laravel:**
```php
// Model - ORM giúp query dễ dàng
$stops = Stop::where('dataset_version_id', $versionId)
    ->where('stop_name', 'ILIKE', "%{$query}%")
    ->limit(20)
    ->get();

// Controller trả JSON tự động
return response()->json(['data' => $stops]);
```

---

### 🗄️ PostgreSQL 16 + PostGIS Extension

#### **Tại sao PostgreSQL thay vì MySQL?**

**PostGIS** là lý do chính - extension GIS (Geographic Information System) cực mạnh:

1. **Geography Data Type**
   - Lưu tọa độ GPS (lat, lon) hiệu quả
   - Tính khoảng cách chính xác trên bề mặt trái đất (không phẳng!)
   
2. **Spatial Queries - Truy vấn không gian**
   ```sql
   -- Tìm tất cả trạm trong bán kính 1km
   SELECT stop_name, 
          ST_Distance(stop_location, ST_Point(105.8242, 21.0285)::geography) as distance
   FROM stops
   WHERE ST_DWithin(stop_location, ST_Point(105.8242, 21.0285)::geography, 1000)
   ORDER BY distance;
   ```
   
3. **GiST Index** - Index đặc biệt cho spatial data
   ```sql
   CREATE INDEX idx_stops_location ON stops USING GIST (stop_location);
   ```
   - Query "trạm gần tôi" trả kết quả trong vài milliseconds
   
4. **JSON Support**
   - Lưu metadata dạng JSONB (binary JSON) - nhanh hơn MySQL
   - Query JSON fields trực tiếp
   
5. **Advanced Features**
   - Window functions
   - Common Table Expressions (CTEs)
   - Full-text search

**So sánh MySQL vs PostgreSQL cho BusFast:**

| Feature | MySQL | PostgreSQL + PostGIS |
|---------|-------|---------------------|
| Tính khoảng cách GPS | Không chính xác (phẳng) | Chính xác (cầu) ✅ |
| Tìm điểm trong bán kính | Phải tính toán phức tạp | `ST_DWithin()` built-in ✅ |
| Performance spatial query | Chậm | Nhanh với GiST index ✅ |

---

### 🚀 Redis 7 - In-Memory Cache

**Vai trò:**

1. **Cache API responses**
   ```php
   // Cache danh sách routes 5 phút
   $routes = Cache::remember('routes:all', 300, function() {
       return Route::with('agency')->get();
   });
   ```
   - Tránh query database nhiều lần cho cùng data
   - Response time từ 200ms → 5ms
   
2. **Session Storage**
   - Lưu user sessions (đã login chưa, token, etc.)
   
3. **Rate Limiting** - Chống spam
   ```php
   // Chỉ cho phép 60 requests/phút từ 1 IP
   RateLimiter::for('api', function (Request $request) {
       return Limit::perMinute(60);
   });
   ```
   
4. **Pub/Sub for Realtime**
   - Backend publish: "Bus 123 ở tọa độ X,Y"
   - Mobile subscribe: nhận update realtime

**Tại sao không dùng Cache bằng file?**
- Redis in-memory → nhanh gấp 100 lần disk
- Hỗ trợ expiration tự động (TTL - Time To Live)
- Pub/Sub cho realtime

---

### 📱 FRONTEND - React Native Expo

#### **Tại sao React Native?**

**Write Once, Run Everywhere** - Viết 1 lần, chạy cả iOS & Android:

1. **Cross-platform**
   - Code JavaScript/TypeScript
   - Component giống React web
   - 95% code dùng chung, 5% platform-specific
   
2. **Performance**
   - Render native components (không phải WebView)
   - JavaScript chạy trên JSC/Hermes engine
   - 60 FPS smooth như native app
   
3. **Developer Experience**
   - Hot Reload: Sửa code → thấy kết quả ngay lập tức
   - Chrome DevTools để debug
   - Large ecosystem: nhiều thư viện
   
4. **Cost-effective**
   - 1 team developer thay vì 2 (iOS + Android)
   - Cùng một codebase → dễ maintain

**So sánh với Native:**

| Tiêu chí | React Native | Native (Swift/Kotlin) |
|----------|--------------|---------------------|
| Development time | 1x | 2x (iOS + Android riêng) |
| Developer skills | JavaScript | Swift + Kotlin |
| Performance | ~90% native | 100% |
| Hot reload | ✅ Yes | ❌ No |
| Cost | Thấp | Cao |

---

#### **Tại sao Expo?**

**Expo** là framework wrap React Native, giúp development dễ hơn rất nhiều:

1. **Zero Config**
   - Không cần Android Studio, Xcode để bắt đầu
   - `npm install` → `expo start` → Done!
   
2. **Expo Go App** - Test trên điện thoại thật
   - Scan QR code
   - App chạy ngay trên điện thoại
   - Không cần build APK/IPA
   
3. **Built-in APIs**
   ```javascript
   import * as Location from 'expo-location';
   
   const location = await Location.getCurrentPositionAsync();
   console.log(location.coords.latitude);
   ```
   - Camera, Location, Maps, Notifications, FileSystem
   - Không cần config native modules
   
4. **EAS Build** - Build trên cloud
   - Không cần Mac để build iOS app
   - `eas build --platform all` → nhận APK + IPA
   
5. **OTA Updates** - Over The Air
   - Update app mà không qua App Store/Play Store
   - Fix bug nhanh chóng

**Trade-off:**
- ❌ Không dùng được native modules tùy ý (phải eject)
- ✅ Nhưng 95% app không cần native code

---

### 🗺️ React Native Maps

**Hiển thị bản đồ trong app:**

```javascript
import MapView, { Marker } from 'react-native-maps';

<MapView
  initialRegion={{
    latitude: 21.0285,
    longitude: 105.8242,
    latitudeDelta: 0.01,
    longitudeDelta: 0.01,
  }}
>
  {stops.map(stop => (
    <Marker
      key={stop.id}
      coordinate={{ latitude: stop.lat, longitude: stop.lon }}
      title={stop.name}
    />
  ))}
</MapView>
```

**Features:**
- Google Maps trên Android
- Apple Maps trên iOS
- Markers, Polylines (vẽ route), Clustering
- User location tracking

---

### 🔄 TanStack Query (React Query)

**Quản lý server state** - thay thế Redux cho data từ API:

```javascript
// Hook để fetch stops gần vị trí hiện tại
const { data: stops, isLoading, error } = useQuery({
  queryKey: ['stops', 'nearby', lat, lon],
  queryFn: () => api.stops.nearby(lat, lon),
  staleTime: 5 * 60 * 1000, // Cache 5 phút
  retry: 3,
});

if (isLoading) return <LoadingSpinner />;
if (error) return <ErrorMessage error={error} />;
return <StopList stops={stops} />;
```

**Lợi ích:**

1. **Auto Caching**
   - Gọi API 1 lần, cache kết quả
   - Lần sau dùng cache, không gọi lại
   
2. **Auto Refetch**
   - Window focus → refetch (data mới nhất)
   - Network reconnect → refetch
   
3. **Loading & Error States**
   - `isLoading`, `isError` tự động
   - Không cần `useState` manual
   
4. **Background Refetch**
   - Data cũ hiển thị ngay (UX tốt)
   - Fetch data mới background
   - Update khi có data mới
   
5. **Optimistic Updates**
   - Update UI trước
   - Gọi API sau
   - Rollback nếu API fail

**So sánh Redux vs TanStack Query:**

| Feature | Redux | TanStack Query |
|---------|-------|---------------|
| API data management | Manual | Automatic ✅ |
| Caching | Manual | Automatic ✅ |
| Loading states | Manual | Automatic ✅ |
| Boilerplate code | Nhiều | Ít ✅ |
| Learning curve | Cao | Thấp ✅ |

---

### 🎭 TypeScript

**JavaScript with Types:**

```typescript
// JavaScript - không biết type
function getStop(id) {
  return api.get('/stops/' + id);
}

// TypeScript - có type safety
interface Stop {
  id: string;
  name: string;
  lat: number;
  lon: number;
}

function getStop(id: string): Promise<Stop> {
  return api.get<Stop>(`/stops/${id}`);
}

const stop = await getStop('123');
console.log(stop.name); // ✅ Autocomplete
console.log(stop.xyz);  // ❌ Error: Property 'xyz' does not exist
```

**Lợi ích:**

1. **Catch bugs lúc code, không phải lúc chạy**
   ```typescript
   const lat: number = "invalid"; // ❌ Error ngay lập tức
   ```

2. **Autocomplete thông minh**
   - VS Code gợi ý properties
   - Refactor an toàn (rename, move file)

3. **Self-documenting code**
   - Type chính là documentation
   - Đọc code dễ hiểu hơn

4. **Team collaboration**
   - API contract rõ ràng
   - Ít bug hơn khi merge code

---

## 🔄 PHẦN 2: LUỒNG HOẠT ĐỘNG TỔNG

### 1️⃣ GTFS Import Flow (Admin)

```
┌─────────────────────┐
│ Admin upload ZIP    │
│ (gtfs.zip)          │
└──────────┬──────────┘
           │
           v
┌─────────────────────┐
│ SafeZipExtractor    │
│ - Check ZIP bomb    │
│ - Extract to temp   │
└──────────┬──────────┘
           │
           v
┌─────────────────────┐
│ GtfsZipImporter     │
│ - Parse CSV files   │
│ - agency.txt        │
│ - stops.txt         │
│ - routes.txt        │
│ - trips.txt         │
│ - stop_times.txt    │
│ - calendar.txt      │
└──────────┬──────────┘
           │
           v
┌─────────────────────┐
│ GtfsRowValidator    │
│ - Check required    │
│ - Validate refs     │
│ - Check format      │
└──────────┬──────────┘
           │
           ├─ Has errors? ──> Save to validation_errors table
           │                  Status: 'failed'
           │
           v (No errors)
┌─────────────────────┐
│ Store to PostgreSQL │
│ - agencies          │
│ - stops (PostGIS)   │
│ - routes            │
│ - trips             │
│ - stop_times        │
│ - calendar_services │
└──────────┬──────────┘
           │
           v
┌─────────────────────┐
│ dataset_versions    │
│ Status: 'ready'     │
└──────────┬──────────┘
           │
           v
┌─────────────────────┐
│ Admin clicks        │
│ "Activate"          │
└──────────┬──────────┘
           │
           v
┌─────────────────────┐
│ Status: 'active'    │
│ activated_at: now   │
│ → API sử dụng       │
└─────────────────────┘
```

**Giải thích:**

1. **SafeZipExtractor**: Bảo mật
   - Kiểm tra ZIP bomb (file giải nén ra 10GB)
   - Chặn path traversal (`../../etc/passwd`)
   
2. **GtfsZipImporter**: Parse dữ liệu
   - Đọc từng file .txt (CSV format)
   - Lưu vào memory trước
   
3. **GtfsRowValidator**: Validate
   - Required fields có đầy đủ không?
   - References đúng không? (trip_id có tồn tại?)
   - Format đúng không? (latitude -90 đến 90)
   
4. **Store to DB**: Lưu vào PostgreSQL
   - Transaction: tất cả hoặc không (atomicity)
   - PostGIS tạo geometry cho stops
   
5. **Activate**: Chỉ khi admin approve
   - Tránh data lỗi ảnh hưởng users

---

### 2️⃣ User tìm trạm gần đây (Mobile)

```
┌─────────────────────┐
│ User mở app         │
└──────────┬──────────┘
           │
           v
┌─────────────────────┐
│ Request GPS         │
│ expo-location       │
└──────────┬──────────┘
           │
           v
┌─────────────────────┐
│ Got: lat=21.0285    │
│      lon=105.8242   │
└──────────┬──────────┘
           │
           v
┌──────────────────────────────┐
│ useQuery fetch API           │
│ GET /api/v1/search/nearby    │
│ ?lat=21.0285&lon=105.8242    │
│ &radius=1000                 │
└──────────┬───────────────────┘
           │
           v
┌─────────────────────┐
│ Laravel Backend     │
│ StopController      │
│ ::nearby()          │
└──────────┬──────────┘
           │
           v
┌─────────────────────┐
│ Check Redis cache   │
│ Key: stops:nearby:  │
│      21.0285:105... │
└──────────┬──────────┘
           │
           ├─ Cache hit? ──> Return cached JSON (5ms)
           │
           v (Cache miss)
┌─────────────────────────────┐
│ PostgreSQL + PostGIS query  │
│                             │
│ SELECT stop_id, stop_name,  │
│   ST_Distance(...) as dist  │
│ FROM stops                  │
│ WHERE ST_DWithin(           │
│   stop_location,            │
│   POINT(105.8242, 21.0285), │
│   1000                      │
│ )                           │
│ ORDER BY dist               │
│ LIMIT 20                    │
└──────────┬──────────────────┘
           │
           v
┌─────────────────────┐
│ Save to Redis       │
│ TTL: 5 minutes      │
└──────────┬──────────┘
           │
           v
┌─────────────────────┐
│ JSON Response       │
│ {                   │
│   data: [...]       │
│   meta: {...}       │
│ }                   │
└──────────┬──────────┘
           │
           v
┌─────────────────────┐
│ TanStack Query      │
│ - Cache response    │
│ - Update UI         │
└──────────┬──────────┘
           │
           v
┌─────────────────────┐
│ MapView hiển thị    │
│ - Markers (stops)   │
│ - User location     │
└─────────────────────┘
```

**Performance:**
- First request: ~100ms (query DB + PostGIS)
- Cached requests: ~5ms (Redis)
- PostGIS index: GiST làm spatial query nhanh

---

### 3️⃣ Tìm giờ xe chạy từ trạm

```
┌─────────────────────┐
│ User chọn trạm      │
│ "Bến xe Yên Nghĩa"  │
│ stop_id: "YN001"    │
└──────────┬──────────┘
           │
           v
┌────────────────────────────┐
│ GET /api/v1/gtfs/stops/    │
│     YN001/departures       │
│ ?date=2024-10-22           │
│ &time=08:00:00             │
└──────────┬─────────────────┘
           │
           v
┌─────────────────────┐
│ ServiceDateResolver │
│ - Hôm nay thứ mấy?  │
│ - Service nào active?│
└──────────┬──────────┘
           │
           v
┌───────────────────────────┐
│ Query calendar_services   │
│ WHERE start_date <= today │
│   AND end_date >= today   │
│   AND tuesday = true      │
│ → service_ids: [1, 2, 5]  │
└──────────┬────────────────┘
           │
           v
┌───────────────────────────┐
│ Check calendar_dates      │
│ - Exceptions (holidays)   │
│ - Type 1: Add service     │
│ - Type 2: Remove service  │
└──────────┬────────────────┘
           │
           v
┌─────────────────────────────┐
│ Active services: [1, 2, 5, 8]│
└──────────┬──────────────────┘
           │
           v
┌─────────────────────────────────┐
│ DepartureQueryService           │
│ Query stop_times JOIN trips     │
│                                 │
│ SELECT st.departure_seconds,    │
│   t.trip_headsign,              │
│   r.route_short_name            │
│ FROM stop_times st              │
│ JOIN trips t ON ...             │
│ JOIN routes r ON ...            │
│ WHERE st.stop_id = 'YN001'      │
│   AND t.service_id IN (1,2,5,8) │
│   AND st.departure_seconds      │
│       >= 28800 (08:00)          │
│ ORDER BY departure_seconds      │
│ LIMIT 10                        │
└──────────┬──────────────────────┘
           │
           v
┌─────────────────────┐
│ Result:             │
│ - 08:05 Tuyến 01    │
│ - 08:15 Tuyến 07    │
│ - 08:30 Tuyến 01    │
│ - 08:45 Tuyến 12    │
└──────────┬──────────┘
           │
           v
┌─────────────────────┐
│ Format & Response   │
│ - seconds → HH:MM   │
│ - Calculate minutes │
│   until departure   │
└──────────┬──────────┘
           │
           v
┌─────────────────────┐
│ Mobile UI hiển thị  │
│ List departures     │
└─────────────────────┘
```

**Giải thích phức tạp:**

**GTFS Time**: 25:30:00 = 1h30 sáng hôm sau
- Xe chạy đêm qua 0h → vẫn tính service_date của hôm trước
- `departure_seconds` = 25*3600 + 30*60 = 91800 giây

**Service Calendar:**
- `calendar_services`: Lịch cố định (Thứ 2-6 chạy, Thứ 7-CN nghỉ)
- `calendar_dates`: Exceptions (Tết nghỉ, Ngày lễ chạy thêm)
- Logic: `(calendar - removed_exceptions) + added_exceptions`

---

### 4️⃣ Realtime Vehicle Tracking (Future)

```
┌─────────────────────┐
│ Bus có GPS module   │
└──────────┬──────────┘
           │ Every 10s
           v
┌────────────────────────────┐
│ POST /api/v1/vehicles/     │
│      location              │
│ {                          │
│   vehicle_id: "BUS-123",   │
│   route_id: "01",          │
│   trip_id: "T001",         │
│   lat: 21.0285,            │
│   lon: 105.8242,           │
│   timestamp: "..."         │
│ }                          │
└──────────┬─────────────────┘
           │
           v
┌─────────────────────┐
│ Laravel Controller  │
│ VehicleController   │
│ ::updateLocation()  │
└──────────┬──────────┘
           │
           v
┌─────────────────────┐
│ Save to DB          │
│ vehicle_positions   │
│ (keep last 24h)     │
└──────────┬──────────┘
           │
           v
┌─────────────────────┐
│ Redis Pub/Sub       │
│ PUBLISH channel:    │
│ "route:01:vehicles" │
└──────────┬──────────┘
           │
           v
┌─────────────────────┐
│ Laravel Reverb      │
│ (WebSocket server)  │
│ Broadcast to        │
│ subscribed clients  │
└──────────┬──────────┘
           │
           v
┌─────────────────────┐
│ Mobile App          │
│ WebSocket listener  │
│ useEffect(() => {   │
│   socket.on(...)    │
│ })                  │
└──────────┬──────────┘
           │
           v
┌─────────────────────┐
│ Update Marker       │
│ position on Map     │
│ Smooth animation    │
└─────────────────────┘
```

**Công nghệ:**
- **Laravel Reverb**: WebSocket server của Laravel 11
- **Redis Pub/Sub**: Message broker
- **Socket.io client**: Mobile connect WebSocket

---

## 📋 PHẦN 3: KẾ HOẠCH IMPLEMENTATION

### Phase 1: Core Backend (Week 1-2) ✅ 70% DONE

**Priority: HIGH**

#### ✅ Already Implemented:
1. Database schema (PostgreSQL + PostGIS)
2. GTFS models (Agency, Route, Stop, Trip, StopTime)
3. API Controllers:
   - StopController (search, show, nearby, departures)
   - RouteController (search, show, trips)
   - TripController
4. Domain Services:
   - ServiceDateResolver (xác định service active)
   - DepartureQueryService (tìm giờ xe chạy)
   - GtfsTime (parse GTFS time format)
5. Unit Tests:
   - ServiceDateResolverTest ✅
   - DepartureQueryServiceTest ✅
   - GtfsTimeTest ✅

#### 🔨 TODO Backend:

**1. Complete GTFS Import Service**
```bash
# Files to create/complete:
backend/app/Services/GtfsImportService.php
backend/app/Jobs/ProcessGtfsImport.php
backend/app/Http/Controllers/Api/ImportController.php
```

Tasks:
- [ ] Complete SafeZipExtractor (ZIP validation)
- [ ] Complete GtfsZipImporter (CSV parsing)
- [ ] Complete GtfsRowValidator (data validation)
- [ ] Create background job cho import (Laravel Queue)
- [ ] Import progress tracking (0-100%)
- [ ] Error reporting UI-friendly

**2. Complete API Endpoints**
```bash
# Missing endpoints:
GET  /api/v1/gtfs/agencies
POST /api/v1/admin/import/upload
POST /api/v1/admin/import/{id}/process
GET  /api/v1/admin/import/{id}/status
GET  /api/v1/admin/import/{id}/errors
```

**3. Add Caching Layer**
```php
// StopController::nearby() - Add Redis cache
Cache::remember("stops:nearby:{$lat}:{$lon}:{$radius}", 300, function() {
    // Query PostgreSQL
});

// RouteController::index() - Cache routes list
Cache::remember("routes:all:{$versionId}", 900, function() {
    // Query routes
});
```

**4. Add Rate Limiting**
```php
// routes/api.php
Route::middleware('throttle:60,1')->group(function() {
    // API routes
});
```

**5. API Documentation**
- [ ] Generate OpenAPI/Swagger docs
- [ ] API examples with Postman collection

---

### Phase 2: Core Mobile (Week 3-4)

**Priority: HIGH**

#### 🔨 TODO Mobile:

**1. Setup Navigation**
```bash
npm install @react-navigation/native-stack
npm install @react-navigation/bottom-tabs
```

Structure:
```
screens/
  ├── HomeScreen.tsx          # Tìm kiếm trạm/tuyến
  ├── MapScreen.tsx           # Bản đồ với markers
  ├── StopDetailScreen.tsx    # Chi tiết trạm + departures
  ├── RouteDetailScreen.tsx   # Chi tiết tuyến + trips
  └── SettingsScreen.tsx      # Cài đặt
```

**2. Setup API Client**
```bash
npm install axios
```

Create:
```typescript
// src/api/client.ts
import axios from 'axios';

const api = axios.create({
  baseURL: 'http://your-backend.com/api/v1',
  timeout: 10000,
});

export default api;

// src/api/stops.ts
export const stopsApi = {
  nearby: (lat: number, lon: number, radius = 1000) =>
    api.get('/search/nearby', { params: { lat, lon, radius } }),
  
  search: (query: string) =>
    api.get('/search/stops', { params: { q: query } }),
  
  getDetails: (stopId: string) =>
    api.get(`/gtfs/stops/${stopId}`),
  
  getDepartures: (stopId: string, date?: string, time?: string) =>
    api.get(`/gtfs/stops/${stopId}/departures`, { params: { date, time } }),
};

// src/api/routes.ts
export const routesApi = {
  search: (query: string) =>
    api.get('/search/routes', { params: { q: query } }),
  
  list: () =>
    api.get('/gtfs/routes'),
  
  getDetails: (routeId: string) =>
    api.get(`/gtfs/routes/${routeId}`),
  
  getTrips: (routeId: string, date?: string) =>
    api.get(`/gtfs/routes/${routeId}/trips`, { params: { date } }),
};
```

**3. Setup TanStack Query Hooks**
```typescript
// src/hooks/useStops.ts
import { useQuery } from '@tanstack/react-query';
import { stopsApi } from '../api/stops';

export function useNearbyStops(lat: number, lon: number, radius = 1000) {
  return useQuery({
    queryKey: ['stops', 'nearby', lat, lon, radius],
    queryFn: () => stopsApi.nearby(lat, lon, radius),
    staleTime: 5 * 60 * 1000, // Cache 5 minutes
    enabled: !!(lat && lon), // Only run if we have coordinates
  });
}

export function useStopDepartures(stopId: string, date?: string, time?: string) {
  return useQuery({
    queryKey: ['stops', stopId, 'departures', date, time],
    queryFn: () => stopsApi.getDepartures(stopId, date, time),
    staleTime: 60 * 1000, // Cache 1 minute (fresher data for departures)
    refetchInterval: 60 * 1000, // Auto refetch every minute
  });
}

// src/hooks/useRoutes.ts
export function useRoutes() {
  return useQuery({
    queryKey: ['routes'],
    queryFn: () => routesApi.list(),
    staleTime: 15 * 60 * 1000, // Cache 15 minutes
  });
}

export function useRouteDetails(routeId: string) {
  return useQuery({
    queryKey: ['routes', routeId],
    queryFn: () => routesApi.getDetails(routeId),
    staleTime: 10 * 60 * 1000,
  });
}
```

**4. Implement Map Screen**
```bash
npm install react-native-maps
```

```typescript
// src/screens/MapScreen.tsx
import MapView, { Marker, PROVIDER_GOOGLE } from 'react-native-maps';
import * as Location from 'expo-location';

export function MapScreen() {
  const [location, setLocation] = useState(null);
  const { data: stops, isLoading } = useNearbyStops(
    location?.coords.latitude,
    location?.coords.longitude,
    1000
  );

  useEffect(() => {
    (async () => {
      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status === 'granted') {
        const loc = await Location.getCurrentPositionAsync();
        setLocation(loc);
      }
    })();
  }, []);

  return (
    <MapView
      provider={PROVIDER_GOOGLE}
      style={{ flex: 1 }}
      region={{
        latitude: location?.coords.latitude ?? 21.0285,
        longitude: location?.coords.longitude ?? 105.8242,
        latitudeDelta: 0.01,
        longitudeDelta: 0.01,
      }}
      showsUserLocation
      showsMyLocationButton
    >
      {stops?.data.map((stop) => (
        <Marker
          key={stop.stop_id}
          coordinate={{
            latitude: stop.stop_lat,
            longitude: stop.stop_lon,
          }}
          title={stop.stop_name}
          description={`${Math.round(stop.distance)}m away`}
        />
      ))}
    </MapView>
  );
}
```

**5. Implement Stop Detail Screen**
```typescript
// src/screens/StopDetailScreen.tsx
export function StopDetailScreen({ route }) {
  const { stopId } = route.params;
  const { data: departures, isLoading } = useStopDepartures(stopId);

  if (isLoading) return <LoadingSpinner />;

  return (
    <ScrollView>
      <Text style={styles.title}>{departures.meta.stop_name}</Text>
      <Text style={styles.subtitle}>Các chuyến tiếp theo</Text>
      
      {departures.data.map((departure, idx) => (
        <View key={idx} style={styles.departureCard}>
          <View style={styles.routeBadge}>
            <Text style={styles.routeNumber}>{departure.route_short_name}</Text>
          </View>
          <View style={styles.departureInfo}>
            <Text style={styles.headsign}>{departure.trip_headsign}</Text>
            <Text style={styles.time}>{departure.departure_time}</Text>
            <Text style={styles.countdown}>
              {departure.minutes_until === 0 ? 'Sắp tới' : `${departure.minutes_until} phút`}
            </Text>
          </View>
        </View>
      ))}
    </ScrollView>
  );
}
```

**6. Implement Search**
```typescript
// src/screens/HomeScreen.tsx
import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';

export function HomeScreen() {
  const [query, setQuery] = useState('');
  
  const { data: stops } = useQuery({
    queryKey: ['stops', 'search', query],
    queryFn: () => stopsApi.search(query),
    enabled: query.length >= 2, // Only search if 2+ characters
  });

  const { data: routes } = useQuery({
    queryKey: ['routes', 'search', query],
    queryFn: () => routesApi.search(query),
    enabled: query.length >= 1,
  });

  return (
    <View>
      <TextInput
        placeholder="Tìm trạm hoặc tuyến..."
        value={query}
        onChangeText={setQuery}
      />
      
      {/* Stops results */}
      <Text style={styles.sectionTitle}>Trạm xe</Text>
      {stops?.data.map(stop => (
        <TouchableOpacity
          key={stop.stop_id}
          onPress={() => navigation.navigate('StopDetail', { stopId: stop.stop_id })}
        >
          <Text>{stop.stop_name}</Text>
        </TouchableOpacity>
      ))}
      
      {/* Routes results */}
      <Text style={styles.sectionTitle}>Tuyến xe</Text>
      {routes?.data.map(route => (
        <TouchableOpacity
          key={route.route_id}
          onPress={() => navigation.navigate('RouteDetail', { routeId: route.route_id })}
        >
          <Text>{route.route_short_name} - {route.route_long_name}</Text>
        </TouchableOpacity>
      ))}
    </View>
  );
}
```

---

### Phase 3: Advanced Features (Week 5-6)

**Priority: MEDIUM**

#### 🔨 TODO:

**1. Favorites (Yêu thích)**
- [ ] AsyncStorage để lưu favorite stops/routes
- [ ] UI thêm/xóa favorites
- [ ] Tab "Yêu thích" trong HomeScreen

```typescript
// src/storage/favorites.ts
import AsyncStorage from '@react-native-async-storage/async-storage';

export async function addFavoriteStop(stopId: string) {
  const favorites = await getFavoriteStops();
  if (!favorites.includes(stopId)) {
    favorites.push(stopId);
    await AsyncStorage.setItem('favorite_stops', JSON.stringify(favorites));
  }
}

export async function getFavoriteStops(): Promise<string[]> {
  const json = await AsyncStorage.getItem('favorite_stops');
  return json ? JSON.parse(json) : [];
}
```

**2. Trip Planning**
- [ ] Input: Điểm đi → Điểm đến
- [ ] Algorithm: Tìm tuyến đi qua cả 2 điểm
- [ ] Display: Danh sách options với thời gian

**3. Notifications**
- [ ] Thông báo xe sắp đến (5 phút trước)
- [ ] Expo Notifications
- [ ] Background task

**4. Offline Mode**
- [ ] Download GTFS data to SQLite local
- [ ] Query offline khi không có mạng
- [ ] Sync khi có mạng

---

### Phase 4: Realtime & Admin (Week 7-8)

**Priority: LOW (Future Enhancement)**

#### 🔨 TODO Backend:

**1. Vehicle Tracking**
```php
// backend/app/Http/Controllers/Api/VehicleController.php
public function updateLocation(Request $request) {
    $validated = $request->validate([
        'vehicle_id' => 'required|string',
        'route_id' => 'required|string',
        'trip_id' => 'required|string',
        'lat' => 'required|numeric|between:-90,90',
        'lon' => 'required|numeric|between:-180,180',
    ]);
    
    // Save to DB
    VehiclePosition::create([
        'vehicle_id' => $validated['vehicle_id'],
        'route_id' => $validated['route_id'],
        'trip_id' => $validated['trip_id'],
        'location' => DB::raw("ST_SetSRID(ST_MakePoint({$validated['lon']}, {$validated['lat']}), 4326)"),
        'timestamp' => now(),
    ]);
    
    // Broadcast to WebSocket
    broadcast(new VehicleLocationUpdated($validated));
    
    return response()->json(['status' => 'ok']);
}
```

**2. Laravel Reverb (WebSocket)**
```bash
composer require laravel/reverb
php artisan reverb:install
php artisan reverb:start
```

**3. Admin Panel**
- [ ] GTFS import UI
- [ ] Version management
- [ ] Validation errors review
- [ ] Traffic incidents management
- [ ] Detours management

#### 🔨 TODO Mobile:

**1. WebSocket Integration**
```bash
npm install socket.io-client
```

```typescript
// src/services/websocket.ts
import io from 'socket.io-client';

const socket = io('ws://your-backend.com');

socket.on('vehicle.location.updated', (data) => {
  console.log('Vehicle position:', data);
  // Update map marker
});
```

**2. Live Vehicle Markers**
```typescript
// Update MapScreen to show moving vehicles
<Marker
  coordinate={{ latitude: vehicle.lat, longitude: vehicle.lon }}
  image={require('../assets/bus-icon.png')}
/>
```

---

## 📊 PHẦN 4: TESTING STRATEGY

### Backend Testing

**1. Unit Tests (PHPUnit)**
```bash
php artisan test --filter=Unit
```

Tests:
- [x] GtfsTimeTest - Parse GTFS time format ✅
- [x] ServiceDateResolverTest - Service calendar logic ✅
- [x] DepartureQueryServiceTest - Departure queries ✅
- [ ] SafeZipExtractorTest - ZIP security
- [ ] GtfsRowValidatorTest - Data validation

**2. Feature Tests**
```bash
php artisan test --filter=Feature
```

Tests:
- [ ] StopControllerTest
  - GET /api/v1/search/nearby
  - GET /api/v1/gtfs/stops/{id}/departures
- [ ] RouteControllerTest
  - GET /api/v1/gtfs/routes
  - GET /api/v1/gtfs/routes/{id}/trips
- [ ] ImportControllerTest
  - POST /api/v1/admin/import/upload
  - Import validation

**3. Integration Tests**
- [ ] Full GTFS import flow
- [ ] Database constraints
- [ ] Cache invalidation

---

### Mobile Testing

**1. Unit Tests (Jest)**
```bash
npm test
```

Tests:
- [ ] API client functions
- [ ] Utility functions (time formatting, distance calc)
- [ ] Custom hooks logic

**2. Component Tests (React Testing Library)**
```typescript
// __tests__/StopDetailScreen.test.tsx
import { render, waitFor } from '@testing-library/react-native';

test('displays departures', async () => {
  const { getByText } = render(<StopDetailScreen stopId="123" />);
  await waitFor(() => {
    expect(getByText('Tuyến 01')).toBeTruthy();
  });
});
```

**3. E2E Tests (Detox)**
```bash
npm install -D detox
```

Tests:
- [ ] Search for stop → View departures
- [ ] Open map → Tap marker → View details
- [ ] Add to favorites → View in favorites tab

---

## 🔐 PHẦN 5: SECURITY CONSIDERATIONS

### Backend Security

**1. Input Validation**
```php
// All API requests validate input
$request->validate([
    'lat' => 'required|numeric|between:-90,90',
    'lon' => 'required|numeric|between:-180,180',
    'radius' => 'integer|min:100|max:5000',
]);
```

**2. SQL Injection Prevention**
- ✅ Eloquent ORM auto-escapes
- ✅ DB::select() with parameter binding
```php
DB::select("SELECT * FROM stops WHERE id = ?", [$id]); // Safe
```

**3. Rate Limiting**
```php
Route::middleware('throttle:60,1')->group(...); // 60 requests/minute
```

**4. CORS Configuration**
```php
// config/cors.php
'allowed_origins' => [env('MOBILE_APP_ORIGIN')],
'allowed_methods' => ['GET', 'POST'],
```

**5. ZIP Upload Security**
- [ ] Max file size: 50MB
- [ ] Check ZIP bomb (decompression ratio)
- [ ] Validate file extensions (.txt only)
- [ ] Path traversal prevention
```php
// Prevent ../../../etc/passwd
if (str_contains($filename, '..')) {
    throw new SecurityException('Invalid filename');
}
```

**6. Authentication (Future)**
- Laravel Sanctum for token-based auth
- Admin panel requires authentication
- Public API endpoints (stops, routes) no auth required

---

### Mobile Security

**1. API Key Storage**
```typescript
// Use environment variables, not hardcoded
const API_KEY = process.env.EXPO_PUBLIC_API_KEY;
```

**2. HTTPS Only**
```typescript
const api = axios.create({
  baseURL: 'https://api.busfast.com', // HTTPS required
});
```

**3. Certificate Pinning (Production)**
```bash
npm install react-native-ssl-pinning
```

**4. Sensitive Data**
- Don't store passwords in AsyncStorage
- Use SecureStore for tokens

---

## 📈 PHẦN 6: PERFORMANCE OPTIMIZATION

### Backend Optimization

**1. Database Indexes** ✅
```sql
-- Already created in migration
CREATE INDEX idx_stops_location ON stops USING GIST (stop_location);
CREATE INDEX idx_stop_times_departure ON stop_times(dataset_version_id, stop_id, departure_seconds);
CREATE INDEX idx_trips_service ON trips(dataset_version_id, service_id);
```

**2. Query Optimization**
- [ ] Use `EXPLAIN ANALYZE` to check slow queries
- [ ] Eager loading: `Route::with('agency')->get()` (avoid N+1)
- [ ] Pagination: `paginate(20)` instead of `get()`

**3. Caching Strategy**
```php
// Cache hot data
Cache::remember('routes:all', 900, fn() => Route::all()); // 15 min
Cache::remember('stops:nearby:...', 300, fn() => ...);    // 5 min
Cache::remember('stops:departures:...', 60, fn() => ...); // 1 min
```

**4. Queue for Heavy Tasks**
```php
// Import GTFS in background
dispatch(new ProcessGtfsImport($filePath));
```

---

### Mobile Optimization

**1. Image Optimization**
- Use WebP format for icons
- Lazy load images
- Cache images with expo-image

**2. List Performance**
```typescript
// Use FlatList with performance props
<FlatList
  data={stops}
  renderItem={renderStop}
  keyExtractor={item => item.stop_id}
  initialNumToRender={10}
  maxToRenderPerBatch={10}
  windowSize={5}
  removeClippedSubviews={true} // Android optimization
/>
```

**3. Query Optimization**
```typescript
// TanStack Query with proper cache
useQuery({
  queryKey: ['stops', 'nearby', lat, lon],
  queryFn: fetchStops,
  staleTime: 5 * 60 * 1000,    // Don't refetch for 5 min
  cacheTime: 10 * 60 * 1000,   // Keep in cache for 10 min
  refetchOnWindowFocus: false, // Don't refetch on app focus
});
```

**4. Bundle Size**
- Use Hermes engine (default in RN 0.76)
- Enable ProGuard (Android) / optimization (iOS)
```json
// app.json
{
  "expo": {
    "android": {
      "enableProguardInReleaseBuilds": true,
      "enableShrinkResourcesInReleaseBuilds": true
    }
  }
}
```

---

## 🚀 PHẦN 7: DEPLOYMENT GUIDE

### Backend Deployment

**1. Server Requirements**
- VPS: DigitalOcean, AWS EC2, Vultr
- OS: Ubuntu 22.04 LTS
- RAM: 2GB minimum, 4GB recommended
- Storage: 20GB SSD

**2. Software Stack**
```bash
# Install PHP 8.2
sudo apt install php8.2-fpm php8.2-pgsql php8.2-redis php8.2-mbstring

# Install PostgreSQL 16 + PostGIS
sudo apt install postgresql-16 postgresql-16-postgis-3

# Install Redis 7
sudo apt install redis-server

# Install Nginx
sudo apt install nginx

# Install Composer
curl -sS https://getcomposer.org/installer | php
sudo mv composer.phar /usr/local/bin/composer
```

**3. Deploy Laravel**
```bash
# Clone repo
git clone https://github.com/your-repo/busfast-backend.git
cd busfast-backend

# Install dependencies
composer install --no-dev --optimize-autoloader

# Environment
cp .env.example .env
nano .env # Configure DB, Redis, etc.

# Generate key
php artisan key:generate

# Run migrations
php artisan migrate --force

# Cache config
php artisan config:cache
php artisan route:cache
php artisan view:cache

# Set permissions
sudo chown -R www-data:www-data storage bootstrap/cache
sudo chmod -R 775 storage bootstrap/cache
```

**4. Nginx Configuration**
```nginx
server {
    listen 80;
    server_name api.busfast.com;
    root /var/www/busfast-backend/public;

    add_header X-Frame-Options "SAMEORIGIN";
    add_header X-Content-Type-Options "nosniff";

    index index.php;

    location / {
        try_files $uri $uri/ /index.php?$query_string;
    }

    location ~ \.php$ {
        fastcgi_pass unix:/var/run/php/php8.2-fpm.sock;
        fastcgi_param SCRIPT_FILENAME $realpath_root$fastcgi_script_name;
        include fastcgi_params;
    }

    location ~ /\.(?!well-known).* {
        deny all;
    }
}
```

**5. SSL Certificate**
```bash
sudo apt install certbot python3-certbot-nginx
sudo certbot --nginx -d api.busfast.com
```

**6. Laravel Queue Worker**
```bash
# Supervisor config: /etc/supervisor/conf.d/busfast-worker.conf
[program:busfast-worker]
process_name=%(program_name)s_%(process_num)02d
command=php /var/www/busfast-backend/artisan queue:work --sleep=3 --tries=3
autostart=true
autorestart=true
user=www-data
numprocs=2
redirect_stderr=true
stdout_logfile=/var/www/busfast-backend/storage/logs/worker.log
```

---

### Mobile Deployment

**1. Build APK (Android)**
```bash
# Install EAS CLI
npm install -g eas-cli

# Login
eas login

# Configure
eas build:configure

# Build
eas build --platform android --profile production

# Output: app-release.apk
```

**2. Build IPA (iOS)**
```bash
# Requires Apple Developer Account ($99/year)
eas build --platform ios --profile production

# Output: app-release.ipa
```

**3. Submit to Stores**
```bash
# Google Play Store
eas submit --platform android

# Apple App Store
eas submit --platform ios
```

**4. OTA Updates**
```bash
# Update without going through stores
eas update --branch production --message "Fix bug X"

# Users receive update automatically
```

---

## 📦 PHẦN 8: PRIORITY SUMMARY

### ⚡ CRITICAL (Làm ngay)
1. ✅ Database schema (DONE)
2. ✅ Core API endpoints (70% DONE)
3. 🔨 Complete GTFS import service
4. 🔨 Mobile app navigation structure
5. 🔨 Map screen with nearby stops
6. 🔨 Stop detail with departures
7. 🔨 Search functionality

### 🎯 HIGH (Làm sau Critical)
1. Redis caching layer
2. Rate limiting
3. API documentation
4. Route detail screen
5. Error handling & loading states
6. Unit tests coverage >80%

### 📌 MEDIUM (Nice to have)
1. Favorites feature
2. Trip planning
3. Offline mode
4. Push notifications
5. Admin panel UI

### 🌟 LOW (Future enhancement)
1. Realtime vehicle tracking
2. WebSocket integration
3. Traffic incidents
4. Detours management
5. Multi-language support

---

## 🎓 PHẦN 9: TÓM TẮT TECH STACK VÀ LÝ DO

| Công nghệ | Vai trò | Tại sao chọn? |
|-----------|---------|---------------|
| **Laravel 11** | Backend API framework | Rapid dev, ORM, Queue, Testing built-in |
| **PostgreSQL 16** | Database | ACID, JSON, Advanced queries |
| **PostGIS** | GIS extension | Spatial queries (distance, radius) |
| **Redis 7** | Cache & Session | Fast, Pub/Sub, TTL support |
| **React Native** | Mobile framework | Cross-platform (iOS + Android) |
| **Expo** | RN toolchain | Easy setup, OTA updates, Built-in APIs |
| **TanStack Query** | Server state mgmt | Auto cache, refetch, loading states |
| **TypeScript** | Type safety | Catch bugs early, Autocomplete |
| **React Native Maps** | Map display | Native maps, Markers, Polylines |

---

## 📞 NEXT STEPS

### Để bắt đầu development:

**Backend:**
```bash
cd backend
composer install
cp .env.example .env
# Configure database in .env
php artisan migrate
php artisan db:seed  # Seed sample data
php artisan serve
```

**Mobile:**
```bash
cd mobile
npm install
npx expo start
# Scan QR code with Expo Go app
```

### Câu hỏi cần clarify:

1. **GTFS Data Source**: Sẽ lấy dữ liệu GTFS từ đâu? (Transerve, Bộ GTVT, tự crawl?)
2. **Realtime Data**: Có kế hoạch tích hợp GPS từ xe bus không?
3. **Target Launch**: Mục tiêu launch khi nào? (MVP trong 1 tháng?)
4. **Budget**: Ngân sách cho VPS, Apple Developer Account?
5. **Team Size**: Có bao nhiêu developers?

---

## 🎯 KẾT LUẬN

Dự án BusFast có kiến trúc rõ ràng, tech stack phù hợp và đã implement ~70% backend core. 

**Ưu tiên cao nhất:**
1. Hoàn thành GTFS import service
2. Build mobile app với features cơ bản (Map, Search, Departures)
3. Deploy MVP để test với users thật

**Timeline ước tính MVP:**
- Week 1-2: Complete backend GTFS import + caching
- Week 3-4: Mobile core features
- Week 5: Testing & bug fixes
- Week 6: Deploy & launch

**Strengths của kiến trúc:**
- ✅ Scalable (PostgreSQL, Redis, Laravel)
- ✅ Maintainable (Clean code, tests)
- ✅ Cross-platform (React Native)
- ✅ GIS-optimized (PostGIS)

Có câu hỏi gì về tech stack hoặc implementation, cứ hỏi mình nhé! 🚀
