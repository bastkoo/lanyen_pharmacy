# Module 02.6.6 — Frontend lô thuốc và tồn kho

## Mở trang

- Lô thuốc: `frontend/pages/manager/index.html#batches`.
- Tồn kho: `frontend/pages/manager/index.html#inventory`.
- Chạy frontend/Flask bằng cấu hình hiện có; đăng nhập tài khoản quản lý `VaiTro=2`, `TrangThai=False`. Có thể dùng các mục **Lô thuốc** và **Tồn kho** trong Manager.

## Chức năng

Trang lô dùng vùng tìm/chọn thuốc phía trên và bảng dữ liệu rộng phía dưới. Tìm thuốc qua API theo tên/mã dược/số đăng ký, phân trang 20 thuốc. Chỉ tải các lô của thuốc đang chọn, phân trang 20 lô. Danh tính thuốc gồm tên, mã, mã dược, số đăng ký và ảnh HTTPS nếu có; ảnh lỗi được ẩn, không tạo ảnh giả.

Bảng hiển thị đủ mã lô, số lô, ngày sản xuất/hạn, lượng nhập/tồn, giá nhập VND, trạng thái hạn và thao tác xem/sửa/yêu cầu xóa. Trạng thái tại bảng lô tính theo ngày Việt Nam trên thiết bị; không tự đặt ngưỡng “sắp hết hạn”. Cảnh báo sắp hết hạn tập trung ở trang tồn kho theo API Backend.

Thêm lô gửi đúng năm trường: `SoLoSanXuat`, `NgaySanXuat`, `HanSuDung`, `SoLuongNhap`, `GiaNhap`. Backend tự khởi tạo tồn bằng lượng nhập. Sửa tải GET chi tiết mới, chỉ gửi bốn trường thông tin lô; lượng nhập hiển thị disabled, không gửi `SoLuongNhap` hoặc `SoLuongTon`. Xem chi tiết cũng tải GET mới.

Xóa tải chi tiết mới, hiển thị số lô và tên thuốc, chỉ gửi DELETE sau xác nhận. Backend hiện **luôn từ chối xóa lô tồn tại bằng `409 BATCH_DELETE_UNSAFE`**. Giao diện hiển thị đúng lý do, giữ nguyên dữ liệu và không báo xóa thành công. Không có trường hợp xóa hợp lệ để kiểm thử thành công trong contract hiện tại. Không sửa Backend để tạo đường xóa mới.

Trang tồn kho có ba bảng riêng, mỗi bảng có loading/empty/error/retry, làm mới, lọc cục bộ và phân trang độc lập:

1. Tổng tồn theo thuốc: gồm thuốc chưa có lô; tổng vật lý gồm tất cả lô, kể cả đã hết hạn.
2. Tồn thấp: lấy API low-stock, giữ đúng điều kiện Backend `TongSoLuongTon <= NguongTonKho`.
3. Hạn sử dụng: `status=expiring` hoặc `expired`; mặc định 30 ngày theo Backend, hỗ trợ 0–36500 ngày. Trạng thái đã hết hạn không giới hạn số ngày, ô days được vô hiệu hóa. Chỉ các lô còn tồn được Backend trả về. Số ngày còn lại dùng `as_of`, không dùng đồng hồ thiết bị.

Nút **Quản lý lô** ở các bảng tồn kho chuyển đến trang batches và tải đúng thuốc. Nút nhảy đến bảng tồn thấp/hạn dùng cuộn và chuyển focus trong trang, không làm thay đổi hash route.

## Contract và giới hạn đã đối chiếu

Models `LoThuoc` và `Thuoc.NguongTonKho` khớp mô tả yêu cầu, không có khác biệt. Không có `NhaCungCap`. Không sửa model/schema/migration.

