# Module 02.6.1 — Manager Layout và Design System

## Kết quả và phạm vi

Đã triển khai shell quản lý bằng HTML/CSS/Vanilla JavaScript, không thêm framework,
build tool, API Backend hoặc tính năng quản lý dữ liệu. Có sáu khu vực điều hướng:
Tổng quan, Danh mục thuốc, Quản lý thuốc, Đơn vị tính & giá bán, Lô thuốc, Tồn kho.

Trang Tổng quan hiện là chỉ mục khu vực, ghi rõ giao diện tổng quan chưa triển
khai. Các mục khác mở trạng thái Chưa triển khai, không dẫn sang file không tồn
tại. Không có KPI, chart, bảng thuốc, CRUD hay số liệu giả. Các số 01–05 chỉ là
thứ tự điều hướng. Trang thật không có preview flag hoặc tài khoản đăng nhập giả.

## Phân tích trước triển khai

- Mục đích: cung cấp điều hướng và vùng làm việc thống nhất cho quản lý nhà thuốc.
- Người dùng: tài khoản quản lý VaiTro=2, TrangThai=false.
- Thao tác chính hiện có: đăng nhập, chuyển khu vực, xem trạng thái triển khai,
  mở menu tài khoản, đăng xuất hoặc trở về trang nhà thuốc.
- Phân cấp: thương hiệu → nhóm điều hướng → breadcrumb → h1/mô tả/action area →
  nội dung; thông tin phiên làm việc nằm ở cột phụ, không cạnh tranh tiêu đề.
- Sidebar/header được chọn vì sáu khu vực quản lý cần chuyển đổi thường xuyên;
  nội dung mỗi module tương lai vẫn được bố trí theo tác vụ riêng.

Sáu rủi ro đã xác định và xử lý:

1. Lộ giao diện trước khi xác minh quyền: shell hidden cho đến response hợp lệ.
2. Chữ phụ thiếu tương phản: token manager-muted riêng; kiểm tra các cặp màu AA.
3. Menu giả/đường dẫn chết: sáu hash hợp lệ, placeholder có chủ đích; hash lạ có
   thông báo và đường về Tổng quan.
4. Drawer mất focus: trap Tab/Shift+Tab, Escape, inert workspace, trả focus khi đóng.
5. Tên người dùng dài/tràn mobile: min-width, truncate ở header và wrap tên đầy đủ
   trong dropdown/phiên; kiểm thử tên dài trên màn hình 320px.
6. Font/layout shift: font cục bộ, chỉ ba weight dùng thực tế, preload regular,
   font-display swap và kích thước logo/header/avatar xác định. Chưa đo CLS=0.

## Các quyết định thiết kế

- Giữ Green 1.0 #16865B/#106B48/#E8F5EE; nền trung tính sáng và surface trắng.
- Xanh dùng cho active, hành động và trạng thái xác thực, không phủ toàn bộ shell.
- Be Vietnam Pro 400/500/600 tải cục bộ bằng @font-face; fallback Segoe UI, Arial,
  sans-serif. Ba file TTF tổng khoảng 357 KiB, đầy đủ glyph tiếng Việt, có OFL.
- Dùng icon SVG Lucide cục bộ, không dùng emoji hay tải thư viện JS icon; giấy
  phép đi kèm. Bộ sprite chỉ giữ các icon cần cho layout và trạng thái.
- Sidebar 248px desktop, header tối thiểu 76px; dưới 1024px chuyển drawer, header
  68px. Nội dung mobile một cột, không chỉ thu nhỏ desktop.
- Directory dạng hàng có phân cách, không chia thành card grid. Panel phiên dùng
  dữ liệu tài khoản từ API; không gọi API thuốc/tồn kho trong module này.
- Account dùng details/summary native, không gán role=menu thiếu keyboard pattern.
- Button target 44px, focus-visible outline rõ, tôn trọng reduced-motion qua CSS
  global đã có. Không thêm animation trang trí.

## Xung đột hướng dẫn và cách giải quyết

