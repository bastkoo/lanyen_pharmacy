# Deploy Frontend lên Render Static Site

## Cấu hình Static Site

- Repository: repository hiện tại, chọn branch cần deploy.
- Root Directory: `frontend`.
- Build Command: `echo "Static frontend; no build required"`.
- Publish Directory: `.` (tương đối với Root Directory).
- Không cần cài Node, npm, framework hay tạo bundle.
- Không thêm SPA rewrite `/* -> /index.html`: đây là website nhiều trang HTML thật.
- Chỉ publish `frontend/`, tuyệt đối không publish root repository, `backend/` hoặc `.env`.

`index.html` đã chuyển tới `pages/customer/home.html`. Các trang con, CSS, JS module,
font, ảnh và icon dùng đường dẫn tương đối. Manager và employee dùng hash để chọn view.

API được cấu hình duy nhất tại `frontend/js/config/app.js`:

| Hostname Frontend | API Base URL (đã gồm `/api`) |
| --- | --- |
| `localhost`, `127.0.0.1` | `http://127.0.0.1:5000/api` |
| Các hostname deploy | `https://lanyenpharmacy-api.onrender.com/api` |

Các module request nối đường dẫn tài nguyên như `/auth/me`, `/cart`, `/manager/products`;
không nối thêm `/api`. API địa giới `https://provinces.open-api.vn/api/v2` là dịch vụ
bên ngoài, giữ nguyên và không gửi session cookie của nhà thuốc.
Biến môi trường trong Render Static Site không tự trở thành biến JavaScript runtime;
Frontend này dùng cấu hình công khai trong file trên, không cần biến bí mật.

## Cấu hình Backend Render sau khi có URL Static Site

Thay `https://YOUR_STATIC_SITE.onrender.com` bằng origin HTTPS thực tế, không có path
hoặc dấu `/` ở cuối. Các giá trị dưới đây đặt trong **Environment của Backend Web Service**:

```dotenv
AUTH_ALLOWED_ORIGINS=https://YOUR_STATIC_SITE.onrender.com
SESSION_COOKIE_SECURE=true
SESSION_COOKIE_SAMESITE=None
SEPAY_FRONTEND_ORIGIN=https://YOUR_STATIC_SITE.onrender.com
SEPAY_ENV=sandbox
SEPAY_PRODUCTION_ENABLED=false
SEPAY_SANDBOX_CHECKOUT_URL=https://pay-sandbox.sepay.vn/v1/checkout/init
SEPAY_SANDBOX_API_BASE_URL=https://pgapi-sandbox.sepay.vn
SEPAY_SUCCESS_URL=https://lanyenpharmacy-api.onrender.com/api/payments/sepay/return
SEPAY_ERROR_URL=https://lanyenpharmacy-api.onrender.com/api/payments/sepay/return
SEPAY_CANCEL_URL=https://lanyenpharmacy-api.onrender.com/api/payments/sepay/return
```

Giữ merchant và secret Sandbox trong Backend. Không đưa `SECRET_KEY`, thông tin DB,
Redis, Cloudinary API secret hoặc SePay secret vào Frontend. Không đổi `SECRET_KEY`
chỉ để deploy Frontend vì sẽ làm mất hiệu lực session đang có.

Nếu cần nhiều frontend origin, khai báo danh sách ngăn bằng dấu phẩy trong
`AUTH_ALLOWED_ORIGINS`; không dùng `*`. CORS hiện có hỗ trợ credentials,
`Content-Type` và `X-CSRF-Token`. Cookie vẫn `HttpOnly`, host-only và được Backend ký.
Frontend lấy CSRF từ JSON, lưu trong bộ nhớ và gửi header cho request ghi dữ liệu;
không đọc cookie bằng JavaScript, không chuyển session sang localStorage.

Hai dịch vụ trên các hostname Render khác nhau có thể là cross-site. Cần
`SameSite=None; Secure` để trình duyệt gửi cookie qua fetch cross-site.
Trình duyệt chặn third-party cookie vẫn có thể chặn session; khi gặp trường hợp đó,
dùng custom domain cùng site cho Frontend và API, rồi kiểm tra lại cookie/CORS.
Không bỏ CSRF hoặc phân quyền để khắc phục lỗi cookie.

Sau khi sửa biến môi trường, redeploy Backend để áp dụng cấu hình mới.

## Chạy local

