# MODULE 03.9 — Tạo đơn và thanh toán SePay

> Checkout hiện đã chuyển sang SePay Gateway Sandbox. Hướng dẫn cấu hình và kiểm thử hiện tại: [SEPAY_SANDBOX_TESTING.md](SEPAY_SANDBOX_TESTING.md). Phần VietQR/webhook ngân hàng bên dưới mô tả luồng cũ, được giữ để tham khảo tương thích đơn đã tạo.

## Phạm vi đã xác nhận

- Lưu `DonHang` và `ChiTietDonHang` từ các dòng giỏ được chọn của tài khoản mua hàng đăng nhập: khách hàng `VaiTro=0`, nhân viên `VaiTro=1`, quản lý `VaiTro=2`. Nhân viên và quản lý mua cho chính tài khoản của mình, dùng cùng luồng COD/QR; không được đọc/thanh toán đơn người khác. Tài khoản bị khóa, chưa đăng nhập hoặc vai trò không hợp lệ vẫn bị từ chối.
- COD: `PhuongThucThanhToan=0`, `TrangThaiDonHang=1`, `TrangThaiThanhToan=0`.
- QR: `PhuongThucThanhToan=1`, trạng thái đơn/thanh toán ban đầu đều bằng 0. Webhook SePay hợp lệ với số tiền đủ sẽ chuyển cả hai trạng thái thành 1.
- Theo yêu cầu mới nhất: trừ kho và hạn mức khuyến mãi ngay khi Hoàn tất cho cả COD và QR, trong cùng transaction tạo đơn. FIFO theo MaLo tăng dần, chỉ lấy lô còn hạn. QR đang chờ thanh toán vẫn đã trừ kho/hạn mức; IPN không trừ lần hai. Không có giữ hàng/hoàn kho 10 phút. Chưa tích/đổi điểm; phí giao hàng vẫn xác nhận riêng theo luồng hiện tại.
- Không sửa schema, model hoặc migration; không tạo đơn thử trên CSDL hiện có.

## Cấu hình local

Điền các biến trong `backend/.env`, rồi khởi động lại Flask:

```dotenv
SEPAY_BANK=VCB
SEPAY_ACCOUNT_NUMBER=SO_TAI_KHOAN_CUA_BAN
SEPAY_ACCOUNT_NAME=TEN_CHU_TAI_KHOAN
SEPAY_WEBHOOK_API_KEY=KHOA_BAO_MAT_WEBHOOK_CUA_BAN
```

`SEPAY_BANK` là mã/ngân hàng SePay hỗ trợ, chẳng hạn VCB. Tài khoản phải là tài khoản nhận tiền đã kết nối SePay. Không đưa khóa vào frontend hoặc commit `.env`.

Ảnh QR chuyển khoản được tạo bằng URL SePay, không cần REST API token. `SEPAY_WEBHOOK_API_KEY` là khóa xác thực cho webhook: cấu hình cùng giá trị ở backend và trang Webhooks của SePay. REST API token trong tài khoản SePay không tự động thay cho cấu hình xác thực webhook.

Trong SePay, tạo webhook:

1. Sự kiện **Có tiền vào**, chọn đúng tài khoản nhận tiền.
2. URL: `https://TEN_MIEN_BACKEND/api/payments/sepay/webhook`.
3. Định dạng **JSON**, xác thực **API Key**, điền cùng khóa với `SEPAY_WEBHOOK_API_KEY`. SePay gửi header `Authorization: Apikey <khóa>`.
4. Nếu dùng bộ lọc mã thanh toán, cấu hình tiền tố `LYDH` để nhận nội dung `LYDH<MaDonHang>`.
5. Có thể bật gửi lại khi server trả lỗi. Backend trả `{"success": true}` khi đã nhận/xử lý được webhook.

SePay cần gọi được URL backend công khai qua HTTPS. `localhost` chỉ dùng để phát triển, không phải URL nhận webhook từ SePay. Việc triển khai/tunnel và cấu hình tài khoản SePay do chủ tài khoản thực hiện.

