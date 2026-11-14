# Module 02.5 — Cloudinary cho ảnh thuốc

Backend dùng Cloudinary Python SDK chính thức để upload có chữ ký server và
Pillow để kiểm tra nội dung ảnh. Không dùng unsigned preset, không tạo endpoint
xóa ảnh và không thay đổi schema. Thuoc.HinhAnh tiếp tục chỉ lưu URL HTTPS;
public_id chỉ có trong response upload, không lưu thêm cột hoặc bảng.

## Cài đặt và chạy Windows PowerShell

Từ thư mục gốc dự án:

```powershell
cd D:\MaNguonMo\LanYenPharmacy
.\backend\.venv\Scripts\python.exe -m pip install -r backend/requirements.txt
```

Đã thêm cloudinary và Pillow vào requirements hiện có. Phiên bản cài và kiểm thử
trong lần triển khai này: cloudinary 1.47.0, Pillow 13.0.0. Không có thay đổi
dependencies Frontend. Dùng virtualenv đã thiết lập ở các module trước.

Nhập ba giá trị thật phía server bằng biến môi trường hoặc tự bổ sung vào
backend/.env hiện có:

```text
CLOUDINARY_CLOUD_NAME=<cloud name của dự án>
CLOUDINARY_API_KEY=<API key của dự án>
CLOUDINARY_API_SECRET=<API secret của dự án>
```

Không sao chép .env.example đè lên .env đang dùng, không đưa secret vào source,
Postman request body hoặc Frontend. Tên biến với placeholder đã có trong
backend/.env.example. Đã kiểm tra backend/.env được gitignore và không được Git
theo dõi; không đọc/ghi nội dung file này trong tác vụ.

Giữ cấu hình DATABASE_URL, SECRET_KEY, Redis và auth Module 01 hiện có. Ví dụ chạy
local development khi Redis đã sẵn sàng:

```powershell
$env:APP_ENV = 'development'
$env:OTP_DEV_ENABLED = 'true'
$env:SESSION_COOKIE_SECURE = 'false'
.\backend\.venv\Scripts\python.exe backend/run.py
```

Server bind 127.0.0.1:5000. Chỉ bật OTP giả lập ở development; dùng HTTPS và cookie
Secure trong môi trường triển khai theo Module 01. Không tự khởi tạo database
hoặc chạy migration. Nếu thiếu cấu hình Cloudinary, ứng dụng vẫn khởi động và
các module cũ vẫn hoạt động; upload/liên kết URL Cloudinary mới trả 503.

## API upload

```text
POST /api/manager/uploads/products
Content-Type: multipart/form-data; boundary=<do client tạo>
X-CSRF-Token: <token hiện tại>
Cookie: lanyen_session=<cookie đăng nhập>
```

Body chỉ có đúng một file field image. Không nhận text fields hoặc query params,
không nhận folder, public_id, overwrite, unsigned hoặc URL từ client.

- Chỉ VaiTro=2; tái sử dụng kiểm tra session, trạng thái tài khoản và CSRF/Origin.
- Chỉ JPEG/image/jpeg, PNG/image/png, WebP/image/webp. Nội dung phải giải mã được
  bằng Pillow và khớp MIME; không tin tên/mở rộng file client. SVG/GIF/BMP bị từ chối.
- File không rỗng, tối đa 5 MiB (5 × 1024 × 1024 bytes). Chặn body trên 5 MiB +
  64 KiB multipart overhead và giới hạn multipart fields; kiểm tra riêng kích
  thước file sau đó. Giới hạn này chỉ áp dụng upload route, không đổi JSON APIs.
- Kiểm tra verify() và load(); chặn ảnh hỏng/decompression bomb theo Pillow.
- Server sinh public_id bằng UUID ngẫu nhiên, folder cố định
  lan-yen-pharmacy/products. overwrite=false, use_filename=false,
  unique_filename=false với UUID đã có; resource_type=image, type=upload.
- SDK dùng credentials của Flask app theo từng lời gọi, API endpoint HTTPS,
  timeout 20 giây. Không cấu hình global SDK bằng secret hoặc log exception text.
- Upload không ghi PostgreSQL. Response chỉ lấy URL/public_id đã kiểm tra từ
  response Cloudinary; không trả nguyên response provider hoặc API credentials.

```json
{
  "code": "UPLOAD_SUCCESS",
  "data": {
    "url": "https://res.cloudinary.com/<cloud>/image/upload/v123/lan-yen-pharmacy/products/<uuid>.png",
    "public_id": "lan-yen-pharmacy/products/<uuid>"
  }
}
```

## Tích hợp CRUD thuốc và xác minh ảnh

POST/PUT /api/manager/products dùng HinhAnh như Module 02.2. Không gửi public_id
trong JSON thuốc; schema tiếp tục từ chối trường ngoài định nghĩa.

Khi tạo thuốc hoặc thay URL ảnh:

