# SePay Gateway — Một database, hai cấu hình thanh toán

## Kết quả rà soát trước nâng cấp

Luồng mới dùng Gateway: `POST /api/orders/<id>/payment` tạo form đã ký, Frontend submit form sang Checkout. Backend vẫn giữ `POST /api/payments/sepay/webhook` và dữ liệu VietQR cũ để tương thích. Frontend Gateway không sử dụng ảnh VietQR.

Trước nâng cấp, service và Frontend khóa cứng host Sandbox, Merchant ID thử nghiệm, mã hóa đơn `LYSGTEST`. Chưa có cấu hình Production riêng hoặc cách ly đơn theo môi trường trong CSDL.

Yêu cầu mới nhất thay thế phương án hai database: **chỉ dùng DATABASE_URL hiện tại**, chung các bảng. Không tạo database khác hoặc di chuyển/xóa dữ liệu. Người dùng đã duyệt thêm cột nullable `DonHang.MoiTruongThanhToan` để lưu môi trường của từng đơn.

Migration `31ac74d9e206` thêm `MoiTruongThanhToan VARCHAR(10) NULL`, không default/backfill. Đơn Gateway mới ghi `sandbox` hoặc `production` ở Backend; COD và đơn cũ giữ NULL. Không tự phân loại đơn cũ. Production vẫn cần `SEPAY_PRODUCTION_ENABLED=true` do chủ dự án chủ động cấu hình.

## Các biến cấu hình

Giữ mặc định:

```dotenv
SEPAY_ENV=sandbox
SEPAY_PRODUCTION_ENABLED=false
```

Mỗi nhóm dùng đủ bộ riêng:

| Sandbox | Production |
| --- | --- |
| SEPAY_SANDBOX_MERCHANT_ID | SEPAY_PRODUCTION_MERCHANT_ID |
| SEPAY_SANDBOX_SECRET_KEY | SEPAY_PRODUCTION_SECRET_KEY |
| SEPAY_SANDBOX_IPN_SECRET_KEY | SEPAY_PRODUCTION_IPN_SECRET_KEY |
| SEPAY_SANDBOX_CHECKOUT_URL | SEPAY_PRODUCTION_CHECKOUT_URL |
| SEPAY_SANDBOX_API_BASE_URL | SEPAY_PRODUCTION_API_BASE_URL |

Giá trị URL:

| Môi trường | Checkout | REST API |
| --- | --- | --- |
| sandbox | https://pay-sandbox.sepay.vn/v1/checkout/init | https://pgapi-sandbox.sepay.vn |
| production | https://pay.sepay.vn/v1/checkout/init | https://pgapi.sepay.vn |

REST API URL được cấu hình/kiểm tra để tránh trộn môi trường; luồng Checkout hiện không gọi REST API hoặc tự đối soát khi IPN bị mất.

`SQLALCHEMY_DATABASE_URI` luôn lấy từ `DATABASE_URL`, độc lập với `SEPAY_ENV`. Các biến `SEPAY_SANDBOX_DATABASE_URL` và `SEPAY_PRODUCTION_DATABASE_URL` đã bị bỏ khỏi code và `.env.example`; nếu còn trong `.env` riêng thì chúng bị bỏ qua. Không sửa giá trị hoặc in thông tin xác thực của `DATABASE_URL`.

Nhóm Gateway cũ `SEPAY_MERCHANT_ID`, `SEPAY_SECRET_KEY`, `SEPAY_IPN_SECRET_KEY`, `SEPAY_CHECKOUT_URL`, `SEPAY_API_BASE_URL` vẫn được giữ. Nhóm này chỉ được fallback cho Sandbox khi cả ba credential Sandbox mới đều rỗng. Không lấy một phần từ nhóm mới rồi ghép khóa còn thiếu từ nhóm cũ. Production tuyệt đối không fallback sang nhóm cũ/Sandbox.

Không dùng lại Merchant ID, Secret Key hoặc IPN Secret Key giữa hai môi trường. Backend kiểm tra định dạng Merchant Sandbox, từ chối Merchant thử nghiệm trên Production, kiểm tra URL chính xác, chặn khóa trùng nếu hai bộ đã được cấu hình. Chỉ SePay mới xác minh được một cặp Merchant/Secret thực sự thuộc tài khoản nào khi nhận form; kiểm tra local không thay thế được bước đó.

