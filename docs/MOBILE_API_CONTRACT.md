# Mobile API Contract — Lan Yến Pharmacy

## Cập nhật: Mobile dùng JWT

Theo quyết định mới của chủ dự án, Flutter dùng nhóm API **/api/mobile/auth** với
Bearer access/refresh token, không dùng cookie/session của Website.
Contract mới và cách chạy tại [MOBILE_AUTH.md](MOBILE_AUTH.md).
Phần cookie/CSRF bên dưới được giữ làm tài liệu đối chiếu API Website; trạng thái
transport chưa triển khai bên dưới là lịch sử của giai đoạn nền tảng.
JWT hiện đã được triển khai trong API mới và Flutter.

Ngày đối chiếu source: 26/11/2026. Phần dưới ghi nhận giai đoạn nền tảng trước JWT.
Không khởi động Flask trong nhiệm vụ này: create_app/before_request có thể khởi động
worker hết hạn đơn. Không gọi endpoint hay truy cập PostgreSQL.

## Môi trường đã xác minh qua source

- backend/run.py: python run.py bind 127.0.0.1, port 5000; debug theo APP_ENV.
- Blueprint prefix /api; frontend/js/config/app.js cũng dùng /api đúng một lần.
- Flask CLI có thể override host/port; cấu hình process đang chạy chưa kiểm thử.
- AppConfig đọc API_BASE_URL qua dart-define, không có URL mặc định; yêu cầu
  http(s) origin + /api, không credentials/query/fragment. /api/ cũng được chuẩn hóa.
- Base URL là cấu hình công khai, không được nhúng secret bằng dart-define.

| Nền tảng | Địa chỉ cho entrypoint run.py đã đọc | Trạng thái |
|---|---|---|
| Chrome cùng máy | http://127.0.0.1:5000/api | Xác minh source, chưa kết nối |
| Android Emulator | http://10.0.2.2:5000/api | Mapping host tham khảo; run.py chỉ bind loopback, cần kiểm tra reachability riêng |
| Android thật | http://<LAN_IP>:<PORT>/api | Placeholder; run.py hiện không lắng nghe LAN |
| iOS Simulator | http://<REACHABLE_HOST>:<PORT>/api | Placeholder, chưa có môi trường macOS |
| iOS thật | https://<REACHABLE_HOST>/api | Placeholder, chưa kiểm thử |

Không sửa host/port, CORS, TLS, CSRF hoặc cookie Backend trong nhiệm vụ này.
Muốn dùng thiết bị thật cần đề xuất cấu hình development riêng và được duyệt.

## Authentication và role

Nguồn: backend/app/routes/auth_routes.py, controllers/auth_controller.py,
schemas/auth_schema.py, utils/auth.py, services/auth_service.py,
models/nguoi_dung.py, config/config.py; Website đối chiếu js/api/auth.js.

Luồng auth thực tế dùng signed Flask session cookie, không dựa trên JWT bearer.
Flask-JWT-Extended được init nhưng sự hiện diện thư viện không chứng minh auth route dùng JWT.
Cookie tên lanyen_session, HttpOnly=true; Secure lấy từ env (mặc định true),
SameSite lấy env (mặc định Lax); permanent lifetime 8 giờ; không refresh mỗi request.
Giá trị env đang có chưa đọc/không công bố; không khẳng định runtime dùng các mặc định.

Role 0=người mua/khách hàng, 1=nhân viên, 2=quản lý. TrangThai=false hoạt động,
true khóa. require_roles đọc lại user/role/status từ PostgreSQL cho request được bảo vệ.
Không có cơ chế manager tự động kế thừa endpoint role=1.

CORS ở app/__init__.py: explicit AUTH_ALLOWED_ORIGINS, supports_credentials=true,
allow headers Content-Type và X-CSRF-Token. Origin Web preview với port ngẫu nhiên
không mặc nhiên nằm trong allowlist. SameSite/Secure và browser policy phải được
kiểm chứng; native cookie handling cần transport riêng. Không vô hiệu hóa bảo mật.

## Contract auth đã đối chiếu source, chưa gọi thật

Paths dưới đây bao gồm /api; AppConfig cũng đã chứa /api nên api.dart chỉ nối auth/me.
POST dùng application/json, session cookies và X-CSRF-Token. Không gửi OTP thật.

