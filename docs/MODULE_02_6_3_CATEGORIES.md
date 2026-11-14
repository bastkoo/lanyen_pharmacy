# Module 02.6.3 — Frontend quản lý danh mục thuốc

## Kết quả

Trang `frontend/pages/manager/index.html#categories` sử dụng Manager Layout, font Be Vietnam Pro và Design System hiện có. Chỉ tài khoản quản lý VaiTro=2, không bị khóa được vào giao diện. Backend tiếp tục là nơi kiểm tra quyền và quy tắc dữ liệu.

Đã tích hợp trực tiếp API hiện có, không tạo endpoint mới:

| Method | Endpoint | Dữ liệu |
| --- | --- | --- |
| GET | `/api/manager/categories` | `search`, `page`, `per_page`; đọc `items`, `total`, `pages` |
| GET | `/api/manager/categories/<id>` | `category.MaLoaiThuoc`, `category.TenLoaiThuoc` |
| POST | `/api/manager/categories` | JSON chỉ có `TenLoaiThuoc` |
| PUT | `/api/manager/categories/<id>` | JSON chỉ có `TenLoaiThuoc` |
| DELETE | `/api/manager/categories/<id>` | Không gửi body |

Danh sách chỉ hiển thị mã và tên danh mục, không suy đoán số lượng thuốc. Có tìm kiếm, chọn 10/20/50 mục mỗi trang, trang trước/sau, làm mới, loading/empty/error và thử lại.

Form chuẩn hóa khoảng trắng, kiểm tra rỗng/255 ký tự/NUL. Khi sửa hoặc xóa, tải chi tiết mới từ API. Vô hiệu hóa thao tác khi đang gửi để tránh gửi trùng. Chỉ báo thành công sau khi nhận đúng mã thành công của Backend, sau đó tải lại danh sách. Sau khi tạo, tìm theo tên vừa tạo để mục mới xuất hiện dù API sắp xếp theo ID tăng dần. Có thể dùng “Bỏ tìm kiếm” để trở lại toàn bộ danh sách.

Xóa cần xác nhận tên; lỗi `CATEGORY_IN_USE` giữ nguyên dữ liệu và hiển thị lý do. Lỗi trùng tên hiển thị ngay tại trường nhập. CSRF thất bại giữ nội dung để người dùng thử lại, không chuyển sang màn hình đăng xuất. Session hết hạn hoặc quyền bị thu hồi sẽ đóng form và xóa dữ liệu hiển thị. Không tự gửi lại request ghi khi mất kết nối vì không biết giao dịch đã hoàn tất hay chưa.

Mọi request dùng session cookie. Request ghi lấy CSRF từ API session hiện có rồi gửi `X-CSRF-Token`. Không lưu token vào localStorage. Nội dung danh mục dùng `textContent`, không chèn HTML. Dialog dùng cơ chế modal native, điều hướng bàn phím, Escape và phục hồi focus; lúc đang ghi sẽ khóa đóng hộp thoại.

## File tạo

- `frontend/js/api/categories.js`: adapter 5 API danh mục.
- `frontend/js/pages/manager-categories.js`: trạng thái danh sách, form, xác nhận xóa và xử lý lỗi.
- `frontend/js/utils/category-validation.js`: chuẩn hóa tên và thông báo lỗi.
- `frontend/css/pages/manager-categories.css`: bảng, thanh tìm kiếm, phân trang, modal và responsive.
- `backend/tests/test_categories_frontend.mjs`: unit tests frontend (vị trí theo bộ kiểm thử hiện có).
- `backend/tests/browser_categories.mjs`: fixture và luồng trình duyệt riêng cho danh mục.
- `docs/MODULE_02_6_3_CATEGORIES.md`: tài liệu bàn giao.
- `docs/MODULE_02_6_3_CATEGORIES_{DESKTOP,MOBILE,DIALOG}.png`: ảnh QA, có nhãn API/AUTH MOCK.

## File sửa

- `frontend/pages/manager/index.html`: nội dung danh mục và dialog trong shell.
- `frontend/js/layouts/manager.js`: điều hướng, vòng đời trang và xử lý quyền dùng chung.
- `frontend/js/api/auth.js`: xuất hàm lấy CSRF qua session hiện có.
- `frontend/js/api/manager.js`: tái sử dụng client cho request ghi; giữ adapter GET của Dashboard.
- `backend/tests/browser_manager.mjs`: tích hợp kiểm thử danh mục, giữ kiểm thử layout/auth/Dashboard.

## Kiểm thử

Đã chạy:

```text
node --test backend/tests/test_frontend.mjs backend/tests/test_manager.mjs backend/tests/test_dashboard_frontend.mjs backend/tests/test_categories_frontend.mjs
18 tests passed

cd backend
.venv\Scripts\python.exe -m unittest tests.test_categories
21 tests passed; repositories mocked, không kết nối PostgreSQL

node backend/tests/browser_manager.mjs --categories --dashboard
PASS: kiểm thử Chrome headless với profile và HTTP fixture riêng
```

Trình duyệt kiểm tra danh sách, tìm kiếm/phân trang, thêm chuẩn hóa tên, tên rỗng/trùng, chặn gửi trùng, GET chi tiết trước sửa, cập nhật, xác nhận xóa, xóa thành công và từ chối xóa đang được tham chiếu, CSRF giữ input, lỗi 503/thử lại, 401 xóa giao diện. Có kiểm tra quyền sai/tài khoản khóa, OTP/logout, dialog đăng nhập trang khách hàng và hồi quy Dashboard (số liệu, bộ lọc, lỗi từng phần, dữ liệu rỗng).

Responsive kiểm tra bảng và dialog ở 1440/1024/768/375/320px, layout chung thêm 1280px, không tràn ngang. Kiểm tra bàn phím/focus/Escape, font thực tế, kiểm tra thủ công ảnh desktop/mobile và dialog. Không có JavaScript exception trong lượt kiểm thử.

## Mở và kiểm tra với môi trường thật

1. Chạy Backend và static server frontend bằng cấu hình hiện có. Không thay đổi `.env` hoặc API base URL cho kiểm thử này.
2. Nếu frontend ở cổng 5500, mở `http://localhost:5500/pages/manager/index.html#categories`.
3. Đăng nhập tài khoản VaiTro=2. Tìm tên danh mục, đổi kích thước trang, chuyển trang và thử làm mới.
4. Tạo một danh mục dùng riêng cho kiểm thử, sửa tên rồi xóa sau khi xác nhận. Kiểm tra Network: POST/PUT chỉ gửi `TenLoaiThuoc`, request ghi có cookie và CSRF, danh sách được GET lại sau thành công.
5. Với danh mục đang có thuốc, xác nhận xóa phải nhận 409 và giữ nguyên dữ liệu.

Giới hạn: chưa chạy thao tác ghi qua trình duyệt vào PostgreSQL thật. Luồng browser dùng fixture riêng; unit tests Backend dùng repository mock. Vì vậy chưa xác minh end-to-end trên session, kết nối và dữ liệu PostgreSQL của môi trường đang chạy. Không tuyên bố đã ghi dữ liệu thật thành công.

Không sửa Backend nghiệp vụ, model, PostgreSQL schema, migration hoặc dữ liệu thật. Không triển khai CRUD thuốc, đơn vị/giá, lô, tồn kho hay Cloudinary frontend trong module này. Không thêm thư viện/framework.