Serve thư mục `frontend/` qua HTTP, ví dụ Live Server ở cổng 5500. Để session hoạt động
với API cố định `127.0.0.1`, mở **http://127.0.0.1:5500**:

```dotenv
AUTH_ALLOWED_ORIGINS=http://127.0.0.1:5500,http://localhost:5500
SESSION_COOKIE_SECURE=false
SESSION_COOKIE_SAMESITE=Lax
```

Đổi cổng trong allowlist nếu dùng cổng khác. `http://localhost:5500` vẫn chọn đúng API
`http://127.0.0.1:5000`, nhưng hai hostname khác site nên cookie `Lax` có thể không
được gửi; mở URL `127.0.0.1` để kiểm thử đăng nhập/giỏ hàng. Không dùng `file://`.

## Kiểm thử sau deploy

1. Mở `/`, trang sản phẩm, trang manager/employee bằng URL trực tiếp; kiểm tra JS/CSS/font/icon không 404.
2. Network: API đi tới `https://lanyenpharmacy-api.onrender.com/api/...`, không có `:5000` hoặc `/api/api`.
3. `/api/auth/me` khi chưa đăng nhập trả 401 kèm CSRF; cookie có `Secure`, `HttpOnly`, `SameSite=None`.
4. OPTIONS cho request ghi trả origin chính xác, credentials và cho phép `X-CSRF-Token`.
5. Đăng nhập bằng phương thức OTP đang được Backend hỗ trợ, tải lại trang, mở trang cá nhân rồi đăng xuất.
   Không bật OTP development trên production chỉ để thử giao diện.
6. Thử giỏ khách, giỏ sau đăng nhập, request hợp lệ và request thiếu/sai CSRF; sai CSRF phải bị từ chối.
7. Tài khoản sai vai trò không truy cập được API manager/employee; lỗi 401/403 vẫn được xử lý.
8. Tạo đơn kiểm thử Sandbox, kiểm tra `payment.environment=sandbox`, form đi tới
   `https://pay-sandbox.sepay.vn/v1/checkout/init`; không thanh toán thật.
9. SePay Sandbox IPN: `POST https://lanyenpharmacy-api.onrender.com/api/payments/sepay/ipn`;
   cấu hình secret ở Backend/SePay. Return về đúng trang đơn hàng hoặc quầy employee.
   Redirect về Frontend không phải bằng chứng thanh toán thành công; trạng thái do Backend/IPN xác minh.

Chưa thể xác nhận đăng nhập, callback và cookie trên origin deploy thực tế trước khi
URL Static Site được đưa vào allowlist Backend và thực hiện các bước trên trong trình duyệt.

## Kết quả rà soát ngày 24/11/2026

- Backend Render `/api/auth/me`: HTTP 401 khi chưa đăng nhập; cookie có `Secure`,
  `HttpOnly`, `SameSite=Lax`. Cần cập nhật biến môi trường và redeploy như trên.
- 29/29 test auth đạt, gồm cookie cross-site, CORS, CSRF đúng/sai và kiểm tra cấu hình cookie.
  Test dùng Redis giả lập, không ghi cơ sở dữ liệu thực.
- 78/79 test Frontend đạt. Test chat có sẵn tại `backend/tests/test_chat_frontend.mjs:63`
  chờ nhãn “Gửi tệp”, nhưng component hiện tại hiển thị “Gửi ảnh”; hai file này không chỉnh sửa.
- Các test mới về hostname local/deploy, URL request thực qua mock fetch, cookie/CSRF,
  lỗi 401/403 và đường dẫn HTML/CSS/JS bên trong publish directory đều đạt.
- 77 file JavaScript đạt kiểm tra cú pháp. Không thay đổi HTML, CSS, schema hoặc migration.
- Chưa chạy đăng nhập/thanh toán Sandbox end-to-end hay kiểm tra responsive bằng trình duyệt
  trên Static Site thực tế; cần URL Frontend và cấu hình Backend tương ứng.
- Không đổi logic thanh toán: Backend vẫn mặc định Sandbox và chặn Production khi
  `SEPAY_PRODUCTION_ENABLED=false`. Chưa xác minh được biến môi trường SePay trên Render;
  cần giữ các giá trị Sandbox trong mục cấu hình trước khi kiểm thử giao dịch.

Tham khảo: [Render Static Sites](https://render.com/docs/static-sites),
[MDN Set-Cookie](https://developer.mozilla.org/en-US/docs/Web/HTTP/Reference/Headers/Set-Cookie).
