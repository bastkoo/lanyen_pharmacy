# Chat AI và lịch sử khách hàng

Chat AI dùng Groq phía backend. API key chỉ nằm trong cấu hình server.

## Lưu trữ

Migration `b7d20a81c649` bổ sung theo yêu cầu được duyệt:

- `TinNhan.LoaiHoiThoai`: `AI` hoặc `DUOC_SI`; mặc định `DUOC_SI` để bảo toàn chat cũ.
- `NoiDungTinNhan.LoaiNguoiGui`: `KHACH_HANG`, `AI`, `DUOC_SI`.
- `NoiDungTinNhan.NguoiGui` cho phép NULL với AI; khách hàng và dược sĩ được backend ghi mã tài khoản thực.

Khi Groq trả lời thành công, một transaction lưu hai dòng: câu hỏi của khách và câu trả lời AI.
Lỗi Groq không tạo một lượt hỏi/đáp dở dang. `request_id` giúp gửi lại sau lỗi mạng mà không lưu trùng.
Không tạo tài khoản nhân viên cho AI. Hội thoại AI không vào hàng đợi dược sĩ hoặc cấp quyền mua thuốc cần tư vấn.

Nội dung AI lưu trong `NoiDung` với tiền tố `LYAI1:` và JSON gồm `request_id`, `text`, `products`.
Các thẻ là thông tin sản phẩm tại thời điểm trả lời; giá và tồn kho hiện tại phải kiểm tra lại khi xem/mua.
Đóng chat giữ lịch sử. Đăng xuất xóa dữ liệu khỏi giao diện, không xóa lịch sử trong CSDL.

## API

Cả hai API yêu cầu tài khoản khách hàng; POST có CSRF như các thao tác chat khác.

- `POST /api/chat/ai`: `{ "text": "...", "request_id": "UUID" }`. `request_id` tùy chọn để tương thích client cũ; client hiện tại luôn gửi UUID.
- Kết quả gồm `text`, `products`, `messages` (hai tin đã lưu, có ID, vai trò và thời gian).
- `GET /api/chat/ai/messages?before=<MaNoiDung>`: lịch sử của chính khách đang đăng nhập; tối đa 50 tin mỗi trang, gồm `items` và `has_more`.

Backend lấy tối đa sáu tin gần nhất làm ngữ cảnh cho Groq. Client không được cung cấp lịch sử hoặc giả mạo người gửi.

## Thuốc và tồn kho

AI tìm tên/mô tả thuốc qua truy vấn SQLAlchemy được giới hạn kết quả. Không cho mô hình thực thi SQL tùy ý.
Tồn được tính từ `LoThuoc` có `SoLuongTon > 0` và `HanSuDung >= ngày Việt Nam hiện tại`.
Chỉ giới thiệu sản phẩm đủ tồn theo ít nhất một đơn vị bán có `SoLuongQuyDoi > 0` và giá hợp lệ.
Backend kiểm tra tồn lại sau khi Groq trả lời và bỏ thẻ sản phẩm vừa hết hàng.
Không gửi giá nhập, thông tin tài khoản hay dữ liệu lô nội bộ cho Groq hoặc khách hàng.

`PhanLoai = true` vẫn yêu cầu liên hệ dược sĩ, với nội dung được backend kiểm soát.

## Kiểm tra

Chạy tại `backend/`:

```powershell
.venv/Scripts/python.exe -m unittest tests.test_ai_chat tests.test_chat
.venv/Scripts/python.exe -m tests.check_ai_history_migration
.venv/Scripts/python.exe -m tests.check_ai_history_postgresql
.venv/Scripts/python.exe -m tests.check_ai_chat_live
```

`check_ai_history_postgresql` chỉ chạy trong môi trường development, dùng transaction ngoài để rollback toàn bộ fixture.
`check_ai_chat_live` gọi Groq và đọc danh mục thực nhưng không ghi lịch sử.
Áp dụng migration được duyệt bằng `check_ai_history_migration --apply`; script đối chiếu số dòng chat trước/sau.

Chạy từ thư mục gốc để kiểm tra frontend:

```powershell
node --test backend/tests/test_chat_frontend.mjs
node backend/tests/browser_ai_chat.mjs
```
