# Máy frontend của thành viên

Frontend của BusNext nằm trong thư mục `mobile/`. Source phải được giữ nguyên trong repository, nhưng dependency cài riêng trên máy thành viên frontend.

## Cần cài

- Node.js 20 LTS+
- npm
- Expo CLI dùng qua `npx expo`
- Android Emulator hoặc thiết bị thật nếu cần chạy trên Android

Không cần cài PHP, Composer, PostgreSQL, Redis hoặc Docker nếu máy này chỉ chạy mobile và gọi API từ máy backend.

## Cài và chạy

Clone repository, sau đó:

```bash
cd BusNext/mobile
npm install
npm run typecheck
npx expo start
```

Các lệnh `npm install` và `npm run typecheck` tạo/đọc dependency ở máy frontend; không cần chạy trên máy backend.

## Kết nối backend

Máy backend chạy:

```bash
cd /mnt/d/BusNext/backend
php artisan serve --host=0.0.0.0 --port=8000
```

Tạo file `mobile/.env` trên máy frontend và đặt một trong các URL sau:

```env
# Android Emulator chạy cùng máy backend
EXPO_PUBLIC_API_URL=http://10.0.2.2:8000/api

# Frontend chạy trên máy khác với backend
# EXPO_PUBLIC_API_URL=http://192.168.1.100:8000/api
```

Thay `192.168.1.100` bằng IPv4 LAN thật của máy backend. Hai máy phải cùng mạng Wi-Fi/LAN; Windows Firewall trên máy backend cần cho phép TCP 8000 trong Private network.

Không dùng `localhost` khi frontend chạy trên máy khác, vì khi đó `localhost` trỏ về máy frontend.

## Kiểm tra kết nối

Trên máy frontend, mở trình duyệt hoặc terminal và gọi:

```bash
curl http://<IP-LAN-máy-backend>:8000/api/health
```

Sau đó mở app bằng Expo. Nếu API không truy cập được, kiểm tra backend đang chạy với `0.0.0.0`, IP LAN, firewall và hai máy có cùng mạng không.
