# Module 02.8.2 — Frontend quản lý tài khoản nội bộ

## Truy cập

Chạy frontend/Flask theo cấu hình hiện có, đăng nhập quản lý VaiTro=2, TrangThai=false. Mở `frontend/pages/manager/index.html#accounts` hoặc chọn **Quản lý tài khoản** trong nhóm **Đội ngũ nhà thuốc** của Manager. Tải lại Ctrl+Shift+R nếu trình duyệt giữ JavaScript cũ.

Không có UI mật khẩu, khách hàng, xóa tài khoản hoặc tạo OTP/SMS. Không thay Backend API, SQLAlchemy model, PostgreSQL schema/migration hoặc dữ liệu thật.

## Chức năng

Trang dùng Manager shell, font Be Vietnam Pro và semantic tokens hiện có. Bố cục là danh bạ nội bộ: dải tổng hợp số liệu, bộ lọc theo tác vụ, bảng tài khoản và dialog tập trung cho hồ sơ/thao tác. Không thêm sidebar/header riêng hoặc dashboard nhân viên.

Thống kê toàn hệ thống lấy `total` qua bốn GET riêng với page=1/per_page=1:

- Không có bộ lọc: tổng nội bộ.
- role=1: tổng nhân viên.
- role=2: tổng quản lý.
- status=true: tổng đã khóa.

Không lấy số dòng trang hiện tại làm tổng. Thống kê không bị giới hạn bởi search/filter của danh sách. Nếu thống kê lỗi, hiển thị dấu — và nút thử lại, không hiển thị số 0 giả; danh sách vẫn tải độc lập.

Bộ lọc tên/SDT, role và status dùng đúng query Backend; phân trang 20 tài khoản. Có reset/làm mới và loading skeleton tĩnh, empty/error/retry/success. Bảng gồm avatar HTTPS hoặc initials, tên, SDT, email, badge vai trò, trạng thái và Xem/Sửa/Khóa/Mở khóa. Tài khoản đang đăng nhập có nhãn “Bạn”. Mã định danh chỉ dùng nội bộ, không hiển thị. Ảnh lỗi tự về initials; ảnh không gửi referrer. Không coi URL tùy ý là HTML.

Dialog chi tiết tải GET mới, hiển thị thông tin tài khoản cùng hành động sửa/trạng thái và ẩn mã định danh. Không tạo lịch sử, ngày tạo hoặc lần đăng nhập.

Form tạo/sửa gồm HoTen, SDT, VaiTro (chỉ 1/2), Email và URL AnhDaiDien tùy chọn. Không upload ảnh mới vì Backend chỉ hỗ trợ URL trong module này. Form nhắc rõ đăng nhập bằng SDT + OTP, không tạo mật khẩu. SDT chuẩn hóa theo Module 01; optional rỗng gửi null. Khi sửa, hiển thị vai trò hiện tại và vai trò sau lưu. MaNguoiDung/TrangThai không được gửi trong body tạo/sửa.

Sửa/khóa/mở lấy dữ liệu mới qua GET chi tiết trước khi hiển thị form hoặc xác nhận. Tự khóa bị vô hiệu hóa trên hàng và chi tiết; chọn hạ quyền mình bị vô hiệu hóa và vẫn được kiểm tra trước request. Backend tiếp tục là ranh giới bảo mật. Khóa/mở có xác nhận tên/vai trò/SDT và ảnh hưởng đăng nhập. Chỉ đổi giao diện sau mã thành công, sau đó tải lại danh sách và thống kê. Không có thao tác xóa.

Lỗi trùng SDT được hiển thị ở trường SDT và thông báo form. LAST_ACTIVE_MANAGER/CANNOT_LOCK_SELF/CANNOT_DEMOTE_SELF/ACCOUNT_NOT_FOUND có giải thích riêng, giữ dữ liệu và không báo thành công. CSRF, validation hoặc mất mạng giữ form, không tự retry request ghi. Sau sửa chính mình, Manager kiểm tra lại session để cập nhật thông tin header.

## API đã tích hợp

| Method | Endpoint | Contract |
| --- | --- | --- |
| GET | `/api/manager/accounts` | search, role, status, page, per_page; ACCOUNTS_LISTED + items/page/per_page/total/pages |
| GET | `/api/manager/accounts/<id>` | ACCOUNT_FOUND + account |
| POST | `/api/manager/accounts` | ACCOUNT_CREATED + account, HTTP 201 |
| PUT | `/api/manager/accounts/<id>` | ACCOUNT_UPDATED + account |
| PATCH | `/api/manager/accounts/<id>/status` | body chỉ TrangThai boolean; ACCOUNT_STATUS_UPDATED + account |

