# Module 02.6.5 — Frontend đơn vị tính & giá bán

Mở `frontend/pages/manager/index.html#units` qua máy chủ frontend hiện có, đăng nhập tài khoản quản lý `VaiTro=2`, không bị khóa. Chọn **Đơn vị tính & giá bán** trong điều hướng Manager. Flask và PostgreSQL cần chạy theo cấu hình dự án.

## Chức năng và thiết kế

- Vùng tìm thuốc theo tên/mã dược/số đăng ký; phân trang 10 thuốc, không tải toàn bộ thuốc hoặc đơn vị giá của các thuốc khác.
- Chọn thuốc để xem ảnh HTTPS hiện có, tên, mã thuốc, mã dược và số đăng ký. Ảnh lỗi được ẩn; không tạo ảnh sản phẩm giả.
- Bảng đơn vị bán phân trang 20 dòng, căn phải giá VND và số lượng quy đổi. Không suy đoán tên đơn vị cơ sở.
- Thêm/sửa dùng dialog; sửa lấy GET chi tiết mới. Chỉ gửi ba trường writable, không gửi hoặc sửa ID. Chặn gửi trùng và đóng bằng Escape khi đang lưu/xóa.
- Xóa có GET chi tiết mới, hiển thị tên/giá/quy đổi và yêu cầu xác nhận. Chỉ tải lại danh sách sau `UNIT_DELETED`. `UNIT_IN_USE` giữ dữ liệu và giải thích tham chiếu giỏ thuốc/đơn hàng.
- Loading, empty, lỗi, thử lại và thông báo thành công. Hủy request đọc cũ và kiểm tra phiên bản request để phản hồi cũ không ghi đè thuốc đang chọn.
- Nội dung API dùng `textContent`; URL ảnh dùng kiểm tra HTTPS hiện có. Không có dữ liệu mock trong frontend.
- Tái sử dụng Manager Layout, Be Vietnam Pro cục bộ, Green 1.0 và các semantic token. Desktop chia vùng chọn thuốc và bảng giá; tablet/mobile xếp dọc, danh sách chọn thuốc giới hạn chiều cao và bảng cuộn ngang trong vùng riêng.
- Form có label và lỗi liên kết bằng `aria-describedby`, `aria-invalid`; dialog native quản lý focus, hỗ trợ Escape và trả focus về nút mở. Loading/thông báo có live region.

## API đã tích hợp

| Method | Endpoint | Contract |
| --- | --- | --- |
| GET | `/api/manager/products` | search, page, per_page, sort_by, sort_order; PRODUCTS_LISTED |
| GET | `/api/manager/products/<product_id>` | PRODUCT_FOUND + product |
| GET | `/api/manager/products/<product_id>/units` | page, per_page; UNITS_LISTED + items/page/per_page/total/pages |
| POST | cùng đường dẫn units | UNIT_CREATED + unit |
| GET | `…/units/<unit_id>` | UNIT_FOUND + unit |
| PUT | `…/units/<unit_id>` | UNIT_UPDATED + unit |
| DELETE | `…/units/<unit_id>` | UNIT_DELETED |

POST/PUT chỉ gửi `DonViTinh`, `GiaBan`, `SoLuongQuyDoi`. Model thực tế đúng năm trường `MaDonGia`, `MaThuoc`, `DonViTinh`, `GiaBan`, `SoLuongQuyDoi`, không có khác biệt với yêu cầu.

Validation theo Backend: tên trim, 1–50 Unicode code points, không NUL; giá integer 0–2147483647; quy đổi integer 1–2147483647. Không tự làm tròn, tính giá hay áp tính duy nhất. Backend hiện cho phép trùng tên đơn vị và cập nhật quy đổi; frontend giữ đúng hành vi này.

Dùng `requestManager`/`getManagerData` có sẵn với cookie session và CSRF lấy mới trước POST/PUT/DELETE. Phân biệt lỗi 400, 401, 403 quyền/CSRF, 404 thuốc/đơn vị, 409 tham chiếu/FK, 503 và mất kết nối. Phiên hết hạn/không đủ quyền đóng dialog, dọn dữ liệu và hiển thị gate dùng chung. Không lưu token vào localStorage, không tự gửi lại request ghi sau lỗi mạng.

## Tệp tạo

