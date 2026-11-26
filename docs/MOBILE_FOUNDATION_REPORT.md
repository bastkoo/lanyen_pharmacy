# Báo cáo nền tảng Flutter — Lan Yến Pharmacy

Ngày 26/11/2026 · Nhánh `feat/mobile` · Flutter 3.47.0 / Dart 3.13.0.

## Tổng quan và trạng thái

Đã chỉnh sửa trực tiếp workspace: đồng bộ Skills, quy tắc phạm vi, tài liệu Mobile,
Theme/tokens, kiến trúc ba vai trò, hạ tầng API tối thiểu và preview Local.
Không triển khai nghiệp vụ đầy đủ, đăng nhập thật, giao dịch hoặc cloud.

| Giai đoạn | Kết quả |
|---|---|
| 1. Repository/baseline | Nhánh đúng, Git sạch ban đầu; ghi hash và danh sách file bảo vệ |
| 2. Skills/tài liệu | Đọc 14 SKILL.md, reference Web accessibility và tài liệu/source liên quan |
| 3. Mâu thuẫn | Ghi nhận trước chỉnh sửa trong MOBILE_ARCHITECTURE.md; bổ sung phát hiện validator sau kiểm tra |
| 4. Shared Skills | Bổ sung phạm vi Flutter, giữ quy định Web/Backend |
| 5. Sáu Mobile Skills | Đồng bộ API tập trung, models, role, scope và Local-first |
| 6. AGENTS | Bổ sung root và tạo mobile/AGENTS.md |
| 7. Design System | Tạo MOBILE_DESIGN_SYSTEM.md, giữ Green 1.0 |
| 8. Kiến trúc ba vai trò | Một cổng demo, controller/router, ba shell |
| 9. Theme/tokens | Màu, chữ, spacing, radius, motion, font đóng gói |
| 10. API infrastructure | api.dart/client/exception/config/session RAM; transport thật chưa bật |
| 11. Contract | Đối chiếu source auth/catalog/role/CORS/cookie/CSRF; chưa gọi Backend |
| 12. Preview | Có mẫu typography, colors, controls, states và phản hồi cục bộ |
| 13. Kiểm thử | 43 tests pass, analyze sạch, format ổn định; Web build/Chrome headless đã chạy |
| 14. Bảo vệ Website/Backend | 8.334 file đối chiếu không đổi/thêm/mất |
| 15. Báo cáo | Tài liệu này và hướng dẫn chạy trong mobile/README.md |

## Agent Skills

Đã đọc và sửa: pharmacy-project, code-review-testing, flutter-development,
mobile-design, mobile-ux, mobile-api-integration, mobile-accessibility,
mobile-design-guidelines.

Đã đọc và giữ nguyên: accessibility, frontend-design, frontend-development,
web-design-guidelines, flask-backend, database-postgresql. Giữ nguyên reference
và backup của Web accessibility.

Đã xử lý: hướng dẫn datasource gọi endpoint phân tán; cấu trúc chưa chia vai trò;
vị trí models chưa thống nhất; ví dụ port chưa phân biệt source/runtime; thiếu
phạm vi Flutter trong hướng dẫn chung. Bảo toàn màu cùng file, chú thích tiếng Việt
và chia Widget theo phần có ý nghĩa; không viết lại toàn bộ Skills.

Tất cả 14 frontmatter parse YAML được, name/description đúng, không có Markdown
reference nội bộ bị thiếu. Quick validator: 13/14 pass, gồm cả 8 Skills được sửa.
Skill Web accessibility giữ nguyên có `user-invocable` ngoài schema của validator,
không phải lỗi YAML parse. Không tự sửa vì phạm vi yêu cầu bảo toàn Web Skills.

Ghi nhận ngoài phạm vi: Skill Backend cũ yêu cầu JWT nhưng auth source hiện dùng
Flask session; baseline 15 bảng trong tài liệu cũ không bao quát hết migration đang
có; reference Web color-and-media ghi #777777 khác #767676 của Design System.
Không sửa Backend/Web Skills, schema hoặc migration để xử lý các khác biệt này.

## Flutter và quyết định kỹ thuật

Cây source và trách nhiệm từng lớp: [MOBILE_ARCHITECTURE.md](MOBILE_ARCHITECTURE.md).
Design System đầy đủ: [MOBILE_DESIGN_SYSTEM.md](MOBILE_DESIGN_SYSTEM.md).