| Method / path | Request | Response quan trọng | Quyền |
|---|---|---|---|
| GET /api/auth/me | không body | code=AUTHENTICATED, user, csrf_token | 0/1/2; lỗi anonymous 401 có csrf_token |
| POST /api/auth/otp/request | phone: string, dài 1..24 trước chuẩn hóa | JSON từ otp_service; xem phần OTP bên dưới | CSRF, chưa yêu cầu đã login |
| POST /api/auth/otp/verify | phone, otp: chuỗi 6 chữ số | AUTHENTICATED + user + csrf_token hoặc PROFILE_REQUIRED + csrf_token | session otp_binding, CSRF |
| POST /api/auth/register | ho_ten: string 1..255, không rỗng/control | AUTHENTICATED + user + csrf_token | verification_proof trong session, CSRF |
| POST /api/auth/logout | {} | code=LOGGED_OUT | CSRF; session.clear |
| PUT /api/auth/me | HoTen, AnhDaiDien (nullable) | PROFILE_UPDATED + user | 0/1/2, CSRF |
| POST /api/auth/me/avatar | multipart image | xem upload_controller | 0/1/2, CSRF; chưa đối chiếu response chi tiết |
| GET /api/auth/me/points | page/per_page theo UnitQuerySchema | POINTS_LISTED + kết quả list_points | 0/1/2, chưa đối chiếu toàn bộ payload |
| GET/POST /api/auth/me/addresses | query hoặc TinhThanh/PhuongXa/DiaChiCuThe | theo address_controller | 0/1/2; mutation CSRF; chưa model hóa |
| PUT/DELETE /api/auth/me/addresses/<id> | theo method | theo address_controller | 0/1/2 + ownership, mutation CSRF |
| PATCH /api/auth/me/addresses/<id>/primary | theo address_controller | theo address_controller | 0/1/2, CSRF |

UserSchema: MaNguoiDung integer (DB BIGINT), HoTen/SDT string, VaiTro integer,
TrangThai boolean, Email/AnhDaiDien nullable string. Mobile SessionUser chỉ đọc
id/name/role và từ chối thiếu TrangThai=false, role lạ hoặc dữ liệu sai kiểu.
BIGINT trên Flutter Web có rủi ro giới hạn chính xác JavaScript; chưa tích hợp dữ liệu
thật, cần thống nhất cách biểu diễn trước khi dùng ID/tiền lớn, không tự đổi API.

Bootstrap CSRF: Website GET auth/me, kể cả lỗi UNAUTHENTICATED vẫn lấy csrf_token
từ JSON và cookie phiên, sau đó gửi X-CSRF-Token cho mutation. CSRF_FAILED=403
cũng có thể do Origin không được phép, không đồng nghĩa phiên hết hạn.
Auth thành công clear session rồi tạo user_id và csrf_token mới; logout clear session.
Không lưu OTP/password/cookie trong Flutter source, log hoặc SharedPreferences.

Error source: JSON {code: string}; tùy nhánh có csrf_token. Auth payload có
JSON_REQUIRED=415, INVALID_REQUEST=400; UNAUTHENTICATED=401,
FORBIDDEN/ACCOUNT_LOCKED/CSRF_FAILED=403, DATABASE_UNAVAILABLE=503.
OTP có rate limit và expiry riêng cần đọc otp_service trước tích hợp; chưa mô tả
response request_otp chi tiết như đã xác minh. ApiClient không giả định response
mọi endpoint cùng envelope, không biến mọi 403 thành logout.
CSRF chỉ giữ trong RAM SessionStorage, chưa triển khai native cookie jar.

## Public catalog — source inventory

Nguồn routes/public_catalog_routes.py, controllers/public_catalog_controller.py,
schemas/public_catalog_schema.py, services/product_service.py/category_service.py/
public_promotion_service.py; Website js/api/public-catalog.js dùng credentials=omit.

| GET path | Query chính | Success envelope |
|---|---|---|
| /api/categories | search, page=1, per_page=100 (max100) | CATEGORIES_LISTED + items/page/per_page/total/pages |
| /api/products | search, category_id, ke_don=true/false, sort_order=asc/desc, page, per_page=12 (max100) | PRODUCTS_LISTED + items/page/per_page/total/pages |
| /api/products/<id> | promotion_id tùy chọn | PRODUCT_FOUND + product |
| /api/promotions | page, per_page=12 (max100) | PROMOTIONS_LISTED + items/page/per_page/total/pages/as_of |
| /api/promotions/<id>/products | page, per_page=12 (max100) | PROMOTION_PRODUCTS_LISTED + promotion/items/page/per_page/total/pages/as_of |

Không auth decorator trên public catalog. Query lặp hoặc sai schema bị INVALID_REQUEST.
PublicProductSchema chứa tên, hình, mô tả, phân loại và fields công khai; service
bổ sung DonViGia. Chưa tạo models/catalog methods hoặc UI nghiệp vụ trong Flutter.

## Protected groups — chỉ xác minh phạm vi routes

- /api/manager/categories, products, units, batches, inventory, promotions,
  accounts, uploads, dashboard: require_roles(2). Các mutation có CSRF.
