# 📚 Giải thích Tech Stack và Kiến trúc BusFast

## 🎯 Tổng quan

BusFast là ứng dụng tra cứu lịch trình xe bus sử dụng dữ liệu GTFS (General Transit Feed Specification) với kiến trúc **Backend API + Mobile App**.

---

## 🔧 BACKEND - PHP Laravel 11

### 🏗️ Tại sao chọn Laravel?

**Laravel** là PHP framework phổ biến nhất, phù hợp cho:
- ✅ **Rapid Development**: Có sẵn nhiều tính năng (ORM, Queue, Cache, Auth)
- ✅ **RESTful API**: Dễ dàng xây dựng API cho mobile
- ✅ **Database Migration**: Quản lý schema database dễ dàng
- ✅ **Testing**: PHPUnit tích hợp sẵn
- ✅ **Ecosystem**: Composer packages phong phú
- ✅ **Documentation**: Tài liệu tiếng Việt nhiều, dễ học

### 🗄️ PostgreSQL 16 + PostGIS

**Tại sao PostgreSQL thay vì MySQL?**

1. **PostGIS Extension**: Hỗ trợ GIS (Geographic Information System)
   - Tính khoảng cách giữa 2 điểm (stops)
   - Tìm trạm gần nhất theo bán kính
   - Lưu trữ coordinates hiệu quả với GEOGRAPHY type

2. **JSON Support**: Lưu trữ metadata, logs dạng JSON hiệu quả

3. **Advanced Indexing**: GiST index cho spatial queries

4. **ACID Compliance**: Đảm bảo tính toàn vẹn dữ liệu

**Ví dụ query tìm trạm gần vị trí hiện tại:**
```sql
SELECT stop_name, 
       ST_Distance(stop_location, ST_Point(105.8242, 21.0285)::geography) as distance
FROM stops
WHERE ST_DWithin(stop_location, ST_Point(105.8242, 21.0285)::geography, 1000)
ORDER BY distance;
```

### 🚀 Redis 7

**Vai trò:**
- **Cache**: Lưu kết quả query phổ biến (tuyến hot, trạm thường tra cứu)
- **Session**: Quản lý user sessions
- **Rate Limiting**: Chống spam API
- **Realtime**: Pub/Sub cho vehicle tracking

**Ví dụ:**
```php
// Cache danh sách routes 5 phút
$routes = Cache::remember('routes:all', 300, function() {
    return Route::with('agency')->get();
});
```

### 📦 Composer

**Package manager** của PHP - tương tự npm của Node.js
- Quản lý dependencies (Laravel, PHPUnit, etc.)
- Autoload classes theo PSR-4

---

## 📱 FRONTEND - React Native Expo

### 🎨 Tại sao chọn React Native?

**React Native** cho phép viết 1 lần, chạy cả iOS & Android:
- ✅ **Cross-platform**: Tiết kiệm thời gian phát triển
- ✅ **JavaScript/TypeScript**: Dễ tìm dev
- ✅ **Hot Reload**: Lập trình nhanh hơn
- ✅ **Native Performance**: Gần với native app
- ✅ **Large Community**: Nhiều thư viện, tài liệu

### 🚀 Expo Framework

**Expo** là bộ công cụ giúp React Native dễ hơn:
- ✅ **No Android Studio/Xcode**: Không cần cấu hình phức tạp
- ✅ **Expo Go**: Test trên điện thoại thật ngay lập tức
- ✅ **Built-in APIs**: Camera, Location, Maps, Notifications
- ✅ **OTA Updates**: Update app không qua store
- ✅ **EAS Build**: Build APK/IPA trên cloud

### 🗺️ React Native Maps

**Hiển thị bản đồ** với markers (trạm xe):
- Tích hợp Google Maps (Android) / Apple Maps (iOS)
- Zoom, pan, marker clustering
- Vẽ routes trên bản đồ (polylines)

### 🔄 TanStack Query (React Query)

**Quản lý server state** thay vì Redux:
- ✅ **Auto Caching**: Cache kết quả API tự động
- ✅ **Auto Refetch**: Tự động làm mới data khi cần
- ✅ **Optimistic Updates**: UI update trước, sync sau
- ✅ **Error Handling**: Retry, fallback dễ dàng

**Ví dụ:**
```typescript
const { data: stops, isLoading } = useQuery({
  queryKey: ['stops', 'nearby'],
  queryFn: () => api.stops.nearby(latitude, longitude),
  staleTime: 5 * 60 * 1000, // Cache 5 phút
});
```