- Một app, LoginScreen → AuthController → AppRouter → Customer/Employee/ManagerShell.
- VaiTro=0/1/2 đối chiếu model NguoiDung và require_roles. Không kế thừa quyền ngầm.
- Demo không đăng nhập Backend, không sử dụng user dữ liệu thật, không cấp quyền server.
- Route sai vai trò/không tồn tại bị chặn; thoát bỏ state preview; DEMO_MODE=false khóa mock.
- SDK ChangeNotifier/state cục bộ và Navigator đủ cho nền tảng, không thêm package runtime.
- Endpoint methods chỉ api.dart; client dùng chung chỉ xử lý URL/JSON/timeout/errors.
- SessionUser ở lib/models; CSRF RAM ở SessionStorage. Chưa cookie jar/HTTP transport thật.
- AppColors dùng Green 1.0 và semantic tokens tối của Website Manager; không sửa CSS.
- LoginColors/PreviewColors ở ngay sau imports; từng màu có chú thích tiếng Việt.
- Các section preview là private Widget class cùng file, chỉ tách khung dùng chung có lý do.
- Font Be Vietnam Pro 400/500/600 sao chép vào Mobile, kèm OFL; không tải CDN.
- Preview phân biệt mục đích ba vai trò, chưa tạo tab nghiệp vụ hoặc dashboard giả.

Không thay đổi khai báo package/version SDK hoặc lockfile. flutter_test,
flutter_lints, cupertino_icons giữ nguyên. PyYAML chỉ tải vào thư mục tạm để chạy
validator; không cài vào venv Backend hoặc thêm dependency của app.

## API: thông tin xác minh và giới hạn

Chi tiết method/request/response/error/role/source:
[MOBILE_API_CONTRACT.md](MOBILE_API_CONTRACT.md).

Source run.py cấu hình 127.0.0.1:5000, prefix /api. Đây không phải xác minh process
đang lắng nghe. Cấu hình env thực tế và mạng LAN/thiết bị chưa được kiểm thử.
Auth dùng lanyen_session, HttpOnly, CSRF X-CSRF-Token và allowlist Origin;
Secure/SameSite phụ thuộc env. Không suy ra JWT từ dependency.
GET auth/me bootstrap CSRF qua cả lỗi anonymous, auth thành công đổi phiên/token.

ApiClient mặc định từ chối transport chưa cấu hình. Chỉ có contract đọc session,
không tích hợp login thật hoặc giao dịch. Mock HTTP chỉ trong test.
Chưa triển khai persistence cookie, cancellation vật lý, CSRF mutation,
session lifecycle end-to-end. Timeout không bảo đảm hủy thao tác server.
Flask không được khởi động vì entrypoint/before_request có worker bảo trì đơn.

Cần quyết định sau: phạm vi tính năng, transport theo nền tảng, origin dev,
reachability và xử lý BIGINT trên Flutter Web. Không tự thay đổi API contracts.

## Kiểm thử đã thực hiện

| Kiểm tra | Kết quả |
|---|---|
| flutter pub get | Thành công; không đổi lockfile |
| dart format lib test | Thành công |
| dart format --output=none --set-exit-if-changed lib test | 25 file, 0 thay đổi, exit 0 |
| flutter analyze --no-pub | No issues found |
| flutter test --no-pub | 43 tests pass |
| flutter build web --no-pub --no-web-resources-cdn | Build thành công, Wasm dry run thành công |
| flutter run -d chrome với headless | Kết nối debug service và khởi chạy thành công |
| git diff --check | Không lỗi whitespace; Git có thông báo chuẩn hóa LF/CRLF |

Unit tests: role mapping/mọi cặp route, demo disabled/state reset, config Base URL,
model sai/locked, đường dẫn session, 401/403/500, CSRF từ lỗi, malformed body/model,
timeout/connection và transport chưa bật. Tất cả dữ liệu synthetic.

Widget tests: cổng vào/ba shell/thoát, route denied, disabled demo; không overflow
ở 320/360/390/430/600/900 với text scale 100/125/150/200% trên ba vai trò;
safe area 44/34, keyboard inset 300 ở width320/scale200%; input và nút vẫn cuộn tới.
Có test Tab/Enter, input, reduced motion; guideline target/label/text contrast
chạy cho cổng vào và ba role.

Đã xuất ảnh Flutter renderer với font thực vào mobile/build/preview và xem ảnh:
entry/customer/employee/manager. Review phát hiện helper text bị ellipsis, đã sửa
xuống dòng; thêm icon font vào harness để ảnh không có ô glyph. Đã xem lại ảnh
customer cuối. Đây không phải screenshot browser hoặc thiết bị thật.