- /api/employee/orders: require_roles(1); mutation có CSRF.
- /api/orders: thao tác khách đã xác thực theo role 0/1/2 và ownership trong services.
- /api/cart: có guest session, không mặc định mọi thao tác yêu cầu đăng nhập.
- /api/chat: customer routes role 0; employee thread routes role 1.

Nguồn: các file tương ứng backend/app/routes/. Đây là inventory nhóm, không phải
contract request/response hoàn chỉnh cho mọi nghiệp vụ. Không dùng để tự triển khai
Employee/Manager khi chủ dự án chưa xác định phạm vi.

## Trạng thái nền tảng Mobile

Đã có AuthApi.readSession ở api.dart, ApiClient dùng chung có JSON/timeout/error/
URL validation và điểm inject ApiTransport. Default UnconfiguredTransport luôn
báo chưa bật kết nối. Không có request tự động khi mở preview.
Test chỉ dùng stub responses; không fake API trong app và không login thật.
Chưa có transport HTTP thực, cookie persistence, request cancellation vật lý,
CSRF mutation, session lifecycle native/Web hoặc end-to-end Backend.
Timeout chỉ giới hạn chờ; không chứng minh request bị hủy phía server.

Cần xác nhận tiếp: phạm vi feature, origin dev được phép, cấu hình kết nối từng
thiết bị, transport và chính sách session. Tất cả thay đổi Backend phải đề xuất riêng.

## Trang chủ khách hàng — cập nhật 26/11/2026

Flutter sử dụng adapter chỉ đọc `/api/mobile/catalog` để có CORS cho các origin
Mobile đã cấu hình. Adapter gọi lại đúng public_catalog_controller và các service
của Website; không đổi endpoint `/api/categories`, `/api/products`, `/api/promotions`,
không đổi cookie/CSRF/JWT, không có migration hay thay đổi dữ liệu.

| Phương thức | Endpoint (sau /api) | Query | Dữ liệu chính |
|---|---|---|---|
| GET | mobile/catalog/categories | page, per_page (tối đa 100) | code CATEGORIES_LISTED, items MaLoaiThuoc/TenLoaiThuoc, page/pages/total |
| GET | mobile/catalog/promotions | page, per_page (tối đa 100) | code PROMOTIONS_LISTED, items MaChuongTrinh/TenChuongTrinh/NgayBatDau/NgayKetThuc/TrangThai |
| GET | mobile/catalog/promotions/{id}/products | page, per_page (12 trên app) | code PROMOTION_PRODUCTS_LISTED, promotion, items, page/pages/total |
| GET | mobile/catalog/products | search, category_id, page, per_page | code PRODUCTS_LISTED, items, page/pages/total |
| GET | mobile/catalog/products/{id} | không truyền filter | code PRODUCT_FOUND, product |

Các endpoint này công khai như Website, không gửi JWT, cookie hay CSRF.
CORS chỉ cho AUTH_ALLOWED_ORIGINS và MOBILE_AUTH_ALLOWED_ORIGINS trên adapter mới.
Nguồn: backend/app/routes/mobile_catalog_routes.py,
controllers/public_catalog_controller.py, schemas/public_catalog_schema.py,
services/category_service.py, product_service.py, public_promotion_service.py.

Giá lấy từ DonViGia (GiaBan, DonViTinh, ConHang); ưu đãi chỉ hiển thị giá giảm
khi chương trình ACTIVE, GiaKhuyenMai < GiaBan, còn quota SoLuongKhuyenMai
và còn hàng. Chi tiết có thể có KhuyenMai trên từng đơn vị giá. Giữ số nguyên
và định dạng VND không dùng double; từ chối số JSON vượt miền nguyên chính xác
của Flutter Web thay vì hiển thị giá bị làm tròn.

Trang chủ tải độc lập khuyến mãi/danh mục, tải tất cả trang danh mục rồi hiển thị
6 mục đầu, mở rộng/thu gọn tại chỗ. Tìm kiếm gửi khi nhấn nút hoặc Enter; có
phân trang, bỏ kết quả cũ sau khi đóng/đổi truy vấn. Sản phẩm mở bảng chi tiết
đọc API mới nhất. Hỗ trợ kéo để tải lại và tải lại khi ứng dụng trở về foreground.
FAQ chuyển các thông điệp thương hiệu hiện có ở frontend/pages/customer/home.html
thành câu hỏi; không bổ sung chứng nhận, địa chỉ hoặc công dụng thuốc giả định.

Thanh cố định có Trang chủ/Điểm thưởng/Tư vấn/Giỏ hàng/Tài khoản.
Tài khoản hiển thị người đăng nhập và đăng xuất JWT thật. Đơn của tôi, điểm thưởng,
giỏ hàng hiện chỉ thông báo đang hoàn thiện; tư vấn là giao diện chờ nhắn tin theo
yêu cầu. Không gọi API cookie của Website hoặc giả lập số điểm/số lượng giỏ hàng.

