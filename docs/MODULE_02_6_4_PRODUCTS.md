# Module 02.6.4 — Frontend quản lý thuốc + Cloudinary

## Kết quả triển khai

Trang `frontend/pages/manager/index.html#products` kết nối trực tiếp API Flask hiện có. Không có dữ liệu thuốc mẫu, URL giả, cơ chế đăng nhập giả hoặc secret Cloudinary trong mã frontend.

Danh sách hỗ trợ tìm kiếm tên/mã dược/số đăng ký, lọc danh mục và phân loại, sắp xếp theo lựa chọn cho phép, phân trang 10/20/50 mục. Bảng hiển thị ảnh, tên/ID, mã dược, số đăng ký, danh mục, phân loại và thao tác Xem/Sửa/Xóa. Bảng cuộn ngang trong vùng riêng khi màn hình nhỏ, không làm tràn trang. Không suy đoán giá bán hay tồn kho từ API thuốc.

Form chia các nhóm thông tin cơ bản, sản xuất, sử dụng, ngưỡng tồn và ảnh. Desktop dùng hai cột trường cùng khu vực ảnh riêng; mobile chuyển một cột. Chi tiết lấy GET mới và hiển thị nội dung theo nhóm. Sửa cũng tải GET chi tiết trước khi điền form, không thay ID. Phân loại theo model thực tế: False = Không cần tư vấn; True = Cần dược sĩ tư vấn.

Kiểm tra các trường bắt buộc, giới hạn chuỗi theo schema, chuỗi trắng/NUL, danh mục hợp lệ, URL HTTPS, số nguyên không âm (tối đa INT PostgreSQL), boolean. Payload được tạo từ whitelist schema, không gửi MaThuoc, GhiChu, giá hoặc trường ngoài model. Backend hiện chỉ trả `INVALID_REQUEST`, không trả lỗi từng trường; giao diện tự kiểm tra từng trường và hiển thị lỗi Backend tổng quát khi cần.

Xóa có dialog xác nhận lấy tên mới từ GET; chỉ gửi DELETE sau xác nhận. Không bỏ hàng trước khi API thành công. Xử lý 409 PRODUCT_IN_USE và giữ dữ liệu. Không xóa ảnh, lô hoặc đơn vị giá liên quan.

Mọi request dùng cookie session. Request ghi/upload dùng CSRF từ cơ chế hiện có. 401/403 quyền hoặc tài khoản khóa đóng trang và dọn dữ liệu; CSRF_FAILED giữ nội dung form để thử lại. Chặn gửi trùng trong lúc lưu/upload/xóa, không tự động retry request ghi khi mất kết nối. API content dùng textContent, ảnh chỉ hiển thị URL HTTPS/preview blob cục bộ. Revoke blob khi thay ảnh, đóng form hoặc đăng xuất.

## Hợp đồng API đã đối chiếu source

| Method | Endpoint | Input / response |
| --- | --- | --- |
| GET | `/api/manager/products` | search, category_id, phan_loai=true/false, page, per_page, sort_by, sort_order; PRODUCTS_LISTED + items/page/per_page/total/pages |
| GET | `/api/manager/products/<id>` | PRODUCT_FOUND + product |
| POST | `/api/manager/products` | JSON đủ trường schema, không MaThuoc; 201 PRODUCT_CREATED + product |
| PUT | `/api/manager/products/<id>` | JSON các trường form; PRODUCT_UPDATED + product |
| DELETE | `/api/manager/products/<id>` | Không body; PRODUCT_DELETED |
| GET | `/api/manager/categories` | Lấy đủ các trang, mỗi trang 100 mục để tên danh mục/bộ chọn không thiếu dữ liệu |
| POST | `/api/manager/uploads/products` | FormData field image; UPLOAD_SUCCESS + data.url/data.public_id |