Trong quá trình kiểm chứng có lỗi harness: bấm nút ngoài viewport, chưa dispose
semantics đúng thời điểm và capture renderer chờ bất đồng bộ dẫn đến timeout.
Đã sửa và chạy lại toàn bộ 43 tests thành công, không che lỗi bằng bỏ test.

Chưa kiểm thử: Android/iOS native, TalkBack/VoiceOver, keyboard/haptic/gesture
thiết bị thật, browser UI thủ công, real Backend/session/DB integration,
toàn bộ nghiệp vụ Website/Backend. Browser tool không có browser kết nối; chỉ
xác minh Chrome headless startup, không tuyên bố đã thao tác UI Chrome.
Không có integration_test vì chưa có flow tích hợp thật trong phạm vi.
Không tuyên bố tuân thủ WCAG đầy đủ.

## Bảo vệ Website và Backend

Git ban đầu sạch cả staged/unstaged/untracked. Sau tác vụ, git diff và diff cached
cho frontend/backend rỗng; không có untracked trong hai thư mục.
So sánh SHA-256 cùng danh sách tất cả file, kể cả ignored/untracked: 8.334 file
trong frontend/backend và sáu dedicated Skills giữ nguyên; 0 changed/added/removed.
Do đó source và quy định riêng Web/Backend không đổi. Không chạy regression hành
vi Website/Backend nên không tuyên bố đã chứng minh mọi chức năng không ảnh hưởng.

Shared Skills được bổ sung section Flutter riêng, giữ các quy định Web/Backend.
Không chạy formatter, migration hoặc thao tác dữ liệu trong frontend/backend.

File mobile/assets/images/logo.png xuất hiện trong lúc tác vụ diễn ra, không do
agent này tạo; giữ nguyên, không đăng ký asset hoặc nhận là thay đổi của agent.
Các tiến trình daemon/debug_adapter/Flutter chạy từ IDE được giữ nguyên.
Preview Chrome headless do tác vụ mở đã đóng.

## Danh sách thay đổi

File tracked sửa: mobile/README.md, lib/main.dart, pubspec.yaml,
test/widget_test.dart, web/index.html, web/manifest.json.
Mục đích: thay counter app, thêm font, hướng dẫn chạy, test và metadata demo.

File mới dưới mobile/lib:
- app/app.dart, app/app_router.dart
- core/config/app_config.dart, core/constants/app_roles.dart
- core/network/api.dart, api_client.dart, api_exception.dart
- core/storage/session_storage.dart
- core/theme/app_colors.dart, app_theme.dart, app_typography.dart,
  app_spacing.dart, app_radius.dart, app_motion.dart
- models/session_user.dart
- features/auth/login_screen.dart, auth_controller.dart
- features/customer/customer_shell.dart
- features/employee/employee_shell.dart
- features/manager/manager_shell.dart
- features/preview/foundation_preview.dart

File mới khác: mobile/test/foundation_test.dart, preview_capture_test.dart;
mobile/assets/fonts/be-vietnam-pro-400.ttf, -500.ttf, -600.ttf và BeVietnamPro-OFL.txt;
mobile/AGENTS.md; docs/MOBILE_ARCHITECTURE.md, MOBILE_DESIGN_SYSTEM.md,
MOBILE_API_CONTRACT.md, MOBILE_FOUNDATION_REPORT.md.

Sửa AGENTS.md gốc và 8 SKILL.md nêu trên. AGENTS.md, mobile/AGENTS.md và .agents/
đang bị ignore theo .gitignore có sẵn: chỉnh sửa tồn tại trên đĩa nhưng không hiện
trong git diff thông thường. Không sửa .gitignore hoặc tự stage/force-add.
Không commit, push, merge, đổi branch, xóa/di chuyển file.

## Chạy và bước tiếp theo

```powershell
cd mobile
flutter pub get
flutter run -d chrome
```

Cấu hình chuẩn bị cho kết nối sau:
`--dart-define=API_BASE_URL=http://127.0.0.1:5000/api`.
Thay địa chỉ theo entrypoint/thiết bị đã kiểm chứng. Hiện transport vẫn chưa bật.
`--dart-define=DEMO_MODE=false` khóa preview; chưa có login thật.

Đề xuất tiếp theo: chủ dự án chọn tính năng đầu tiên và phạm vi role, sau đó
tích hợp cookie/CSRF bằng transport phù hợp, kiểm thử trên Backend Local với dữ
liệu giả lập rồi trên Android/iOS. Chưa tự triển khai giai đoạn tiếp theo.