| Method | API | Contract |
| --- | --- | --- |
| GET | `/api/manager/products` | search, page, per_page, sort_by, sort_order |
| GET | `/api/manager/products/<product_id>` | PRODUCT_FOUND + product |
| GET | `/api/manager/products/<product_id>/batches` | BATCHES_LISTED + items/page/per_page/total/pages |
| POST | cùng đường dẫn batches | BATCH_CREATED + batch, HTTP 201 |
| GET | `…/batches/<batch_id>` | BATCH_FOUND + batch |
| PUT | `…/batches/<batch_id>` | BATCH_UPDATED + batch |
| DELETE | `…/batches/<batch_id>` | 409 BATCH_DELETE_UNSAFE nếu thuốc/lô tồn tại |
| GET | `/api/manager/inventory/summary` | INVENTORY_SUMMARY + phân trang |
| GET | `/api/manager/inventory/low-stock` | LOW_STOCK_LISTED + phân trang |
| GET | `/api/manager/inventory/expiring` | status, days, phân trang; EXPIRING_BATCHES_LISTED / EXPIRED_BATCHES_LISTED + as_of/days/status |

Các danh sách lô/tồn kho không nhận search hoặc bộ lọc trạng thái tồn tùy ý. Tên/số lô trong các bảng chỉ lọc trang hiện tại; nhãn ô lọc, caption, số bản ghi và thông báo rỗng đều nói rõ giới hạn này. Danh sách low-stock riêng là bộ lọc tồn thấp trên toàn tập dữ liệu từ Backend. Tìm thuốc ở vùng chọn thuốc dùng server search thật.

Validation: số lô trim 1–100 Unicode code points, không NUL; ngày lịch hợp lệ đúng YYYY-MM-DD, hạn sau ngày sản xuất; lượng nhập integer 1–2147483647, giá integer 0–2147483647. Không áp giới hạn ngày theo hôm nay, không làm tròn, không áp số lô duy nhất. Không có điều chỉnh tồn hoặc nhập/xuất lịch sử.

Xử lý riêng `BATCH_QUANTITY_IMMUTABLE`, `BATCH_STOCK_INCONSISTENT`, `BATCH_DELETE_UNSAFE`, 404 thuốc/lô, FK conflict, validation, CSRF, 503 và mạng. Khi số lượng hiện hữu bất nhất, giữ dữ liệu và thông báo; không tự sửa tồn.

## Bảo mật, responsive và accessibility

Dùng API client session/CSRF hiện có; GET dùng cookie, POST/PUT/DELETE lấy CSRF mới. Không lưu token vào localStorage, không có bypass quyền hoặc dữ liệu mock trong frontend. Guard Backend tiếp tục kiểm tra quyền thực tế. 401/403 quyền hoặc tài khoản khóa đóng dialog, dọn dữ liệu và về gate. CSRF lỗi giữ form để thử lại. Không tự gửi lại request ghi khi mạng lỗi.

Nội dung API dùng DOM `textContent`, ảnh qua kiểm tra HTTPS có sẵn. AbortController và phiên bản request chặn phản hồi cũ khi đổi thuốc/trang/bộ lọc hoặc rời khu vực. Chặn gửi trùng và đóng bằng Escape khi đang ghi.

Dùng Green 1.0, Be Vietnam Pro và semantic tokens Manager, không thêm framework. Bảng cuộn ngang trong region có nhãn và focus bằng bàn phím, không tràn toàn trang. Form desktop hai cột, mobile một cột. Dialog native, label/lỗi liên kết, aria-invalid/live region và khôi phục focus sau khi đóng. Không suy đoán tên đơn vị cơ sở.

## File tạo

- `frontend/js/api/batches.js`
- `frontend/js/api/inventory.js`
- `frontend/js/utils/batch-validation.js`
- `frontend/js/components/stock-table.js` — bảng có trạng thái, lọc trang hiện tại và phân trang dùng chung cho lô/tồn kho.
- `frontend/js/pages/manager-batches.js`
- `frontend/js/pages/manager-inventory.js`
- `frontend/css/pages/manager-stock.css`
- `backend/tests/test_stock_frontend.mjs`
- `backend/tests/browser_stock.mjs`
- `backend/tests/check_stock_live.py`
- Tài liệu này và ảnh QA `MODULE_02_6_6_STOCK_*.png` có nhãn AUTH/API MOCK.

