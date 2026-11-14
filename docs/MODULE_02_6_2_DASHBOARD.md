# Module 02.6.2 — Manager Dashboard với API thật

## Quyết định nghiệp vụ đã xác nhận

Người dùng đã xác nhận trong phiên triển khai:

- Doanh thu dùng TongThanhToan, ghi nhận theo NgayDat.
- Chỉ tính đơn TrangThaiDonHang=3 (Hoàn thành) và TrangThaiThanhToan=1 (Đã thanh toán).
- Thời gian Dashboard theo giờ Việt Nam.

Không suy ra công thức từ tên trạng thái, không dùng TongTien trước giảm giá,
không cộng đơn chờ duyệt/đang xử lý/đang giao/đã hủy/đổi trả vào doanh thu. Đơn
hoàn thành nhưng chưa thanh toán cũng không được tính. Không sửa workflow đơn
hàng, dữ liệu hoặc trạng thái sẵn có.

## Kiểm kê API trước triển khai

| Nhu cầu | API có sẵn | Quyết định |
| --- | --- | --- |
| Kiểm tra phiên/vai trò/trạng thái | GET /api/auth/me | Reuse auth client/session/CSRF Module 01 |
| Số thuốc | GET /api/manager/products?page=1&per_page=1 | Dùng total từ API phân trang, không tải toàn bộ thuốc |
| Tổng hợp tồn kho | GET /api/manager/inventory/summary | Đã có, không gọi thêm vì low-stock đã đủ KPI và danh sách |
| Cảnh báo tồn kho | GET /api/manager/inventory/low-stock | Reuse total + tối đa 5 items |
| Lô sắp hết hạn | GET /api/manager/inventory/expiring | Reuse status=expiring, days=30, total + tối đa 5 items |
| Số đơn/khách/doanh thu | Chưa có | Thêm GET dashboard/summary |
| Doanh thu theo ngày | Chưa có | Thêm GET dashboard/revenue |
| Đơn gần đây | Chưa có | Thêm GET dashboard/recent-orders |

API mới chỉ GET, require_roles(2), kiểm tra session/tài khoản khóa theo guard
Module 01, cache no-store/nosniff, database errors rollback và trả mã an toàn.
Không tạo API CRUD, không đổi contract API cũ.

## Endpoint mới và response

```text
GET /api/manager/dashboard/summary?days=30
GET /api/manager/dashboard/revenue?days=30
GET /api/manager/dashboard/recent-orders?days=30&limit=5
```

days chỉ nhận 7/30/90, mặc định 30. limit chỉ ở recent-orders, mặc định 5, tối đa
20. Query lạ, giá trị sai hoặc tham số lặp bị từ chối 400 INVALID_REQUEST.

summary trả code DASHBOARD_SUMMARY, orders, customers, period và revenue gồm
available=true, amount (chuỗi tiền nguyên), order_status=3, payment_status=1,
amount_field=TongThanhToan, date_field=NgayDat.

revenue trả code REVENUE_LISTED, items [{date, amount}], period, has_data, total,
order_status và payment_status. Backend điền 0 cho ngày không có đơn đủ điều
kiện, không tạo dữ liệu mẫu. has_data=false khi không có đơn đủ điều kiện; UI
hiện trạng thái rỗng thay vì vẽ đường giả.

recent-orders trả code RECENT_ORDERS_LISTED, items, limit, period và
timestamp_basis=vietnam_wall_time. Mỗi item chỉ có MaDonHang, NgayDat,
TongThanhToan, TrangThaiDonHang, TenTrangThai; không trả tên/số điện thoại khách,
ghi chú hoặc mã nhân viên. Mã đơn và tiền BIGINT serialize thành chuỗi để tránh
mất độ chính xác trong JavaScript. Trạng thái lấy đúng nhãn từ comment model:
0 Chờ duyệt, 1 Đang xử lý, 2 Đang giao, 3 Hoàn thành, 4 Đã hủy, 5 Đổi trả.

Mọi endpoint mới trả 401 nếu chưa đăng nhập, 403 nếu sai quyền/khóa, 503
DATABASE_UNAVAILABLE nếu SQLAlchemy lỗi. GET không cần CSRF; đăng xuất và các
thao tác ghi hiện có vẫn tuân thủ CSRF như trước.

## Công thức từng KPI

| KPI | Công thức | Phạm vi |
| --- | --- | --- |
| Tổng doanh thu | SUM(DonHang.TongThanhToan) với trạng thái đơn=3 và thanh toán=1 | NgayDat trong kỳ đã chọn |
| Tổng đơn hàng | COUNT(*) DonHang, không lọc trạng thái | NgayDat trong kỳ đã chọn |
| Tổng khách hàng | COUNT(*) NguoiDung WHERE VaiTro=0 | Toàn bộ tài khoản khách, gồm tài khoản đang khóa |
| Sản phẩm thuốc | total từ GET products | Toàn bộ bản ghi Thuoc, không đếm đơn vị giá/lô |
| Thuốc tồn kho thấp | total từ low-stock | Tổng SoLuongTon <= NguongTonKho, gồm thuốc chưa có lô có tổng 0 |
| Lô sắp hết hạn | total từ expiring | SoLuongTon>0, hôm nay <= HanSuDung <= hôm nay+30 ngày |