Design System 1.1 quy định Arial. Yêu cầu mới chỉ định Be Vietnam Pro cho Manager;
đã ghi rõ quyết định ưu tiên mới trong mục Typography và mục 18, version 1.2.
Không thay font trang khách hàng hiện có. Green 1.0 giữ nguyên, các màu trung
tính/status Manager là màu chức năng, không phải thương hiệu mới.

Đã đọc Web Interface Guidelines được skill tham chiếu. Chỉ áp dụng các quy tắc
phù hợp HTML/CSS/JS; không đưa framework, Title Case tiếng Anh hoặc virtualization
vào các liên kết điều hướng của trang tiếng Việt.

## Authentication và trạng thái

Tái sử dụng frontend/js/api/auth.js và dialog OTP Module 01, không đổi contract:

- GET /api/auth/me: dùng user.VaiTro và user.TrangThai, giữ CSRF trong bộ nhớ.
- POST OTP request/verify/register: giữ nguyên adapter và component hiện có.
- POST /api/auth/logout: dùng logoutSession hiện có, tự kiểm tra phiên/token mới.
- Không lưu token vào localStorage/sessionStorage và không thêm token flow khác.
- Kiểm tra phiên khi mở, quay lại tab/window hoặc BFCache; serialized requests.
- Phiên đang hoạt động được kiểm tra nền mà không làm đóng drawer/menu hiện tại.
- Có loading, anonymous, forbidden, locked, expired và lỗi kết nối + retry.
- Mất quyền/phiên: ẩn shell, xóa tên tài khoản khỏi DOM hiển thị, thông báo và
  chuyển focus tới gate khi cần. Backend tiếp tục là ranh giới phân quyền thật.

auth-dialog.js chỉ bổ sung selector data-auth-background để shell Manager nằm
trong nhóm inert khi dialog mở. Không sửa cơ chế OTP/session/CSRF. Luồng khách
hàng được kiểm thử hồi quy cho thay đổi này.

## Design System và Skills

docs/DESIGN_SYSTEM.md version 1.2, mục 18 ghi lại toàn bộ typography, semantic
colors, spacing, shape, kích thước shell, icon, component, responsive, trạng thái
và anti-pattern. Nguồn CSS token là frontend/css/base/manager-tokens.css;
components và layout không hardcode lại màu thương hiệu.

Dùng skill-creator để cập nhật nhỏ hai skill hiện có, không tạo skill trùng:

- .agents/skills/frontend-design/SKILL.md: baseline Manager và tham chiếu mục 18.
- .agents/skills/frontend-development/SKILL.md: tái sử dụng shell/auth/components
  và yêu cầu kiểm thử, giữ auth mock trong test harness riêng.

Thư mục .agents hiện được gitignore theo cấu hình có sẵn; hai cập nhật trên có
trong workspace, không tự thay .gitignore. Validator quick_validate.py đã thử
chạy nhưng thiếu PyYAML trong virtualenv. Không thêm dependency đó vào dự án;
đã kiểm tra riêng frontmatter, tên/description, mục mới và đường dẫn tham chiếu.

## Kiểm chứng thực tế

```powershell
node --test backend/tests/test_manager.mjs backend/tests/test_frontend.mjs
node backend/tests/browser_manager.mjs
git diff --check
```

- 11/11 bài Node đạt: 6 bài Manager và 5 bài auth Frontend cũ.
- Browser test Chrome headless đã chạy thành công trong profile riêng. Dùng
  server kiểm thử tự khởi động, auth responses mock đúng contract; không gọi API
  production, không dùng tài khoản thật và không ghi PostgreSQL.
- Đã kiểm tra 1440/1280/1024/768/375/320px, không thấy tràn ngang. Kiểm tra tăng
  cỡ chữ 200% ở mobile và drawer cũng không tràn ngang.
- Kiểm tra sáu liên kết, active/breadcrumb, route không hợp lệ qua unit test,
  skip link không đổi route, drawer đóng/mở/chọn lại route hiện tại, Tab/Shift+Tab,
  Escape, trả focus, account dropdown, tên dài, font tải thật trong browser.