## File sửa

- `frontend/pages/manager/index.html` — hai khu vực và dialog lô trong shell.
- `frontend/js/layouts/manager.js` — vòng đời, dọn dữ liệu và điều hướng lô/tồn kho.
- `backend/tests/browser_manager.mjs` — cờ `--stock`, fixture cô lập và cập nhật kiểm tra route đã triển khai; giữ ảnh các module trước.

Các thay đổi Module 02.6.5 đang có trong workspace được giữ nguyên. Không sửa Backend nghiệp vụ, model, migrations, dependency, cấu hình hoặc dữ liệu PostgreSQL.

## Kiểm thử đã thực hiện

```powershell
node --test backend/tests/test_frontend.mjs backend/tests/test_manager.mjs backend/tests/test_dashboard_frontend.mjs backend/tests/test_categories_frontend.mjs backend/tests/test_products_frontend.mjs backend/tests/test_units_frontend.mjs backend/tests/test_stock_frontend.mjs
# 28/28 đạt

cd backend
.venv\Scripts\python.exe -m unittest discover -s tests -p test_batches_inventory.py -v
# 39/39 đạt, mock repositories và chặn Engine.connect

.venv\Scripts\python.exe tests/check_stock_live.py
# PASS real Flask/PostgreSQL READ ONLY: 5 truy vấn inventory, guard session/CSRF.
# SKIP dữ liệu có bản ghi: hiện chưa có thuốc/lô; các danh sách thật đều rỗng.

cd ..
node backend/tests/browser_manager.mjs --stock --units --products --categories --dashboard
```

Bộ Chrome kiểm tra thêm/xem/sửa, thiếu trường/ngày sai/SL nhập 0/giá phân số, giữ form khi validation/CSRF lỗi, payload không chứa số lượng khi sửa, chặn gửi trùng/Escape, lỗi nghiệp vụ sửa, xác nhận/hủy xóa và từ chối xóa giữ dòng, 404, tìm thuốc, lọc trang hiện tại, phân trang, phản hồi chậm/đổi thuốc nhanh, mạng/503/retry, tổng tồn gồm lô hết hạn, thuốc chưa có lô, ngưỡng bằng tồn, cảnh báo sắp hết hạn/hôm nay/đã hết hạn, days sai, dữ liệu rỗng, lỗi panel độc lập, điều hướng đúng thuốc, phiên hết hạn/403, dọn dữ liệu và keyboard/focus. Kích thước 1440/1280/1024/768/375/320px không tràn trang/dialog. Bộ hồi quy gồm Manager, Dashboard, danh mục, thuốc, đơn vị giá và auth trang khách hàng.

Đã xem ảnh QA desktop, tồn kho mobile và form mobile. Kiểm tra syntax JS và `git diff --check` không phát hiện lỗi. Các bài trình duyệt dùng AUTH/API MOCK trong backend/tests, không phải CRUD PostgreSQL thật.

## Giới hạn còn lại

PostgreSQL thật kết nối được; năm truy vấn summary/low-stock/expiring 30 ngày/expiring 0 ngày/expired và guard session/CSRF đã chạy. Database hiện chưa có thuốc nên chưa xác minh số liệu tổng hợp có dữ liệu, danh sách/chi tiết lô thật hoặc tạo/sửa lô trên database thật. Không tạo dữ liệu thật chỉ để kiểm thử vì lô tạo ra hiện không thể xóa theo Backend.

Script chỉ đọc dùng Flask test client với session ký cho tài khoản quản lý hiện có, vẫn chạy guard/DB thật; không kiểm thử OTP thật hoặc trình duyệt nối server thật. Chưa kiểm thử khóa đồng thời PostgreSQL. Xóa thành công không được Backend hỗ trợ và không được mô phỏng thành chức năng sản phẩm. Không thực hiện migration hoặc thay đổi dữ liệu hiện có.