Tổng tồn của low-stock giữ đúng Module 02.4: gồm tồn vật lý ở mọi lô, kể cả đã
hết hạn; không tự thay bằng tồn có thể bán. Lô hết hạn không nằm trong expiring.
Hai cảnh báo là hiện trạng, không bị lọc bởi bộ chọn ngày doanh thu/đơn.

Kỳ N ngày bao gồm hôm nay và N-1 ngày trước đó, theo UTC+7. Query dùng
NgayDat >= ngày đầu 00:00 và NgayDat < ngày sau hôm nay 00:00; không bỏ các đơn
cuối ngày. period trả start_date/end_date và timezone=Asia/Ho_Chi_Minh.

NgayDat là DateTime không có timezone trong model. Dashboard đọc giá trị lịch/
giờ đang lưu như giờ Việt Nam theo yêu cầu mới; không cộng/trừ 7 giờ hoặc ghi
lại dữ liệu. Nếu dữ liệu cũ thực tế đã lưu UTC, cần rà soát/chuyển đổi riêng với
phê duyệt rõ ràng; module này không thể chứng minh timezone lịch sử từ schema.
Không có chức năng tạo đơn trong phạm vi này nên không thay đổi cơ chế ghi ngày
của module đặt hàng tương lai.

Không còn KPI nào bị chặn bởi thiếu công thức sau hai xác nhận trên. Không thêm
doanh thu thuần hoàn trả, lợi nhuận, tăng trưởng, mục tiêu hoặc ngày thanh toán
vì chưa có quy tắc/trường dữ liệu tương ứng.

## Frontend

Giữ nguyên Manager Layout và Be Vietnam Pro/Green 1.0. Thay placeholder Tổng quan
bằng Dashboard. Bốn KPI đầu trong một dải; số cảnh báo nằm ở đầu danh sách tương
ứng. Biểu đồ SVG thuần có bảng dữ liệu chi tiết theo ngày, không thêm thư viện.

- Chỉ gọi API Dashboard sau khi auth/me xác nhận VaiTro=2, TrangThai=false.
- Tiền hiển thị qua Intl.NumberFormat('vi-VN', currency VND) với BigInt từ chuỗi;
  chỉ tọa độ SVG dùng số xấp xỉ, bảng và KPI giữ giá trị nguyên chính xác.
- 7/30/90 ngày đổi đồng thời summary, revenue, recent-orders; sản phẩm/cảnh báo
  tải lại hiện trạng, nhãn giải thích rõ phạm vi riêng.
- Loading, empty, error và nút retry riêng từng API. Một lỗi không làm hỏng toàn
  bộ Dashboard hoặc thay chỉ số lỗi bằng 0. Dấu — nghĩa là chưa xác định.
- Hủy requests khi đổi kỳ/rời trang/đăng xuất; response muộn không ghi đè state
  mới. Mất quyền từ bất kỳ API thì ẩn shell và xóa dữ liệu đang hiển thị.
- Mobile đưa cảnh báo trước biểu đồ và đơn; table đơn cuộn trong vùng có tên truy
  cập, không tràn toàn trang. Navigation/drawer/account/OTP giữ nguyên.
- Không thêm link tới CRUD thuốc/lô/tồn kho vì các trang đó chưa triển khai thật.
- Chỉ tải khi vào Tổng quan, đổi kỳ, retry hoặc bấm Làm mới; không polling số liệu.

## Kiểm thử

```powershell
cd D:\MaNguonMo\LanYenPharmacy
$env:PYTHONPATH = 'backend'
.\backend\.venv\Scripts\python.exe -m unittest discover -s backend/tests -p test_dashboard.py -v
.\backend\.venv\Scripts\python.exe -m unittest discover -s backend/tests -p test_*.py
node --test backend/tests/test_dashboard_frontend.mjs backend/tests/test_manager.mjs backend/tests/test_frontend.mjs
node backend/tests/browser_manager.mjs --dashboard
```

Unit tests Python mock repositories, chặn Engine.connect; không sử dụng database
thật. Bao phủ công thức SQL CASE/status, biên thời gian, ngày thiếu doanh thu,
database trống, BIGINT, đơn gần đây không PII, query validation, 401/403/khóa,
GET-only và lỗi PostgreSQL. Node tests kiểm tra adapter thật, credentials, VND,
thời gian, hủy request và hồi quy auth/layout.