Callback Sandbox giữ các biến `SEPAY_SUCCESS_URL`, `SEPAY_ERROR_URL`, `SEPAY_CANCEL_URL` hiện có. Callback Production dùng các biến riêng `SEPAY_PRODUCTION_SUCCESS_URL`, `SEPAY_PRODUCTION_ERROR_URL`, `SEPAY_PRODUCTION_CANCEL_URL`. Chúng là tùy chọn; không xác nhận thanh toán từ callback.

## Cách ly IPN

Khi khách bấm Hoàn tất, Backend trừ kho cho **cả COD và QR** trong cùng transaction với tạo đơn/chi tiết và xóa dòng giỏ đã mua. COD bắt đầu ở trạng thái đơn 1; QR bắt đầu ở 0, IPN hợp lệ chuyển lên 1 nhưng không trừ kho thêm. Các lần mở Checkout hoặc IPN lặp cũng không trừ thêm.

Số lượng đặt được nhân với SoLuongQuyDoi và gộp theo thuốc. Backend khóa đơn vị và các lô còn hạn, kiểm tra lại số lượng rồi trừ FIFO theo MaLo tăng dần (thứ tự nhập trong schema hiện tại; NgaySanXuat không được dùng làm ngày nhập). Thiếu kho trả OUT_OF_STOCK, rollback toàn bộ đơn/giỏ/tồn. Không thêm bảng hoặc migration cho thay đổi này.

Không có phiên giữ hàng 10 phút, không tự hoàn kho cho QR chưa thanh toán hoặc lỗi mở Checkout. Thay đổi áp dụng cho đơn tạo mới; không tự trừ bù tồn kho của các đơn cũ.

- `SEPAY_ENV` chỉ chọn cấu hình thanh toán. Không đổi database. Đổi `.env` rồi khởi động lại Flask; không tự sửa biến trong process đang chạy.
- Cấu hình IPN của merchant tương ứng tới URL backend đúng môi trường: `POST https://<backend-cua-moi-truong>/api/payments/sepay/ipn`.
- Auth Type `SECRET_KEY`, JSON. Header `X-Secret-Key` khớp khóa IPN của đúng nhóm. Khóa này độc lập với Secret Key dùng ký form.
- Sandbox dùng mã hóa đơn `LYSGTEST<MaDonHang>`, Production dùng `LYSGLIVE<MaDonHang>`. IPN sai tiền tố bị từ chối trước khi tìm đơn.
- Checkout đối chiếu môi trường đang chọn với `MoiTruongThanhToan` đã lưu. Không thể mở một đơn Sandbox trên Production hoặc ngược lại. Đơn cũ NULL trả `ORDER_PAYMENT_ENVIRONMENT_UNKNOWN`; không tự nhận môi trường từ `.env`.
- IPN lấy môi trường từ mã tham chiếu để chọn khóa xác thực, rồi bắt buộc khớp cột môi trường của đơn trong database. Không coi tiền tố là bằng chứng đủ để xác nhận thanh toán. Sai môi trường trả `ORDER_PAYMENT_ENVIRONMENT_MISMATCH`.
- IPN của cả hai môi trường có thể tới cùng endpoint. Việc đổi `SEPAY_ENV` hoặc tắt nhận thanh toán Production mới không làm mất khả năng xác nhận IPN hợp lệ cho đơn Production đã được gắn môi trường trước đó. Khóa của từng môi trường phải còn được cấu hình.
- Chỉ `ORDER_PAID`, `CAPTURED`, `APPROVED`, `PAYMENT`, `BANK_TRANSFER`, đúng VND và đúng toàn bộ số tiền mới cập nhật hai trạng thái từ 0 sang 1. Giữ kiểm tra khách hàng nếu IPN cung cấp `customer_id`.
- Khóa dòng và cờ thanh toán ngăn xử lý lặp. Không reset trạng thái giao hàng khi nhận lại IPN. Không bổ sung sổ nhiều giao dịch hoặc hoàn tiền.
- Giữ webhook ngân hàng cũ cho đơn cũ NULL. Webhook cũ không được cập nhật đơn đã gắn môi trường Gateway; Frontend Gateway không sử dụng ảnh VietQR cũ.

## Cột môi trường đã được duyệt