### 🎭 TypeScript

**Tại sao dùng TypeScript?**
- ✅ **Type Safety**: Phát hiện lỗi lúc code, không phải lúc chạy
- ✅ **Autocomplete**: VS Code gợi ý code chính xác
- ✅ **Refactoring**: Đổi tên, move file an toàn
- ✅ **Documentation**: Type là tài liệu sống

---

## 🔄 LUỒNG HOẠT ĐỘNG TỔNG

### 1️⃣ Import GTFS Data (Admin)

```
Admin upload GTFS.zip
    ↓
Laravel validates ZIP (SafeZipExtractor)
    ↓
Parse CSV files (CsvReader)
    ↓
Validate rows (GtfsRowValidator)
    ↓
Store to PostgreSQL với version mới
    ↓
Activate version → Data sẵn sàng cho API
```

### 2️⃣ User tra cứu trạm (Mobile)

```
User mở app → Get GPS location
    ↓
Mobile gọi API: GET /api/stops/nearby?lat=21.0285&lng=105.8242
    ↓
Laravel query PostgreSQL với PostGIS:
    - ST_Distance tính khoảng cách
    - WHERE ST_DWithin lọc trong bán kính 1km
    ↓
Redis cache kết quả 5 phút
    ↓
JSON response về mobile
    ↓
React Native Maps hiển thị markers
```

### 3️⃣ Tìm giờ xe chạy

```
User chọn trạm "Bến xe Yên Nghĩa"
    ↓
Mobile: GET /api/stops/YN001/departures?date=2024-10-22&time=now
    ↓
Laravel:
    1. ServiceDateResolver → Xác định service_id nào active hôm nay
       (check calendar + calendar_dates exceptions)
    2. DepartureQueryService → Query stop_times
       - WHERE stop_id = 'YN001'
       - AND service_id IN (active_services)
       - AND departure_seconds >= current_time_in_seconds
       - ORDER BY departure_seconds
       - LIMIT 10
    ↓
Format response: [
    { route: "01", headsign: "Gia Lâm", time: "06:00" },
    { route: "07", headsign: "Nước Ngầm", time: "08:00" }
]
    ↓
Mobile hiển thị danh sách
```

### 4️⃣ Realtime Vehicle Tracking

```
Bus có GPS module → Gửi tọa độ lên server mỗi 10s
    ↓
Laravel API: POST /api/vehicles/location
    {
        "vehicle_id": "BUS-123",
        "route_id": "01",
        "lat": 21.0285,
        "lng": 105.8242
    }
    ↓
Laravel lưu vào vehicle_positions
    + Redis Pub/Sub broadcast
    ↓
Mobile subscribe qua WebSocket (Laravel Reverb)
    ↓
Nhận update realtime → Update marker trên map
```

### 5️⃣ Traffic Incident & Detour

```
Admin báo đường tắc:
    POST /api/incidents {
        "location": "Phố Kim Mã",
        "description": "Tai nạn giao thông"
    }
    ↓
Laravel tạo record traffic_incidents
    + Notify affected routes
    ↓
Admin tạo detour (đường đi khác):
    POST /api/detours {
        "route_id": "07",
        "shape_data": [...coordinates...]
    }
    ↓
Mobile query API:
    GET /api/routes/07/detours
    ↓
Hiển thị polyline màu đỏ trên map (đường cũ)
    + polyline màu xanh (detour mới)
    + Vehicle positions theo detour
```

---

## 🏗️ Kiến trúc Layer

### Backend (Laravel)

```
HTTP Request
    ↓
Routes (api.php)
    ↓
Controllers (thin layer)
    ↓
Services (business logic)
    ↓
Domain Objects (GtfsTime, ServiceDateResolver)
    ↓
Models (Eloquent ORM)
    ↓
Database (PostgreSQL)
```

### Frontend (React Native)

```
User Interaction
    ↓
Screen Components
    ↓
TanStack Query Hooks (useStops, useRoutes)
    ↓
API Client (axios)
    ↓
Backend API
```

---

## 🔐 Security

1. **API Authentication**: Laravel Sanctum (token-based)
2. **Rate Limiting**: Redis throttle (60 requests/minute)
3. **Input Validation**: Laravel Form Requests
4. **SQL Injection**: Eloquent ORM auto-escape
5. **XSS**: React Native auto-escape
6. **CORS**: Chỉ cho phép mobile app origin