Kết quả đã chạy: 15/15 unit tests Dashboard Backend đạt; hồi quy Backend đạt
189/189; 15/15 Node tests đạt (4 Dashboard + 6 Manager + 5 auth Frontend).
Suite hồi quy có ResourceWarning dọn file tạm trong môi trường test hiện có,
không có assertion thất bại. Không thay module upload để xử lý cảnh báo ngoài
phạm vi Dashboard. git diff --check đạt.

Browser test dùng Chrome headless/profile riêng và auth/API fixture chỉ trong
test harness. Dữ liệu sample không có trong trang hoặc API production. Ảnh có
nhãn AUTH/API MOCK. Bao phủ số liệu UI khớp response, đổi kỳ, một API lỗi/retry,
empty, hết phiên từ API, OTP/logout, drawer/bàn phím và responsive.

Browser test đã đạt ở 1440/1280/1024/768/375/320px, chữ 200% trên mobile/drawer,
không tràn ngang trang. Bảng đơn được phép cuộn riêng trong vùng đã đặt tên.

Ảnh đã chụp và xem trực quan:

- [Dashboard desktop](MODULE_02_6_2_DASHBOARD_DESKTOP.png).
- [Dashboard mobile](MODULE_02_6_2_DASHBOARD_MOBILE.png).
- [Drawer](MODULE_02_6_2_DASHBOARD_DRAWER.png).

Kiểm tra integration riêng, bắt buộc readonly, không nằm trong unit discovery:

```powershell
.\backend\.venv\Scripts\python.exe backend/tests/check_dashboard_readonly.py
```

Đã chạy trên PostgreSQL cấu hình hiện có: transaction REPEATABLE READ,
transaction_read_only=on, statement timeout. Đối chiếu repository counts/revenue
và tổng theo ngày với truy vấn SQL độc lập, kiểm tra giới hạn đơn gần đây và
low-stock: đạt. Không in số liệu, bản ghi kinh doanh hoặc credentials; không ghi
dữ liệu, không dùng cơ chế bypass auth trong ứng dụng.

Chưa kiểm thử tài khoản quản lý thật qua trình duyệt/live HTTP, screen reader
hoặc timezone của dữ liệu lịch sử. Các GET độc lập không phải một snapshot chung
xuyên HTTP, nên số liệu có thể thay đổi giữa các request khi nghiệp vụ ghi đồng
thời; nút Làm mới đọc lại từng nguồn.

## Chạy và kiểm tra thủ công

Khởi động lại Flask để đăng ký các route GET mới, giữ cấu hình auth/Redis/CSDL
hiện có. Không chạy migration:

```powershell
.\backend\.venv\Scripts\python.exe backend/run.py
.\backend\.venv\Scripts\python.exe -m http.server 5500 --bind 127.0.0.1 --directory frontend
```

Hai lệnh chạy ở hai terminal; không chạy trùng static server nếu cổng 5500 đã có.
Mở http://localhost:5500/pages/manager/index.html#overview. Dùng tài khoản quản lý
hiện có. Frontend gọi localhost:5000 theo adapter cấu hình hiện tại; CORS/cookie
theo Module 01. Không có chế độ login giả trong trang thật.

Postman: login OTP, giữ cookie session, GET summary/revenue/recent-orders ở ba
kỳ. GET không cần CSRF. So sánh summary.revenue.amount với revenue.total cùng kỳ,
orders với COUNT đơn trong kỳ. Không có đơn đủ điều kiện: amount/total='0' và
has_data=false. Kiểm tra quyền với khách/nhân viên và phiên không đăng nhập.

## Tệp tạo/sửa

Tạo:

- backend/app/routes/dashboard_routes.py.
- backend/app/controllers/dashboard_controller.py.
- backend/app/services/dashboard_service.py.
- backend/app/repositories/dashboard_repository.py.
- backend/app/schemas/dashboard_schema.py.
- backend/tests/test_dashboard.py.
- backend/tests/check_dashboard_readonly.py.
- backend/tests/test_dashboard_frontend.mjs.
- frontend/js/api/manager.js.
- frontend/js/pages/manager-dashboard.js.
- frontend/js/components/revenue-chart.js.
- frontend/js/utils/dashboard-format.js.
- frontend/css/pages/manager-dashboard.css.
- docs/MODULE_02_6_2_DASHBOARD.md và ba ảnh kiểm thử.

Sửa:

- backend/app/__init__.py: đăng ký dashboard blueprint.
- frontend/pages/manager/index.html: nội dung Tổng quan thật.
- frontend/js/layouts/manager.js: kích hoạt/dừng/xóa Dashboard theo route và auth.
- frontend/js/utils/manager-view.js: mô tả Tổng quan.
- backend/tests/browser_manager.mjs: mở rộng harness, giữ ảnh Module 02.6.1.
- docs/DESIGN_SYSTEM.md: ghi nhận Dashboard dữ liệu thật ở mục 19.

Không sửa schema PostgreSQL, models, migration, .env, API cũ hoặc cơ chế auth.
Không tạo dữ liệu giả vào PostgreSQL. Không triển khai CRUD/upload Frontend.