`MoiTruongThanhToan` là cột nullable đã được duyệt và triển khai, nhận `sandbox` hoặc `production` theo validation của service. Không thêm bảng, index hoặc constraint ngoài thay đổi một cột này.

- Gắn môi trường khi tạo đơn Gateway và không thay đổi khi `SEPAY_ENV` đổi. COD để null và giữ nghiệp vụ cũ.
- Khi khởi tạo Checkout/IPN, đối chiếu môi trường đã lưu, khóa của môi trường đó, mã tham chiếu, tiền/tệ, chủ đơn và trạng thái. Không cho mở một đơn ở môi trường khác. Client không được gửi đè môi trường khi tạo đơn.
- Mã tham chiếu vẫn suy ra từ môi trường đã lưu và `MaDonHang`; không cần cột tham chiếu riêng cho phạm vi một yêu cầu thanh toán trên mỗi đơn.
- Đơn cũ để null, không tự gán hàng loạt. Cần đối chiếu và thống nhất cách phân loại trước khi cho thanh toán/xác nhận lại.
- Migration chỉ ADD COLUMN, không UPDATE hoặc backfill. Nếu cần nhiều lần thanh toán/lịch sử giao dịch thì phải thiết kế riêng và xin duyệt, không nhét vào `GhiChu` hoặc cờ trạng thái hiện có.

## Chuyển cấu hình thanh toán

1. Giữ `SEPAY_ENV=sandbox`, `SEPAY_PRODUCTION_ENABLED=false` trong suốt kiểm thử. Dùng hướng dẫn [kiểm thử Sandbox](SEPAY_SANDBOX_TESTING.md).
2. Điền đủ nhóm Production và giữ nhóm Sandbox, không thay `DATABASE_URL`. Không thực hiện giao dịch thật trong kiểm thử.
3. Sau khi kiểm thử, chủ dự án có thể chọn `SEPAY_ENV=production`, `SEPAY_PRODUCTION_ENABLED=true` và restart Flask. Backend chọn nhóm Production nhưng giữ nguyên database. Code không tự bật các cờ hoặc thực hiện giao dịch thật.
4. Tạo đơn QR mới để có môi trường được lưu. Các đơn cũ NULL cần được đối chiếu và phân loại theo quyết định riêng, không tự sửa hàng loạt để vượt qua chặn thanh toán.
5. Dữ liệu thử vẫn nằm cùng database và các báo cáo hiện có chưa được bổ sung bộ lọc môi trường. Cần đánh giá lọc báo cáo/doanh thu trước khi sử dụng dữ liệu thử lẫn dữ liệu thật cho vận hành chính thức.

## Kiểm thử và giới hạn

- `test_orders.py`: tạo đơn và lưu môi trường, NULL cho COD, cấu hình thiếu/trộn khóa, URI không đổi khi đổi `SEPAY_ENV`, IPN Sandbox/Production hợp lệ/lặp/sai môi trường, đơn cũ NULL, IPN đến muộn sau khi đổi môi trường, khóa Production mới, log an toàn và cấu trúc migration. Chặn kết nối CSDL thật.
- `test_checkout_frontend.mjs`: chỉ cho host/tiền tố/merchant khớp môi trường; giữ thứ tự input, đúng mã đơn/số tiền, chặn phản hồi trộn môi trường.
- `browser_manager.mjs --checkout`: API giả lập cho Sandbox và Production, chặn `form.submit` trong fixture để không gửi sang host SePay thật; kiểm tra COD, lỗi/thử lại, trạng thái/redirect và mobile.
- Chưa thực hiện giao dịch Production hoặc tạo database khác. Migration một cột đã được áp dụng vào `lan_yen_pharmacy`; xác minh dữ liệu cũ của DonHang và ChiTietDonHang không đổi, tất cả đơn cũ vẫn NULL. Công cụ kiểm tra có chủ đích: `python -m tests.check_payment_environment_migration` (chỉ đọc); tùy chọn `--apply` chỉ chấp nhận revision trước migration và database dự án đã xác định.

Nguồn chính thức: [Sandbox và host môi trường](https://developer.sepay.vn/vi/cong-thanh-toan/sandbox), [Form và chữ ký](https://developer.sepay.vn/vi/cong-thanh-toan/API/don-hang/form-thanh-toan), [IPN](https://developer.sepay.vn/vi/cong-thanh-toan/IPN).