Đã kiểm tra đọc HTTP local: /api/categories trả 13 danh mục; adapter promotions
trả 2 chương trình (ACTIVE/UPCOMING); sản phẩm chương trình và tìm kiếm trả 200;
Origin http://127.0.0.1:5510 nhận CORS phù hợp. Không ghi dữ liệu qua các lần kiểm tra.
Widget tests dùng fixture cô lập; kiểm thử TalkBack/VoiceOver, Android/iOS thật
và tương tác Chrome thực tế chưa được thực hiện.

## Điều chỉnh trang chủ và giỏ hàng JWT — 26/11/2026

Phần này thay trạng thái giỏ hàng chờ triển khai ở mục trước.

- Header dùng logo hiện có và tên Lan Yến Pharmacy, cuộn ẩn nhận diện và ghim ô
  tìm kiếm bo tròn. Banner thương hiệu nhỏ, khối tư vấn gọn; footer dùng những
  thông điệp thương hiệu đã có trên Website.
- Khung ưu đãi chứa dải chương trình ngang, ngày bắt đầu/kết thúc và đếm ngược
  theo Asia/Ho_Chi_Minh (UTC+07). NgayKetThuc bao gồm trọn ngày, giống Web.
  Đồng bộ lại danh sách khi đi qua mốc bắt đầu/kết thúc, khi trở lại ứng dụng
  và khi kéo tải lại. Thẻ sản phẩm cùng chiều cao, có chọn đơn vị bán.
- PhanLoai=true là sản phẩm cần tư vấn: ẩn giá ở thẻ và chi tiết, dùng nút
  Nhắn tin; không nhầm với trường KeDon. Kênh nhắn tin vẫn chờ triển khai.
- Chọn mua lưu vào giỏ hàng Backend khi có hàng và đủ điều kiện ưu đãi. Huy hiệu
  đếm MaThuoc riêng biệt, không cộng SoLuong hoặc đếm trùng cùng thuốc khác đơn vị.
  Trang giỏ đọc lại dữ liệu đã lưu, có tải lại và báo lỗi. Chưa có thanh toán,
  chỉnh số lượng hoặc xóa giỏ trong phần Mobile này.
- Nút tư vấn nhô lên giữa thanh dưới, luân phiên icon nhắn tin/hỗ trợ/AI.
  Tên truy cập luôn là Tư vấn; ngừng đổi icon khi bật giảm chuyển động.

| Phương thức | Endpoint | Request | Response |
|---|---|---|---|
| GET | /api/mobile/cart | Bearer access token, không query | CART_LISTED, authenticated=true, items theo contract cart_service hiện có |
| POST | /api/mobile/cart/items | Bearer access token; JSON MaThuoc, MaDonGia | CART_ITEM_ADDED |

Chỉ role khách hàng 0, đối chiếu trạng thái tài khoản và phiên JWT trên Backend.
Không nhận owner từ client, không dùng session/cookie Web hay CSRF token Web.
Adapter gọi cart_service.add_database(..., check_stock=True) để giữ nguyên kiểm tra
đơn vị, tồn kho và quyền mua sản phẩm cần tư vấn. get_cart có tham số nội bộ
owner_id để phục vụ chủ giỏ đã xác thực JWT; lời gọi Web cũ không truyền tham số
vẫn dùng owner() như trước. Không thay endpoint Web, schema hoặc migration.
Nguồn: routes/mobile_cart_routes.py, services/cart_service.py,
services/mobile_auth_service.py, services/consultation_service.py.

Lỗi giữ nguyên mã UNAUTHENTICATED/TOKEN_EXPIRED/FORBIDDEN/ACCOUNT_LOCKED,
INVALID_REQUEST, OUT_OF_STOCK, UNIT_NOT_FOUND, UNIT_UNAVAILABLE,
CONSULTATION_REQUIRED, DATABASE_UNAVAILABLE. CORS chỉ cho các origin cấu hình.
Mobile refresh token một lần khi nhận TOKEN_EXPIRED trước khi xử lý yêu cầu;
refresh đồng thời dùng chung một Future. Không tự retry POST khi lỗi mạng/server.
Sau khi POST thành công, lỗi đọc lại giỏ không được coi là chưa thêm: giữ thông báo
đã thêm và cho tải lại giỏ, tránh hướng dẫn người dùng thêm trùng.

Kiểm thử bổ sung dùng fixture/repositories/Redis cô lập, không thêm sản phẩm vào
giỏ tài khoản thật để thử. Chưa kiểm thử thao tác trên Android/iOS hoặc Chrome thật.