Tài liệu chính thức: [QR SePay](https://docs.sepay.vn/tao-qr-code-vietqr-dong.html), [Webhook SePay](https://docs.sepay.vn/tich-hop-webhooks.html).

## Luồng và dữ liệu

- Backend lấy số lượng/giá từ giỏ của phiên, tính lại ưu đãi theo thuật toán hiện có. Client chỉ gửi danh sách `MaDonGia`, lựa chọn nhận/thanh toán, địa chỉ, ghi chú và tổng đã xem để phát hiện thay đổi giá. Không nhận giá chi tiết, chủ đơn hoặc trạng thái từ client.
- Khi tạo đơn, khóa các dòng khuyến mãi đang áp dụng trước khi tính giá, làm mới ORM sau khóa và giữ khóa tới commit/rollback. Giảm `ChiTietKhuyenMai.SoLuong` đúng `SoLuongKhuyenMai × SoLuongQuyDoi`, cộng gộp các dòng cùng sản phẩm/chương trình. Phần mua giá thường không tiêu hạn mức. Giỏ hàng/quote thông thường chỉ đọc. Nếu hạn mức làm thay đổi tổng tiền, trả `QUOTE_CHANGED`, không âm hạn mức hoặc tiếp tục với giá cũ.
- Trừ hạn mức cùng giao dịch với kho, đơn, chi tiết và xóa giỏ: lỗi tạo/lưu đơn sẽ rollback. Không trừ khi mở Checkout hoặc nhận IPN; không tự động hoàn hạn mức đơn QR chưa trả tiền. Không sửa lại hạn mức của các đơn đã tạo trước thay đổi này.
- Kiểm tra địa chỉ thuộc người đặt. Vì bảng đơn không có cột địa chỉ, `GhiChu` lưu bản chụp người nhận, điện thoại, hình thức nhận/địa chỉ và ghi chú người mua. Không đổi địa chỉ chính của tài khoản.
- `ChiTietDonHang.DonGia` lưu giá gốc tại thời điểm đặt; `TongTien` bằng tổng `DonGia × SoLuong`, `TienGiamGia` lưu tổng giảm và `TongThanhToan=TongTien-TienGiamGia`. Cách này giữ đúng tổng ngay cả khi chỉ một phần số lượng được khuyến mãi.
- Khóa dòng người dùng giống thao tác giỏ; lưu đơn, chi tiết và xóa các dòng giỏ đã đặt trong cùng giao dịch. Các dòng không chọn giữ nguyên. Gửi lại cùng giỏ đã tiêu thụ bị từ chối; không tự động thử lại POST khi mất mạng.
- URL kết quả `checkout.html?order=<id>` cho phép tải lại QR/trạng thái mà không tạo lại đơn. Chỉ chủ đơn được xem qua API.
- Trang hiển thị QR, ngân hàng, tài khoản, số tiền, nội dung chuyển khoản bằng văn bản; kiểm tra trạng thái mỗi 5 giây khi chờ và có nút kiểm tra thủ công khi lỗi.
- Webhook xác thực khóa, chiều tiền vào, tài khoản, mã đơn duy nhất và số tiền; chỉ cập nhật đơn QR còn chờ. Khóa dòng đơn cùng cờ đã thanh toán ngăn xử lý lặp webhook cho cùng đơn. Không ghi nhận thanh toán từ thao tác trên frontend.
- Một giao dịch phải đủ hoặc lớn hơn số tiền đơn; giao dịch thiếu tiền không xác nhận, không cộng dồn nhiều giao dịch, không tự hoàn tiền thừa. Không bổ sung sổ giao dịch thanh toán vì schema hiện có không có bảng/cột tương ứng.

## API bổ sung

`POST /api/orders` — session khách hàng + CSRF, trả HTTP 201 với `code=ORDER_CREATED` và `order`.

```json
{
  "MaDonGia": [11, 21],
  "PhuongThucThanhToan": 0,
  "HinhThucNhanHang": "delivery",
  "MaDiaChi": "9",
  "GhiChu": "Gọi trước khi giao",
  "TongThanhToan": "120000"
}
```

Nhận tại nhà thuốc dùng `HinhThucNhanHang="pickup"`, `MaDiaChi=null`. QR dùng `PhuongThucThanhToan=1`.

`GET /api/orders/<id>` — chỉ chủ đơn; trả `code=ORDER_READ`, `order`. Mã đơn/tiền trong phản hồi là chuỗi để bảo toàn BIGINT.

`POST /api/payments/sepay/webhook` — xác thực API Key server-to-server, không dùng cookie/CSRF của trình duyệt. Payload theo SePay.

Lỗi đáng chú ý: `PAYMENT_NOT_CONFIGURED`, `CART_CHANGED`, `QUOTE_CHANGED`, `OUT_OF_STOCK`, `ADDRESS_NOT_FOUND`, `QR_AMOUNT_INVALID`, `ORDER_AMOUNT_LIMIT`, `ORDER_NOT_FOUND`, `INVALID_WEBHOOK_KEY`.

## Kiểm thử

- `backend/tests/test_orders.py`: tạo COD/QR, tính tiền và chi tiết, địa chỉ, giỏ, tồn kho gộp đơn vị, kiểm tra giá thay đổi, rollback, xác thực/quyền/chủ đơn, payload, webhook sai khóa/tài khoản/nội dung/số tiền, webhook lặp và đơn không hợp lệ. Chặn kết nối CSDL thật.
- `node backend/tests/browser_manager.mjs --checkout`: hồi quy giỏ/trang xác nhận, tạo COD, QR, thiếu cấu hình, chống click lặp, tải lại đơn BIGINT, xác nhận thanh toán, bảo vệ dữ liệu khi đăng xuất và giao diện 1440–320px, dùng API giả lập.
- Chưa xác minh giao dịch ngân hàng/SePay thật hoặc ghi đơn trên PostgreSQL thật; cần cấu hình tài khoản, URL công khai và khóa trước khi kiểm tra đầu cuối.