1. Schema hiện có kiểm tra URL HTTPS.
2. Với hostname Cloudinary chuẩn hoặc subdomain cloudinary.com, yêu cầu URL gốc
   chuẩn `https://res.cloudinary.com/<configured-cloud>/image/upload/v<version>/lan-yen-pharmacy/products/<safe-name>.(jpg|png|webp)`.
3. Từ chối cloud/folder khác, transformation path, query/fragment, chữ ký trong
   path, path escape và alias host. Không lấy public_id tùy ý từ request.
4. Dùng Admin API resource với credentials server để xác minh tài nguyên tồn tại,
   public_id đúng, resource_type=image, type=upload, định dạng được hỗ trợ và
   secure_url trùng chính xác URL đề nghị. Không fetch URL do client cung cấp.
5. Chỉ ghi HinhAnh và commit sau khi xác minh thành công. Nếu Cloudinary/API lookup
   không hoạt động thì dừng cập nhật; lỗi database rollback như Module 02.2.

Điều này xác minh URL liên kết là tài nguyên hiện có trong cloud/folder dự án,
không chỉ kiểm tra tiền tố. Admin API có quota của tài khoản; mỗi liên kết ảnh
Cloudinary mới cần một lần lookup, không tạo thêm cache/database.

URL HTTPS ngoài Cloudinary vẫn được hỗ trợ theo hợp đồng Module 02.2. Không kiểm
tra sở hữu hoặc truy cập nội dung của các URL ngoài này. Cloudinary qua custom
delivery domain không thể được nhận diện chắc chắn chỉ từ URL và không được
chứng nhận sở hữu theo cơ chế trên. Chỉ dùng URL gốc server trả về cho ảnh mới.

Khi PUT giữ nguyên HinhAnh đang có trong DB, không yêu cầu lookup lại: giữ tương
thích dữ liệu cũ kể cả URL Cloudinary thuộc cloud/folder cũ. Không sửa, xóa hoặc
backfill các bản ghi cũ. GET thuốc không gọi Cloudinary.

## Ảnh cũ, ảnh chưa liên kết và xóa

Upload và tạo/cập nhật thuốc là hai request riêng. Upload thành công mới dùng
URL trả về cho request thuốc. Không có transaction chung giữa provider và DB.
Nếu upload thành công nhưng người dùng bỏ thao tác, tạo thuốc thất bại, DB commit
thất bại hoặc provider trả lỗi sau khi có thể đã nhận ảnh, có thể còn ảnh mồ côi.

Không tự xóa ảnh cũ khi thay URL, không tự xóa ảnh khi xóa thuốc, không xóa ảnh
vừa upload khi DB thất bại. Lý do: không có bằng chứng đầy đủ về mọi tham chiếu
hoặc việc dùng chung ảnh. Giữ ảnh cũ là lựa chọn an toàn theo yêu cầu module.
Không có endpoint nhận public_id để xóa, không dùng destroy hoặc xóa hàng loạt.
Việc dọn ảnh sau này cần kiểm tra sở hữu/tham chiếu và phê duyệt riêng; chưa triển
khai tác vụ tự động dọn ảnh hoặc quản lý avatar/bài viết/banner.

## Lỗi

| HTTP | code | Ý nghĩa |
| --- | --- | --- |
| 400 | IMAGE_REQUIRED / EMPTY_IMAGE / INVALID_IMAGE / IMAGE_MIME_MISMATCH | Thiếu, rỗng, ảnh hỏng hoặc MIME giả |
| 400 | INVALID_REQUEST | Request multipart/fields/query không hợp lệ |
| 400 | INVALID_CLOUDINARY_URL / CLOUDINARY_IMAGE_NOT_FOUND | URL hoặc tài nguyên không được xác minh |
| 401 | UNAUTHENTICATED | Chưa có session hợp lệ |
| 403 | FORBIDDEN / ACCOUNT_LOCKED / CSRF_FAILED | Sai vai trò, khóa hoặc CSRF/Origin |
| 413 | IMAGE_TOO_LARGE | File hoặc body vượt giới hạn |
| 415 | UNSUPPORTED_IMAGE_FORMAT | MIME/định dạng không hỗ trợ |
| 502 | CLOUDINARY_INVALID_RESPONSE | Provider trả dữ liệu không hợp lệ |
| 503 | CLOUDINARY_NOT_CONFIGURED / CLOUDINARY_UNAVAILABLE | Thiếu cấu hình hoặc lỗi dịch vụ |
| 500 | UPLOAD_FAILED | Lỗi upload nội bộ, đã che thông tin chi tiết |

Lỗi database trong CRUD thuốc vẫn trả mã Module 02.2. Không đưa traceback, SQL
hoặc secret vào response; upload handler chỉ log thông điệp cố định cho lỗi lạ.

## Postman: kiểm thử upload thật

Các bước dưới đây là thao tác thật và dùng tài nguyên tài khoản Cloudinary; chưa
được tự chạy trong quá trình triển khai. Chỉ ghi thuốc trong database thử nghiệm
được phép dùng; upload không tự ghi DB.