- `frontend/js/api/units.js` — adapter năm API đơn vị giá.
- `frontend/js/pages/manager-units.js` — chọn thuốc, phân trang, CRUD, dialog, vòng đời và trạng thái.
- `frontend/js/utils/unit-validation.js` — validation, VND và thông báo lỗi.
- `frontend/css/pages/manager-units.css` — bố cục riêng và responsive.
- `backend/tests/test_units_frontend.mjs` — kiểm thử validation và contract client.
- `backend/tests/browser_units.mjs` — fixture và kiểm thử trình duyệt cô lập.
- `backend/tests/check_units_live.py` — kiểm tra Flask/PostgreSQL chỉ đọc, không mock repository.
- Tài liệu này và bốn ảnh `MODULE_02_6_5_UNITS_{DESKTOP,MOBILE,FORM_DESKTOP,FORM_MOBILE}.png`. Ảnh có nhãn AUTH/API MOCK.

## Tệp sửa

- `frontend/pages/manager/index.html` — nội dung trang và dialog trong shell hiện có.
- `frontend/js/layouts/manager.js` — kích hoạt, dừng, dọn trang đơn vị giá.
- `backend/tests/browser_manager.mjs` — ghép cờ `--units`, cập nhật kiểm tra route đã triển khai, giữ ảnh QA module trước.

Không sửa API, nghiệp vụ Backend, SQLAlchemy model, PostgreSQL schema, migration, dependencies hoặc cấu hình. Không thêm CRUD thuốc/lô/tồn kho. Trang thuốc hiện chưa có liên kết riêng đến đơn vị giá; dùng mục điều hướng units sẵn có.

## Kiểm chứng

```powershell
node --test backend/tests/test_frontend.mjs backend/tests/test_manager.mjs backend/tests/test_dashboard_frontend.mjs backend/tests/test_categories_frontend.mjs backend/tests/test_products_frontend.mjs backend/tests/test_units_frontend.mjs
# 24 passed

cd backend
.venv\Scripts\python.exe -m unittest discover -s tests -p test_units.py -v
# 25 passed; repository mocks, chặn Engine.connect

.venv\Scripts\python.exe tests/check_units_live.py
# Real Flask/PostgreSQL READ ONLY; auth/CSRF guards passed.
# Database hiện chưa có thuốc: SKIP danh sách/chi tiết đơn vị có dữ liệu.
```

Kiểm thử trình duyệt:

```powershell
node backend/tests/browser_manager.mjs --units --products --categories --dashboard
```

Bộ units kiểm tra chọn/tìm/phân trang thuốc, không tải units trước khi chọn, rỗng, thêm/sửa/xóa, tên trùng được chấp nhận, giá 0, integer sai/phân số/khoa học/vượt phạm vi, quy đổi 0, sửa quy đổi, body whitelist, CSRF, chặn gửi trùng, Escape khi đang lưu, xác nhận xóa/hủy, 409 giữ dòng, 404, 503/network/retry, phản hồi cũ, phiên hết hạn/403 và dọn dữ liệu. Kiểm tra VND, an toàn nội dung HTML, keyboard/focus và không tràn trang/dialog tại 1440/1280/1024/768/375/320px. Bộ chung kiểm tra hồi quy Manager Layout, Dashboard, danh mục, thuốc và auth trang khách hàng. Các luồng trình duyệt này dùng API/AUTH MOCK, không phải tích hợp PostgreSQL thật.

Kiểm tra syntax JavaScript và `git diff --check` không phát hiện lỗi. Đã xem ảnh QA desktop và form mobile để rà bố cục, font và khoảng cách.

## Giới hạn kiểm chứng

PostgreSQL hiện có tài khoản quản lý nhưng chưa có thuốc. Kiểm tra thật chỉ xác nhận kết nối, đọc danh sách thuốc rỗng và guard session/CSRF; chưa xác minh response đơn vị với dữ liệu sẵn có. Chưa chạy tạo/sửa/xóa trên database thật, đăng nhập OTP thật hoặc browser nối server thật. Script chỉ đọc dùng Flask test client với session ký cho tài khoản quản lý hiện có; không phải kiểm thử OTP.

Sau khi có thuốc thử nghiệm được cho phép, có thể chạy lại script chỉ đọc, rồi kiểm tra CRUD thủ công trên trang `#units` với dữ liệu thử nghiệm. Không tạo thuốc hoặc sửa dữ liệu thật chỉ để vượt qua giới hạn kiểm thử này.
