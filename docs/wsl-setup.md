# Phát triển trên WSL2

Tài liệu này mô tả cách dùng WSL2 làm môi trường backend trên Windows. Frontend được chạy trên máy thành viên khác; các bước Node.js/Expo nằm trong phần frontend riêng bên dưới.

## Phạm vi và yêu cầu

Tài liệu này dành cho **máy backend**. Máy backend không cần cài Node.js, npm, Expo hoặc chạy `npm install` trong `mobile/`; các công cụ đó thuộc máy thành viên frontend.

- Windows 10 2004 (build 19041) trở lên hoặc Windows 11.
- WSL2 đã được bật và có một distro Linux (khuyến nghị Ubuntu LTS).
- Git được cài trong distro. Không trộn PHP hoặc Composer từ Windows vào cùng một terminal WSL.
- Công cụ backend: PHP 8.3+, Composer 2+, Docker Engine + Docker Compose plugin trong WSL.
- PHP extensions: `pdo_pgsql`, `mbstring`, `xml`, `zip`, `curl`, `redis`.
- PostgreSQL client là tùy chọn, vì PostgreSQL server chạy trong Docker.
- Không cần quyền root để chạy ứng dụng sau khi các gói đã được cài đặt.

Script kiểm tra chỉ đọc tại [`scripts/check-wsl.sh`](../scripts/check-wsl.sh). Script không bật WSL, cài gói, đổi cấu hình, khởi động container hoặc sửa dữ liệu.

## 1. Cài và xác nhận WSL2 trên Windows

Mở PowerShell **Run as Administrator** để cài WSL và distro (nếu máy chưa có):

```powershell
wsl --install -d Ubuntu
```

Khởi động lại khi Windows yêu cầu, mở Ubuntu một lần để tạo user Linux, sau đó xác nhận từ PowerShell:

```powershell
wsl --status
wsl --list --verbose
```

Cột `VERSION` của distro phải là `2`. Nếu distro đang ở WSL1, chuyển sang WSL2 bằng lệnh sau trong PowerShell (thay tên distro nếu cần):

```powershell
wsl --set-version Ubuntu 2
wsl --set-default-version 2
```

Các lệnh trên là thao tác cài đặt của Windows và không được script kiểm tra tự động thực hiện.

## 2. Chuẩn bị distro

Chạy các lệnh sau **trong terminal Ubuntu/WSL**, không phải PowerShell:

Cài các package backend:

```bash
sudo apt update
sudo apt install -y git curl unzip ca-certificates
```

Cài PHP 8.3+, Composer 2+ và Docker Engine trong WSL theo nguồn gói được tổ chức phê duyệt. Xác nhận phiên bản trước khi cài dependency:

```bash
php --version
composer --version
docker version
docker compose version
```

Kiểm tra các PHP extension:

```bash
php -m | grep -E '^(PDO|pdo_pgsql|mbstring|xml|zip|curl|redis)$'
```

## 3. Đặt mã nguồn và cài dependency backend

Để có hiệu năng I/O tốt hơn, nên đặt checkout backend trong filesystem Linux, ví dụ `~/src`, thay vì `/mnt/c/...`:

```bash
mkdir -p ~/src
cd ~/src
git clone <URL-repository> BusNext
cd BusNext

git config core.autocrlf input
bash scripts/check-wsl.sh
```

`<URL-repository>` là URL repository thực tế của dự án; tài liệu này không giả định URL nào.

Cài dependency và chạy test backend:

```bash
cd backend
cp .env.example .env
composer install
php artisan key:generate
php artisan migrate --seed
php artisan test
```

Nếu checkout hiện tại chưa có `.env.example`, tạo/cấu hình file môi trường theo quy trình backend thay vì tự ghi đè file `.env` hiện có.

## 4. Frontend trên máy thành viên

Giữ nguyên mã nguồn `mobile/src`, `mobile/App.tsx`, `mobile/package.json` và `mobile/package-lock.json` trong repository. Thành viên frontend clone cùng repository trên máy của họ rồi chạy:

```bash
cd mobile
npm install
npm run typecheck
npx expo start
```

Máy backend không cần chạy các lệnh trên và không cần giữ `mobile/node_modules`.

## 5. Chạy PostgreSQL và Redis trên máy backend

Từ thư mục gốc repository trong WSL:

```bash
cd /mnt/d/BusNext
sudo service docker start
docker compose up -d postgres redis
docker compose ps
```

Compose tạo volume `busnext-postgres`; không xóa volume hoặc chạy `down -v` trong quy trình kiểm tra thông thường vì thao tác đó xóa dữ liệu database.

## 6. Kết nối mobile với backend

- Backend phải chạy bằng `php artisan serve --host=0.0.0.0 --port=8000` để máy khác truy cập được.
- Frontend trên Android Emulator **cùng máy backend** thường dùng `http://10.0.2.2:8000/api`.
- Frontend trên **máy khác** dùng IP LAN của máy backend, ví dụ `http://192.168.x.x:8000/api`.
- Hai máy phải cùng mạng; Windows Firewall cần cho phép TCP 8000 trên Private network.
- Tạo `.env` hoặc cấu hình biến môi trường ở thư mục `mobile/` trên máy frontend:

```env
EXPO_PUBLIC_API_URL=http://192.168.x.x:8000/api
```

- Không dùng `localhost` trong URL frontend khi frontend chạy trên máy khác; `localhost` khi đó trỏ về chính máy frontend.
- Không đưa token, mật khẩu hoặc `.env` vào git.

## 7. Kiểm tra an toàn và xử lý lỗi

Chạy kiểm tra từ thư mục gốc:

```bash
bash scripts/check-wsl.sh
```

Script in các mục đạt/cảnh báo/lỗi và trả mã khác 0 khi môi trường không phải WSL2 hoặc thiếu điều kiện bắt buộc. Có thể xem trợ giúp mà không chạy các kiểm tra hệ thống:

```bash
bash scripts/check-wsl.sh --help
```

Một số lỗi thường gặp:

- `VERSION` là `1`: chạy `wsl --set-version <distro> 2` trong PowerShell rồi mở lại distro.
- Không thấy `docker`: cài Docker Engine + Compose plugin trong WSL theo [`scripts/install-docker-wsl.md`](../scripts/install-docker-wsl.md), sau đó mở terminal WSL mới.
- Port `5432` hoặc `6379` đã dùng: kiểm tra service đang chạy trước khi đổi port; không xóa volume để giải quyết xung đột.
- Dependency nằm dưới `/mnt/c`: chuyển checkout vào `~/src` và chạy lại lệnh cài dependency.
- File script có CRLF: chạy `git config core.autocrlf input`, sau đó checkout lại file hoặc dùng `sed -i 's/\r$//' scripts/check-wsl.sh` trên bản sao làm việc.

## 8. Dừng môi trường

Dừng container nhưng giữ dữ liệu volume:

```bash
docker compose stop
```

Chỉ người quản trị môi trường mới nên xóa volume sau khi đã xác nhận backup và dữ liệu không còn cần thiết. Không có lệnh xóa dữ liệu nào trong script kiểm tra.