Giữ toàn bộ trường thực tế: MaLoaiThuoc, HinhAnh, TenThuoc, MoTa, MaDuoc, SoDangKy, DangBaoChe, QuyCachDongGoi, NhaSanXuat, NuocSanXuat, CachDung, ChongChiDinh, BaoQuan, NguongTonKho, PhanLoai. Không áp tính duy nhất cho MaDuoc/SoDangKy.

## Quy trình ảnh

1. Chọn JPEG/PNG/WebP tối đa 5 MiB. File rỗng, quá giới hạn hoặc MIME không hỗ trợ bị từ chối trước request; Backend tiếp tục kiểm tra nội dung thực tế.
2. Preview cục bộ được ghi rõ chưa upload. Nhấn Upload ảnh để gửi multipart qua Flask, browser tự đặt boundary (không ép Content-Type JSON).
3. Chỉ điền HinhAnh sau UPLOAD_SUCCESS với URL hợp lệ. Nhấn Lưu thuốc mới ghi URL vào hồ sơ.
4. Khi lưu thất bại, giữ toàn bộ form và URL đã upload, không upload lại. Sửa không đổi ảnh sẽ giữ URL cũ. Có thể sử dụng URL HTTPS hiện có theo khả năng Backend.
5. Nếu chọn ảnh mới nhưng chưa upload, phải upload hoặc bỏ lựa chọn trước khi lưu. Không âm thầm lưu URL ảnh cũ thay ảnh đang preview.

## File tạo

- `frontend/js/api/products.js` — CRUD và upload adapter.
- `frontend/js/pages/manager-products.js` — danh sách, form, chi tiết, upload, xác nhận xóa.
- `frontend/js/utils/product-validation.js` — metadata trường, validation, thông báo lỗi.
- `frontend/css/pages/manager-products.css` — bảng, bộ lọc, form, chi tiết và responsive.
- `backend/tests/test_products_frontend.mjs` — unit tests frontend theo vị trí test hiện có.
- `backend/tests/browser_products.mjs` — fixture/luồng trình duyệt thuốc và upload.
- `backend/tests/check_products_live.py` — kiểm tra tích hợp thật tùy chọn, PostgreSQL READ ONLY; cờ --upload tạo một ảnh QA thật.
- `docs/MODULE_02_6_4_PRODUCTS.md` và `docs/MODULE_02_6_4_PRODUCTS_{DESKTOP,MOBILE,FORM_DESKTOP,FORM_MOBILE}.png` — bàn giao/ảnh QA có nhãn MOCK.

## File sửa

- `frontend/pages/manager/index.html` — nội dung thuốc trong Manager shell.
- `frontend/js/layouts/manager.js` — vòng đời/điều hướng trang thuốc và xử lý session dùng chung.
- `frontend/js/api/manager.js` — hỗ trợ FormData và timeout upload, giữ JSON/GET tương thích Dashboard/danh mục.
- `backend/tests/browser_manager.mjs` — ghép kiểm thử thuốc vào bộ hồi quy và ảnh fixture chỉ trong test.

Không sửa Backend nghiệp vụ, config, model, schema, migration hoặc framework. Không triển khai UI đơn vị giá, lô, tồn kho hoặc Dashboard mới.

## Kết quả kiểm thử

### Unit/API regression

```text
node --test backend/tests/test_frontend.mjs backend/tests/test_manager.mjs backend/tests/test_dashboard_frontend.mjs backend/tests/test_categories_frontend.mjs backend/tests/test_products_frontend.mjs
21 passed

cd backend
.venv\Scripts\python.exe -m unittest tests.test_products tests.test_categories
55 passed
.venv\Scripts\python.exe -m unittest discover -s tests -p test_uploads.py
29 passed
```

Unit tests Backend mock repository/provider; không sử dụng CSDL thật. Bộ upload cần chạy bằng discover vì import helper theo thư mục tests hiện có; không sửa tests cũ để đổi cách import.

### Chrome headless

```text
node backend/tests/browser_manager.mjs --products --categories --dashboard
PASS
```

