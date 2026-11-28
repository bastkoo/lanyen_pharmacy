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
- Chọn mua lưu vào giỏ cục bộ khi chưa đăng nhập, vào Backend khi đã đăng nhập
  và có hàng, đủ điều kiện ưu đãi. Huy hiệu
  đếm MaThuoc riêng biệt, không cộng SoLuong hoặc đếm trùng cùng thuốc khác đơn vị.
  Trang giỏ có chọn sản phẩm, chỉnh số lượng/đơn vị, giảm về 0 để xóa và vuốt trái
  để mở nút xóa đỏ. Thành tiền, tiết kiệm và xu dự kiến cố định dưới cùng.
  Bấm Mua hàng khi chưa đăng nhập mở thẳng biểu mẫu đăng nhập; bước xác nhận đặt
  hàng sau đăng nhập chưa triển khai theo phạm vi hiện hành.
- Nút tư vấn nhô lên giữa thanh dưới, luân phiên icon nhắn tin/hỗ trợ/AI.
  Tên truy cập luôn là Tư vấn; ngừng đổi icon khi bật giảm chuyển động.

| Phương thức | Endpoint | Request | Response |
|---|---|---|---|
| GET | /api/mobile/cart | Bearer access token, không query | CART_LISTED, authenticated=true, items theo contract cart_service hiện có |
| POST | /api/mobile/cart/items | Bearer access token; JSON MaThuoc, MaDonGia | CART_ITEM_ADDED |
| POST | /api/mobile/cart/quote | items: [{MaThuoc, MaDonGia, SoLuong}]; JWT nếu đã đăng nhập | CART_LISTED, total, estimated_points |
| POST | /api/mobile/cart/items/update | JWT; MaDonGia, DonViMoi, SoLuong > 0 | CART_ITEM_UPDATED |
| POST | /api/mobile/cart/items/remove | JWT; MaDonGia | CART_ITEM_REMOVED |

Quote khách chỉ đọc danh mục/giá/stock, bỏ qua cookie Web, không lưu giỏ vào DB.
Quote tài khoản lấy số lượng đã lưu và owner từ JWT, chỉ dùng các mã đơn vị đã
chọn trong request. Tổng tiền/giá từ Backend được parse chính xác bằng BigInt;
số xu dự kiến theo `points_service.earned_points` (1.000đ/1 xu), không có đổi xu.
Nếu thiếu giá hoặc cần tư vấn, không xác nhận thành tiền/xu và khóa Mua hàng.
Ưu đãi có thể chỉ áp dụng một phần số lượng: dùng ThanhTien từ Backend, không
nhân GiaBan đã giảm với toàn bộ SoLuong. Các dòng đang giảm hiển thị Đang ưu đãi,
tên chương trình và % nếu LoaiGiamGia=true; giảm tiền mặt không tự suy ra %.
Giá gốc từng dòng và tổng giá gốc được gạch ngang với chữ nhỏ hơn giá hiện tại.

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

### Tìm kiếm Mobile và danh sách sản phẩm

`GET /api/mobile/catalog/products?search=...` tìm không phân biệt hoa/thường trong
tên, mã thuốc/mã vạch/số đăng ký, tên danh mục, mô tả, quy cách đóng gói, dạng bào
chế, nhà sản xuất và nước sản xuất. Các bộ lọc `category_id`, `ke_don` vẫn kết hợp
với từ khóa; ký tự `%`, `_` được tìm như ký tự thường. Không thay tìm kiếm Web.
Danh sách hiển thị hai sản phẩm mỗi hàng (một khi phóng lớn chữ); tiêu đề theo
danh mục đang chọn. Nút nhà về tab Trang chủ; nút giỏ về tab Giỏ hàng với số thuốc
riêng biệt đã lưu qua JWT, không cộng tổng số lượng hoặc đếm trùng đơn vị.

### Trang chủ công khai và gộp giỏ khách

- Khi mở app, khách vào trang chủ, xem/tìm sản phẩm và thêm giỏ không cần JWT.
  Điểm thưởng, Nhắn tin/Tư vấn, Tài khoản, Đơn của tôi mở hộp thoại đăng nhập dùng
  chung tại `features/auth/login_required_dialog.dart`. Đăng xuất về trang chủ khách.