1. Đặt cấu hình server như trên và khởi động lại Flask sau khi thay biến môi trường.
   Không cần tạo unsigned preset công khai. Cloudinary Free không đòi module này
   bật add-on trả phí; tuân theo quota hiện tại của tài khoản.
2. Trong Postman đặt base_url=http://localhost:5000 ở development; dùng một
   hostname cố định và bật cookie jar. Nếu cookie Secure bật thì dùng HTTPS.
3. GET {{base_url}}/api/auth/me, lấy csrf_token kể cả khi 401 và giữ cookie
   lanyen_session. Đăng nhập số điện thoại của quản lý hiện có qua otp/request,
   otp/verify như Module 01. POST auth cần X-CSRF-Token. Lưu token mới từ response
   đăng nhập vì token xoay vòng. Có thể dùng Post-response script ở /me và /verify:

   ```javascript
   const body = pm.response.json();
   if (body.csrf_token) pm.environment.set('csrf_token', body.csrf_token);
   ```

4. Tạo POST {{base_url}}/api/manager/uploads/products. Thêm header
   X-CSRF-Token: {{csrf_token}}. Body → form-data → key image, chọn loại File,
   chọn JPEG/PNG/WebP tối đa 5 MiB. Không tự đặt Content-Type/boundary; để Postman
   tạo. Không thêm folder/public_id/overwrite hoặc text field khác.
5. Mong đợi 200 UPLOAD_SUCCESS. Kiểm tra data.url HTTPS đúng cloud/folder;
   data.public_id thực tế. Có thể lưu URL bằng Post-response script:

   ```javascript
   const body = pm.response.json();
   if (body.code === 'UPLOAD_SUCCESS') pm.environment.set('product_image_url', body.data.url);
   ```

6. POST tạo thuốc hoặc PUT sửa thuốc theo payload đầy đủ Module 02.2, đặt
   HinhAnh="{{product_image_url}}", Content-Type application/json và X-CSRF-Token.
   Mong đợi 201/200 sau lookup Cloudinary. GET lại kiểm tra HinhAnh.
7. Thử URL thuộc cloud/folder khác, URL không tồn tại hoặc thêm transformation:
   mong đợi 400. Giữ nguyên URL cũ khi sửa trường khác vẫn hoạt động. Không gửi
   public_id trong JSON thuốc.
8. Thử file rỗng/không phải ảnh/GIF/SVG, file >5 MiB, bỏ cookie, dùng vai trò
   khách/nhân viên hoặc bỏ/sai CSRF. Đối chiếu bảng mã lỗi; không tạo thao tác xóa ảnh.
9. Khi thay URL hoặc xóa thuốc, kiểm tra ảnh cũ còn trên Cloudinary. Đừng giả lập
   lỗi database bằng thay đổi schema/dữ liệu thật; tình huống đó có unit tests mock.

## Kiểm thử tự động và tệp thay đổi

```powershell
$env:PYTHONPATH = 'backend'
.\backend\.venv\Scripts\python.exe -m unittest discover -s backend/tests -p test_uploads.py -v
.\backend\.venv\Scripts\python.exe -m unittest discover -s backend/tests -p test_*.py
```

Tests tạo ảnh thật trong bộ nhớ bằng Pillow, mock uploader.upload và api.resource,
chặn HTTP connector của Cloudinary và Engine.connect. Không dùng credentials
thật, không tiêu credits và không ghi PostgreSQL. Có kiểm thử MIME/giải mã, giới
hạn chính xác 5 MiB, phân quyền/CSRF, thiếu cấu hình, provider errors, kiểm tra
sở hữu URL và không xóa ảnh khi DB lỗi/xóa thuốc. Chưa upload thật hoặc kiểm thử
Postman/integration Cloudinary + PostgreSQL; chưa chứng minh quota tài khoản.

Kết quả thực thi cuối: 29/29 bài Module 02.5 đạt; hồi quy toàn bộ Backend đạt
174/174. Imports và khởi tạo Flask được kiểm chứng qua tests. git diff --check
không phát hiện lỗi whitespace. Các giới hạn kiểm thử dịch vụ thật ở trên vẫn áp dụng.

Sửa:

- backend/requirements.txt; backend/.env.example.
- backend/app/config/config.py; backend/app/__init__.py.
- backend/app/services/product_service.py.

Tạo:

- backend/app/routes/upload_routes.py.
- backend/app/controllers/upload_controller.py.
- backend/app/services/cloudinary_service.py.
- backend/app/utils/image_validator.py.
- backend/tests/test_uploads.py.
- docs/MODULE_02_5_CLOUDINARY.md.

Không sửa model, migration, 15 bảng PostgreSQL, Frontend hoặc backend/.env.
Không triển khai chức năng ảnh ngoài thuốc.

Tham khảo SDK/API chính thức:
[Python upload](https://cloudinary.com/documentation/django_image_and_video_upload),
[Upload API](https://cloudinary.com/documentation/image_upload_api_reference),
[Admin resource API](https://cloudinary.com/documentation/admin_api#get_details_of_a_single_resource),
[Pillow Image verify/load](https://pillow.readthedocs.io/en/stable/reference/Image.html).