Profile, HTTP API fixture và ảnh fixture được cô lập trong test, không phải dữ liệu production. Kiểm tra danh sách/tìm kiếm/danh mục/phân loại/phân trang, chi tiết, thêm thiếu dữ liệu và thành công, chặn gửi trùng, sửa không upload lại ảnh, xóa/xóa bị tham chiếu, file quá 5 MiB/MIME sai, upload lỗi/thử lại, lưu lỗi sau upload giữ URL, CSRF giữ form, API 503/thử lại và session hết hạn. Regression danh mục, Dashboard, layout, OTP/logout và dialog trang khách hàng đã qua. Không có JavaScript exception.

Đã kiểm tra không tràn ngang ở 1440/1024/768/375/320px cho danh sách/form; layout thêm 1280px. Có kiểm tra focus/bàn phím/Escape của shell và dialog trong bộ hồi quy, nhãn native cho trường form, xem trực quan ảnh QA desktop/mobile. Chưa kiểm thử bằng screen reader; không khẳng định đầy đủ WCAG.

### Backend/PostgreSQL/Cloudinary thật — không mock

Đã chạy từ thư mục backend:

```text
.venv\Scripts\python.exe tests/check_products_live.py --upload
PASS real Flask/PostgreSQL: session guards, list, category/filter/search/sort/page, upload CSRF
PASS real Cloudinary: Flask multipart upload and provider resource verification
```

Test tạo signed session chỉ trong Flask test client cho tài khoản quản lý đang tồn tại, route guards vẫn đọc role/status thật từ PostgreSQL. Không kiểm thử OTP thật trong lần kiểm tra này. Transaction PostgreSQL được đặt READ ONLY; không ghi hàng dữ liệu hay chạy migration. CSDL thực tế hiện chưa có thuốc nên GET chi tiết được SKIP. Không tuyên bố đã kiểm thử live CRUD ghi hoặc toàn luồng browser → PostgreSQL.

Đã upload đúng một ảnh PNG QA nhỏ qua route Flask thật và xác minh URL bằng API resource Cloudinary thật. Public ID:

`lan-yen-pharmacy/products/73c526710c884f628bb4be220167bc98`

Ảnh QA giữ lại trên Cloudinary, không gọi API xóa; không dùng asset này làm ảnh thuốc mẫu trên frontend. Không ghi URL QA vào PostgreSQL, không in API key/secret vào báo cáo.

## Cách mở và kiểm tra thủ công

1. Chạy Flask Backend và static server frontend theo cấu hình hiện có. Nếu frontend dùng cổng 5500, mở `http://localhost:5500/pages/manager/index.html#products`.
2. Đăng nhập VaiTro=2, tài khoản không bị khóa. Nếu chưa có danh mục, tạo danh mục tại #categories trước.
3. Chọn Thêm thuốc, nhập đủ các nhóm thông tin. Chọn ảnh, kiểm tra preview, nhấn Upload ảnh, đợi xác nhận rồi Lưu thuốc.
4. Tìm tên/mã dược/số đăng ký; thử danh mục/phân loại/sắp xếp và phân trang. Xem chi tiết, sửa tên hoặc mô tả không thay ảnh để kiểm tra giữ URL.
5. Chỉ xóa dữ liệu thử do bạn tạo khi không còn cần dùng; xác nhận tên trước khi xóa. Thuốc có dữ liệu liên quan phải nhận lỗi 409 và giữ nguyên.

Giới hạn còn lại: chưa chạy CRUD ghi trên PostgreSQL thật hoặc đăng nhập OTP thật trong kiểm thử tích hợp này. Cần xác minh các thao tác ghi trên dữ liệu development do người quản lý chủ động tạo. Phần triển khai không sửa CSDL, model hoặc migration; chỉ kiểm thử đọc CSDL thật và tạo một tài nguyên QA Cloudinary nêu trên.