- `GuestCartStorage` dùng plugin lưu trữ đã có: localStorage trên Flutter Web,
  kho cục bộ trên native, khóa tách theo API base URL. Chỉ giỏ khách được lưu ở đây,
  JWT Web vẫn giữ trong RAM. Lưu mã sản phẩm, đơn vị, lượng và nhãn hiển thị cũ;
  không dùng giá/quyền/tồn kho cục bộ để quyết định giao dịch.
- Sau khi xác thực Customer, đóng băng một batch tối đa 50 mục với `merge_id`,
  `created_at` và owner đã xác thực, rồi gọi `POST /api/mobile/cart/merge` bằng JWT.
  Body: `{merge_id: 32 ký tự hex, created_at: Unix seconds, items: [{MaThuoc,
  MaDonGia, SoLuong}]}`. Không gửi owner trong request. Backend dùng nghiệp vụ giỏ
  hiện có, cộng theo sản phẩm + đơn vị; kiểm tra đơn vị, stock và quyền tư vấn.
- Response `CART_MERGED`: xóa batch cục bộ, đọc lại giỏ database. Lỗi giữ batch
  để tải lại; không chuyển batch đã gắn tài khoản sang tài khoản khác. Giỏ database
  không được sao chép vào giỏ khách khi đăng xuất.
- Redis giữ biên nhận theo owner + merge_id, đối chiếu fingerprint payload. Request
  nhận trong 7 ngày kể từ created_at; biên nhận tồn tại 7 ngày + 1 giờ. Retry đã
  hoàn tất trả thành công và không cộng lại. Trạng thái pending không được phát lại
  lệnh ghi khi chưa rõ commit; báo `CART_MERGE_PENDING` và giữ dữ liệu để đối chiếu.
  Batch hết hạn trả `CART_MERGE_EXPIRED`; lỗi kho biên nhận trả `CART_SYNC_UNAVAILABLE`.
  Không thay schema, không thay endpoint/session/cookie giỏ Web.

### Điểm thưởng và điểm danh hằng ngày (Mobile)

- `GET /api/mobile/rewards?page=1`: Bearer JWT Customer, số dư/lịch sử 20 dòng mỗi
  trang và bảng tuần hiện tại. Response `REWARDS_LISTED`: balance (chuỗi số nguyên),
  items (MaDiemThuong, SoDiem, LoaiGiaoDich, LyDo, ThoiGianTichDiem), page/pages/total,
  week_start/today (YYYY-MM-DD), server_time/next_refresh_at (ISO UTC+07), days gồm
  đúng 7 ngày thứ Hai–Chủ nhật với date/reward/status.
- `POST /api/mobile/rewards/check-in`: JWT Customer, JSON rỗng `{}`; không nhận
  ngày, số xu hay mã tài khoản từ client. Mỗi ngày Thứ 2–Thứ 7 cộng 5 xu, Chủ nhật
  cộng 10 xu. Response `CHECK_IN_RECORDED` hoặc `CHECK_IN_ALREADY_RECORDED` có
  awarded (chuỗi; 0 nếu đã nhận) và date. Hai thiết bị cùng gọi không được cộng trùng.
- Dùng bảng DiemThuong hiện có, LoaiGiaoDich=true, LyDo cố định `Điểm danh hằng ngày`.
  Khóa bản ghi NguoiDung bằng FOR UPDATE, đọc giờ Việt Nam sau khi nhận khóa,
  kiểm tra lý do + người dùng + khoảng ngày [00:00, 00:00 hôm sau), rồi ghi/commit.
  Không thay cột, bảng, index, constraint hay migration. API xu Website giữ nguyên.
- Bảng tuần lấy thứ Hai của ngày Backend, không cần job xóa/reset dữ liệu. Ngày đã
  nhận là claimed (nền xanh + dấu tích), ngày đã qua chưa nhận là missed (nền xám
  + nhãn), hôm nay chưa nhận là today, các ngày sau là upcoming. Lịch sử cũ giữ nguyên.
