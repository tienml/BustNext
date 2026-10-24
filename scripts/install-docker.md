# Không dùng tài liệu này

BusNext **không dùng Docker Desktop** theo quy trình hiện tại. Máy backend dùng Docker Engine và Docker Compose plugin chạy trực tiếp trong WSL2.

Hãy dùng các tài liệu chuẩn:

- [`scripts/install-docker-wsl.md`](install-docker-wsl.md) — cài Docker Engine trong WSL2.
- [`docs/wsl-setup.md`](../docs/wsl-setup.md) — thiết lập và chạy backend.
- [`docs/frontend-setup.md`](../docs/frontend-setup.md) — hướng dẫn thành viên frontend.

Cấu hình hiện tại:

- PostgreSQL/PostGIS 16
- Redis 7
- Database: `busnext`
- User: `busnext`
- Password: `busnext`
- Schema được tạo bằng Laravel migrations

Không chạy SQL schema cũ hoặc dùng database `busfast` theo các hướng dẫn trước đây.