POST/PUT gửi HoTen, SDT, VaiTro, Email, AnhDaiDien; khi tạo TrangThai do Backend khởi tạo false. Khóa dùng `{"TrangThai":true}`, mở dùng false. UserSchema trả MaNguoiDung, HoTen, SDT, VaiTro, TrangThai, Email, AnhDaiDien. Không có khác biệt model/endpoint cần sửa Backend.

## Bảo toàn BigInteger

Backend hiện trả MaNguoiDung là JSON integer. `response.json()` sẽ mất chính xác trước khi mã UI có thể đổi ID sang chuỗi nếu số vượt MAX_SAFE_INTEGER.

Đã thêm bộ đọc JSON nhỏ không phụ thuộc thư viện: quét token số bên ngoài chuỗi JSON, chuyển integer vượt phạm vi an toàn thành chuỗi thập phân **trước JSON.parse**. Chuỗi đã escape, số nhỏ, boolean, decimal và cấu trúc JSON giữ nguyên. JSON sai vẫn bị JSON.parse từ chối.

Client auth và Manager cùng dùng bộ đọc này. Nhờ đó ID từ session/OTP và danh sách/chi tiết tài khoản nhất quán; không có trường hợp ID trên bảng đúng nhưng ID tài khoản hiện tại đã bị làm tròn. Chỉ đổi cách biểu diễn trong frontend, không đổi wire JSON hoặc Backend.

Controller tài khoản chuẩn hóa ID thành string; kiểm tra dương và không vượt BIGINT PostgreSQL, từ chối Number đã không còn an toàn thay vì đoán lại ID. URL/dataset/so sánh self dùng chuỗi, không ép Number. VaiTro/số đếm nhỏ vẫn là Number. Test dùng ID lớn nhất `9223372036854775807` dưới dạng số JSON thật trên wire, không chỉ fixture string.

## Validation và bảo mật

- HoTen bắt buộc sau trim, 1–255 Unicode code points, không ký tự điều khiển.
- SDT bắt buộc, raw 1–24 ký tự trước chuẩn hóa Module 01; không nhận số/boolean thay chuỗi.
- VaiTro chỉ 1/2; không có lựa chọn khách hàng, không có mật khẩu.
- Email tùy chọn: kiểm tra định dạng cơ bản/độ dài 255 và ký tự điều khiển; Backend xác minh cuối cùng.
- URL ảnh tùy chọn dùng kiểm tra HTTPS có sẵn; nội dung API render bằng textContent/DOM, không innerHTML.
- Tái sử dụng cookie session và getCsrfToken, không lưu token hoặc PII vào localStorage.
- 401/403 quyền/tài khoản khóa đóng dialog, hủy request đang đọc, xóa rows/form/detail/thống kê và về gate dùng chung. Lỗi CSRF không bị hiểu nhầm là mất quyền.
- Request versions và AbortController ngăn kết quả cũ sau đóng dialog/đổi bộ lọc/rời trang ghi đè dữ liệu hiện tại.
- Chặn gửi trùng và Escape khi request ghi đang chạy. Native dialog giữ focus, hỗ trợ Tab/Shift+Tab/Escape và khôi phục focus khi đóng.
- Bảng có caption, header scope, scroll region có nhãn/focus; form có label, aria-describedby/aria-invalid và thông báo lỗi. Không chỉ dùng màu để truyền trạng thái.
- Responsive 1440–320px; thống kê từ bốn cột thành hai, form một cột, bảng cuộn riêng. Skeleton không animation, không vi phạm tùy chọn reduced-motion.

## File tạo

- `frontend/js/api/accounts.js`
- `frontend/js/utils/account-validation.js`
- `frontend/js/utils/json-integers.js`
- `frontend/js/components/account-dialog.js` — form/chi tiết/xác nhận và avatar dùng chung với bảng.
- `frontend/js/pages/manager-accounts.js` — danh sách/filter/stats/pagination/vòng đời.
- `frontend/css/pages/manager-accounts.css`
- `backend/tests/test_accounts_frontend.mjs`
- `backend/tests/browser_accounts.mjs`
- Tài liệu này và bốn ảnh `MODULE_02_8_2_ACCOUNTS_{DESKTOP,MOBILE,DETAIL_DESKTOP,FORM_MOBILE}.png`, có nhãn AUTH/API MOCK.

