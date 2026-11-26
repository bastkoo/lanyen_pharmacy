# Lan Yến Pharmacy Mobile

Nền tảng Local với dữ liệu giả lập, một ứng dụng Flutter và ba vai trò.
Đây là preview thiết kế/kiến trúc; chưa đăng nhập hoặc giao dịch với Backend.

```powershell
cd mobile
flutter pub get
flutter run -d chrome
```

Chọn Khách hàng, Nhân viên hoặc Quản lý để xem Theme và mẫu tương tác.
Thoát preview để đổi vai trò. Không nhập dữ liệu cá nhân thật.

```powershell
flutter run -d chrome --dart-define=DEMO_MODE=false
flutter run -d chrome --dart-define=API_BASE_URL=http://127.0.0.1:5000/api
```

DEMO_MODE=false khóa mock accounts, chưa thay thế bằng login thật.
5000 được xác minh trong backend/run.py, không phải khẳng định process đang chạy.
API_BASE_URL chỉ chuẩn bị cấu hình: transport thật chưa triển khai, preview không
gọi Backend. Thay host/port phù hợp entrypoint và thiết bị đã xác minh.
Không sửa CORS/cookie/CSRF/TLS để né lỗi kết nối.

```powershell
dart format lib test
flutter analyze
flutter test
```

Đọc [kiến trúc](../docs/MOBILE_ARCHITECTURE.md),
[Design System](../docs/MOBILE_DESIGN_SYSTEM.md) và
[API contract](../docs/MOBILE_API_CONTRACT.md).
State/router dùng Flutter SDK; không thêm package runtime. Dependency hiện có
cupertino_icons giữ nguyên dù preview chỉ dùng Material icons; flutter_lints và
flutter_test giữ nguyên để kiểm thử. Font Be Vietnam Pro đóng gói từ tài sản
Website với OFL đi kèm. Không tải font CDN khi chạy.

Android/iOS scaffolding được giữ nguyên. Chưa xác minh thiết bị native; iOS cần
macOS/Xcode. Web icons vẫn là scaffold Flutter, chưa coi đây là launcher identity
hoàn chỉnh. Không chạy flutter create đè dự án.
