# Nền tảng Mobile Lan Yến Pharmacy

## Rà soát trước thay đổi — 26/11/2026

- Nhánh `feat/mobile`; staged, unstaged và untracked đều sạch.
- Có đủ 14 Skills trong `.agents/skills/`; có thêm `accessibility/SKILL.backup.md` không phải Skill đang hoạt động.
- `mobile/` đã có Android, iOS, Web; chỉ có counter app và counter test. Không chạy lại `flutter create`.
- Flutter 3.47.0 stable, Dart 3.13.0; pubspec yêu cầu Dart ^3.13.0.
- Các vấn đề: cấu trúc feature chưa chia vai trò; model nằm rải rác trong ví dụ; remote datasource gọi endpoint trái yêu cầu `api.dart`; ví dụ port 5000 chưa phân biệt cấu hình source với runtime; hướng dẫn root chưa có Flutter.
- Quy tắc màu hai cấp và Widget cùng file đã đầy đủ, cần giữ lại. Ví dụ màu forest trong Skill chỉ minh họa, không thay Green 1.0.
- Skill Backend và review cũ nhắc JWT trong khi auth routes thực tế dùng Flask session. Giữ nguyên Skill Backend theo phạm vi; Mobile dựa trên source và API contract.
- Baseline 15 bảng trong Skills không phản ánh hết migration bổ sung đã tồn tại; không suy ra quyền sửa schema hoặc chạy migration.
- Reference accessibility `color-and-media.md` ghi muted #777777 khác #767676 trong Design System; chỉ ghi nhận, không sửa Web Skills.
- Validator sau rà soát: cả 14 frontmatter đọc được bằng YAML parser; 13 Skills qua quick_validate, riêng accessibility có khóa user-invocable ngoài schema validator hiện tại. Đây là nội dung có sẵn, giữ nguyên theo phạm vi Web-only.

## Kiến trúc được duyệt

Một ứng dụng, feature-first theo vai trò. `LoginScreen → AuthController → AppRouter → CustomerShell / EmployeeShell / ManagerShell`.
Vai trò 0/1/2 tương ứng khách hàng/nhân viên/quản lý. Không có kế thừa quyền ngầm giữa vai trò.
Mock selection chỉ tồn tại trong chế độ demo, mặc định bật; `--dart-define=DEMO_MODE=false` khóa preview và không cung cấp đăng nhập thật.
Đổi vai trò phải thoát preview trước. Route sai vai trò, route không rõ hoặc vai trò không hợp lệ trả về cổng vào an toàn.
Backend vẫn quyết định authorization; client guard không cấp quyền server.

```text
mobile/lib/
  main.dart
  app/{app.dart,app_router.dart}
  core/
    config/app_config.dart
    constants/app_roles.dart
    network/{api.dart,api_client.dart,api_exception.dart}
    storage/session_storage.dart
    theme/{app_colors.dart,app_theme.dart,app_typography.dart,
           app_spacing.dart,app_radius.dart,app_motion.dart}
  models/session_user.dart
  features/
    auth/{login_screen.dart,auth_controller.dart}
    customer/customer_shell.dart
    employee/employee_shell.dart
    manager/manager_shell.dart
    preview/foundation_preview.dart
```

Chỉ tạo file có trách nhiệm thực tế. Chưa tạo các feature nghiệp vụ, repository hoặc tầng data/domain/presentation trống.
State dùng ChangeNotifier và state cục bộ của Flutter SDK; routing dùng Navigator SDK, không thêm thư viện.

## Ranh giới API

`Controller → api.dart → ApiClient → ApiTransport`. Chỉ `api.dart` chứa hàm endpoint.
ApiClient chuẩn hóa URL, JSON, timeout, lỗi; ApiTransport là điểm gắn kết nối thật sau này.
Giai đoạn này transport mặc định từ chối kết nối, chưa có cookie jar, credentialed Web transport hoặc auth thật.
Chỉ chuẩn bị phép đọc session đã xác minh; không thêm giao dịch hoặc hàm ghi nghiệp vụ.
Không coi mock transport trong test là tích hợp Flask. SessionStorage chỉ giữ CSRF tạm trong RAM, không lưu cookie, OTP hoặc mật khẩu.
Timeout không đồng nghĩa hủy thao tác server; cancellation vật lý thuộc transport tương lai, không tuyên bố đã triển khai.

## Quy tắc bảo trì

Models dữ liệu dùng chung ở `lib/models/`; state UI có thể nằm trong feature.
Shared colors ở AppColors; màu riêng nằm trong class ngay sau imports của chính file UI, mỗi thuộc tính có chú thích tiếng Việt.
Các phần UI đáng kể là private Widget class cùng file; chỉ tách khi tái sử dụng/độ phức tạp/kiểm thử có lý do.
Đọc `MOBILE_DESIGN_SYSTEM.md`, `MOBILE_API_CONTRACT.md` và `mobile/AGENTS.md` trước khi mở rộng.

## Skills và môi trường Agent

Catalog phiên hiện tại đã phát hiện đủ 14 Skills từ `.agents/skills/`. Giữ nguyên vị trí này.
Không suy ra Antigravity có cùng cơ chế; cần kiểm tra riêng cấu hình của môi trường đó khi sử dụng.
Web-only: frontend-design, frontend-development, accessibility, web-design-guidelines.
Backend-only: flask-backend, database-postgresql. Shared: pharmacy-project, code-review-testing.
Mobile-only: mobile-design, flutter-development, mobile-ux, mobile-api-integration, mobile-accessibility, mobile-design-guidelines.

## Giai đoạn kế tiếp

Chủ dự án xác định phạm vi tính năng, rồi chọn transport hỗ trợ cookie/CSRF trên từng nền tảng và kiểm thử session với dữ liệu giả lập.
Không sửa Backend để né CORS/SameSite, không triển khai cloud, không tự động chạy database hoặc worker bảo trì.