---

## 📊 Performance Optimization

### Backend:
- **Database Indexes**: Đánh index đầy đủ (stop_id, route_id, departure_seconds)
- **Redis Cache**: Cache hot queries 5-15 phút
- **Eager Loading**: `->with('agency', 'route')` tránh N+1 query
- **Pagination**: Limit 20-50 items/page

### Frontend:
- **TanStack Query Cache**: Stale time 5 phút
- **Lazy Loading**: Load screen khi cần
- **Image Optimization**: WebP format, lazy load
- **Debounce Search**: 300ms delay khi user typing

---

## 🧪 Testing

### Backend:
```bash
# Unit tests
php artisan test --filter GtfsTimeTest

# Feature tests
php artisan test --filter StopControllerTest
```

### Frontend:
```bash
# Jest unit tests
npm test

# E2E tests (Detox)
npm run test:e2e
```

---

## 🚀 Deployment Flow

### Backend (Laravel):
```
Git push → main branch
    ↓
CI/CD (GitHub Actions)
    ↓
Run tests (PHPUnit)
    ↓
Build Docker image
    ↓
Deploy to VPS (DigitalOcean/AWS)
    ↓
Run migrations
    ↓
Clear cache
    ↓
Health check
```

### Mobile (Expo):
```
Git push → main branch
    ↓
EAS Build (cloud)
    ↓
Generate APK (Android) + IPA (iOS)
    ↓
Submit to Play Store / App Store
    hoặc
OTA Update (không cần store)
```

---

## 📈 Scalability

Khi có nhiều user:

1. **Horizontal Scaling**: Thêm Laravel servers (load balancer)
2. **Database Replication**: Master (write) + Slaves (read)
3. **Redis Cluster**: Phân tán cache
4. **CDN**: Static assets (images, maps tiles)
5. **Queue Workers**: Xử lý import GTFS async

---

## 🔄 Multi-Agent Workflow

Workflow tự động hóa development với 5 agents:

```
User Request
    ↓
LEADER Agent (điều phối)
    ├─→ CONTENT Agent (brainstorm ideas với subagents)
    │       ↓ discuss internally
    │       ↓ propose to Leader
    │       ↓ wait approval
    ├─→ CODER Agent (implement)
    │       ↓ write code
    │       ↓ notify Tester
    ├─→ TESTER Agent (review với subagents)
    │       ↓ test correctness, security, performance
    │       ↓ report issues → Coder fix
    │       ↓ iterate until both agree
    │       ↓ notify Leader
    └─→ UI/UX Agent (experience test với subagents)
            ↓ test usability, accessibility
            ↓ report issues → Leader
            ↓ Leader integrates all feedback
```

**Lợi ích:**
- ✅ Parallel work (Content + Coder + Tester cùng làm)
- ✅ Quality assurance (Tester check code)
- ✅ User experience focus (UI/UX agent)
- ✅ Traceability (Leader track tất cả)

---

## 📦 Tóm tắt Tech Stack

| Layer | Technology | Vai trò |
|-------|-----------|---------|
| **Backend API** | Laravel 11 (PHP 8.2) | RESTful API, Business Logic |
| **Database** | PostgreSQL 16 + PostGIS | GTFS data, GIS queries |
| **Cache** | Redis 7 | Cache, Session, Realtime |
| **Mobile** | React Native + Expo | Cross-platform app |
| **State Management** | TanStack Query | Server state, caching |
| **Maps** | react-native-maps | Hiển thị bản đồ, markers |
| **Language** | TypeScript | Type safety cho frontend |
| **Package Manager** | Composer (BE), npm (FE) | Dependency management |
| **Testing** | PHPUnit (BE), Jest (FE) | Unit & Integration tests |
| **Container** | Docker Compose | Local development environment |
| **Version Control** | Git | Source control |
| **CI/CD** | GitHub Actions | Automated testing & deployment |

---

## 🎯 Kết luận

Kiến trúc này được thiết kế để:
- ✅ **Scalable**: Dễ mở rộng khi có nhiều user
- ✅ **Maintainable**: Code tổ chức rõ ràng, dễ sửa
- ✅ **Performant**: Cache, index, optimization đầy đủ
- ✅ **Reliable**: Testing, error handling, validation
- ✅ **Developer-friendly**: Hot reload, type safety, documentation

Bất kỳ câu hỏi nào về tech stack, cứ hỏi mình!