- Flutter hiển thị số dư → điểm danh → lịch sử. Tải lại khi trở về app, kéo tải lại
  hoặc qua nửa đêm theo chênh lệch server_time/next_refresh_at; không dựa vào đồng
  hồ điện thoại để cấp xu. Sau POST tải lại số dư/lịch sử; nếu mất phản hồi chỉ GET
  để đối chiếu, không tự phát lại POST. Chỉ refresh/retry khi TOKEN_EXPIRED trước xử lý.

## Checkout Mobile JWT và SePay

- Tất cả endpoint nghiệp vụ dưới `/api/mobile/checkout` yêu cầu Bearer JWT Customer;
  chủ giỏ, địa chỉ, đơn và xu lấy từ JWT, không dùng cookie/session của Website.
- `POST /quote`: `{MaDonGia: [id đơn vị đã chọn], DoiDiem: boolean}`. Trả
  `CHECKOUT_QUOTED` với `items`, `original`, `subtotal`, `product_discount`, `balance`,
  `redeemed`, `points_discount`, `total`, `estimated_points`. Tiền/xu là chuỗi số nguyên.
  Giá và lượng thực sự nhận ưu đãi lấy từ định giá hiện có; xu dùng cùng quy tắc Web.
- `GET /addresses`, `POST /addresses`, `POST /addresses/<id>/update`: dùng các trường
  `TinhThanh`, `PhuongXa`, `DiaChiCuThe` và kiểm tra chủ địa chỉ hiện có của Web.
- `POST /orders`: contract OrderCreate hiện có cộng `request_id` UUID; chỉ gửi mã đơn vị
  đã chọn, hình thức nhận, mã địa chỉ, ghi chú, phương thức thanh toán, cờ dùng xu và
  tổng tiền đã xem. Backend khóa tài khoản, tính lại giá/tồn/ưu đãi/xu và ghi cùng
  transaction. Chênh giá trả `QUOTE_CHANGED`; không lấy giá từ thiết bị.
- Khóa yêu cầu và fingerprint lưu trong JSONB `DuLieuHoanTra.mobile_request` hiện có,
  không thêm bảng/cột. Cùng tài khoản + UUID + payload trả đơn cũ; payload khác trả
  `CHECKOUT_REQUEST_CONFLICT`. `GET /requests/<uuid>` phục hồi sau mất phản hồi.
  Thiết bị chỉ lưu UUID theo tài khoản; không tự POST lại khi chưa biết kết quả.
- `GET /orders?page=1` phân trang 10 đơn của chính khách; `GET /orders/<id>` lấy trạng
  thái từ Backend. Các API Website và IPN SePay hiện có giữ nguyên contract.
- `POST /orders/<id>/payment` với `{}` cấp vé ký, hạn 5 phút, cho đơn QR còn được
  thanh toán. Client tạo URL từ API_BASE_URL tin cậy và path cố định trả về; vé ở
  fragment, JWT không xuất hiện trong URL. GET `/payment` đọc/xóa fragment rồi POST
  vé tới `/payment/open`; Backend kiểm tra lại quyền/chủ đơn/trạng thái/môi trường,
  xuất form POST đã ký tới SePay với CSP, no-store và no-referrer.
- `/payment/return` chỉ hướng dẫn quay về app; không xác nhận thanh toán bằng query.
  App dùng url_launcher mở cổng thanh toán, đọc trạng thái mỗi 5 giây khi đang mở
  app và tải lại khi resume; chỉ IPN được xác thực mới ghi nhận thanh toán.
  Flutter Web dùng Link của url_launcher để tạo liên kết trực tiếp mở tab thanh toán,
  tránh phụ thuộc window.open vốn không phát hiện được popup bị trình duyệt chặn.
  Giao diện dùng nhãn Thanh toán QR. Thanh toán thật dùng cấu hình production và IPN
  công khai tương ứng; đơn thuộc môi trường cũ không được chuyển sang thu tiền thật.
- Lưu ý giao hàng giữ nội dung Web: miễn phí trung tâm Huế, dự kiến 2–3 giờ;
  ngoài trung tâm/tỉnh khác 3–4 ngày, phí do người đặt chi trả. Backend hiện không
  tính phí giao ngoài vùng trong tổng tiền hàng; màn hình nêu phí xác nhận riêng.