## File sửa

- `frontend/pages/manager/index.html` — nội dung, dialog, CSS và mục điều hướng.
- `frontend/js/utils/manager-view.js` — route accounts thứ tám.
- `frontend/js/layouts/manager.js` — vòng đời, ID người hiện tại và refresh sau sửa self.
- `frontend/js/api/auth.js`, `frontend/js/api/manager.js` — đọc response.text bằng bộ parser bảo toàn integer.
- `backend/tests/test_manager.mjs` — route thứ tám.
- `backend/tests/test_frontend.mjs`, `test_dashboard_frontend.mjs`, `test_categories_frontend.mjs`, `test_products_frontend.mjs`, `test_units_frontend.mjs`, `test_stock_frontend.mjs`, `test_promotions_frontend.mjs` — fetch double hỗ trợ response.text giống Fetch thật.
- `backend/tests/browser_manager.mjs` — cờ --accounts, actor fixture/JSON BIGINT wire và lưu ảnh hồi quy module cũ trong thư mục tạm.

Không sửa Python Backend, auth guard/OTP service, CSDL hoặc cấu hình.

## Kiểm thử đã thực hiện

```powershell
node --test backend/tests/test_frontend.mjs backend/tests/test_manager.mjs backend/tests/test_dashboard_frontend.mjs backend/tests/test_categories_frontend.mjs backend/tests/test_products_frontend.mjs backend/tests/test_units_frontend.mjs backend/tests/test_stock_frontend.mjs backend/tests/test_promotions_frontend.mjs backend/tests/test_accounts_frontend.mjs
# 35/35 đạt

node backend/tests/browser_manager.mjs --accounts
node backend/tests/browser_manager.mjs --accounts --promotions --stock --units --products --categories --dashboard
# Cả hai đạt

cd backend
.venv\Scripts\python.exe -m unittest discover -s tests -p test_accounts.py
# 35/35 API/OTP/security tests hiện có đạt; repository mocks, fakeredis
.venv\Scripts\python.exe tests/check_accounts_live.py
# PASS PostgreSQL READ ONLY: 2 tài khoản nội bộ, list/detail/search,
# role/status filters, session/CSRF guards.
# SKIP customer detail scope thật do không có khách hàng trong database.
```

Chrome test kiểm tra tổng 24 trong khi trang chỉ có 20 dòng, nhân viên/quản lý/đã khóa đúng totals, server filters/page/reset/search, tạo cả hai vai trò, không password/role=0, SDT trùng, giữ form khi CSRF lỗi, chặn gửi trùng/Escape, sửa thông tin/vai trò, disabled self actions, xác nhận/hủy khóa, khóa/mở nhân viên, lỗi quản lý cuối, chi tiết 7 trường, stats failure độc lập, 404, stale detail, empty/network/retry, session expiry/403 và dọn dữ liệu. Kiểm tra numeric BIGINT thật trên wire, route PUT đúng ID, session BIGINT và chặn self theo ID này. Kiểm tra keyboard/dialog focus và không overflow tại 1440/1280/1024/768/375/320px.

Hồi quy Chrome gồm Dashboard, danh mục, thuốc/mã vạch, đơn vị giá, lô/tồn kho, khuyến mãi, Manager shell và auth trang khách hàng. Không ghi đè ảnh QA module cũ. Đã xem ảnh danh sách/chi tiết desktop và form/danh sách mobile; syntax JS, asset/ID tests và git diff --check đạt.

## Giới hạn còn lại

Browser tạo/sửa/khóa dùng AUTH/API MOCK cô lập trong tests, không phải thao tác trên Backend thật. Kiểm tra PostgreSQL thật chỉ đọc qua Flask test client với session ký cho quản lý hiện có; không phải OTP thật hoặc browser-to-live-server. Chưa kiểm thử tạo/sửa/khóa tài khoản thật hoặc số ID lớn thực tế trong database; case BIGINT có unit và browser wire fixture.

Không thực hiện ghi dữ liệu thật để kiểm thử. Thống kê dùng bốn response API độc lập, không phải một snapshot transaction chung; nếu có quản lý khác đổi dữ liệu đồng thời, làm mới để lấy số liệu mới. Không có API thống kê mới.

Sau bàn giao dừng ở Module 02.8.2, chờ yêu cầu tiếp theo.