- Kiểm tra loading tới gate/shell, anonymous, forbidden, locked, lỗi server/retry,
  expired khi quay lại tab, OTP UI flow, logout gửi CSRF và xóa tên cũ; không có
  runtime exception trong browser test.
- Hồi quy dialog khách hàng: mở, nền inert, Escape đóng và trả focus nút mở.
- Kiểm tra các cặp text/background và focus bằng tính toán contrast; không dùng
  kết quả này để tuyên bố toàn bộ WCAG AA đã được chứng nhận.
- git diff --check đạt; JS syntax và tài nguyên/ID/SVG refs đã kiểm tra.

Ảnh đã chụp và xem trực quan:

- [Desktop 1440px](MODULE_02_6_1_MANAGER_DESKTOP.png).
- [Mobile 375px](MODULE_02_6_1_MANAGER_MOBILE.png).
- [Mobile drawer](MODULE_02_6_1_MANAGER_DRAWER.png).

Ảnh có nhãn AUTH MOCK của test harness, không phải trạng thái xác thực giả trong
trang thật. Đã sửa các lỗi phát hiện khi kiểm thử: skip link bị coi là route lạ,
chọn lại route hiện tại chưa đóng drawer, và kiểm tra session nền làm đóng drawer.

Chưa kiểm thử screen reader, tài khoản quản lý thật qua PostgreSQL/OTP thật,
Safari/Firefox hoặc đo CLS/performance đầy đủ. Kênh Chrome/IAB tương tác không
kết nối được; đã dùng Chrome headless riêng để thực hiện kiểm tra và chụp ảnh.

## Cách chạy và mở Manager

Terminal Backend, giữ cấu hình Module 01 hiện có:

```powershell
cd D:\MaNguonMo\LanYenPharmacy
.\backend\.venv\Scripts\python.exe backend/run.py
```

Terminal static Frontend (nếu cổng 5500 chưa có server):

```powershell
cd D:\MaNguonMo\LanYenPharmacy
.\backend\.venv\Scripts\python.exe -m http.server 5500 --bind 127.0.0.1 --directory frontend
```

Mở **http://localhost:5500/pages/manager/index.html**. Backend ở localhost:5000,
AUTH_ALLOWED_ORIGINS phải có http://localhost:5500 theo cấu hình Module 01. Dùng
cùng hostname. Cookie Secure cần HTTPS; local HTTP dùng cấu hình development đã
duyệt. Không mở file HTML qua file://. Đăng nhập bằng tài khoản quản lý hiện có;
đăng ký tài khoản mới tạo khách hàng và không tự được cấp quyền quản lý.

URL #overview/#categories/#products/#units/#batches/#inventory đều hoạt động.
Các khu vực chưa triển khai giao diện được ghi rõ. Browser test là lệnh kiểm
thử riêng, không cần chạy khi sử dụng trang thật.

## Tệp tạo và sửa

Tạo:

- frontend/pages/manager/index.html.
- frontend/css/base/manager-tokens.css.
- frontend/css/components/manager.css.
- frontend/css/layouts/manager.css.
- frontend/js/layouts/manager.js.
- frontend/js/components/manager-state.js.
- frontend/js/utils/manager-view.js.
- frontend/assets/fonts/be-vietnam-pro-{400,500,600}.ttf và BeVietnamPro-OFL.txt.
- frontend/assets/icons/manager-icons.svg và Lucide-LICENSE.txt.
- backend/tests/test_manager.mjs và backend/tests/browser_manager.mjs.
- docs/MODULE_02_6_1_MANAGER_LAYOUT.md và ba ảnh kiểm thử nêu trên.

Sửa:

- frontend/js/components/auth-dialog.js: một selector background hỗ trợ shell.
- docs/DESIGN_SYSTEM.md: version 1.2 và tiêu chuẩn Manager.
- Hai SKILL.md Frontend đã liệt kê ở trên.

Không sửa Backend API/auth, models, PostgreSQL, migrations, .env hoặc Frontend
khách hàng ngoài selector chung cần thiết. Không triển khai nghiệp vụ ngoài
Module 02.6.1; không thay đổi các tệp Postman/Module 02.5 đang có từ tác vụ trước.
