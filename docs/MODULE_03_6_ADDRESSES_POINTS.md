# MODULE 03.6 — Điều hướng tài khoản, địa chỉ và điểm tích lũy

## Điều hướng

Menu avatar có Thông tin cá nhân, Điểm tích lũy, Đơn hàng của tôi, Địa chỉ nhận hàng, Đăng xuất. Với VaiTro 2, Quản lý dẫn tới `manager/index.html#overview`; VaiTro 1 dẫn tới trang nhân viên `employee/index.html`. Trang nhân viên là giao diện chờ, kiểm tra phiên/vai trò, chưa có nghiệp vụ nhân viên mới. VaiTro 0 không có mục Quản lý.

Các trang thông tin cá nhân, điểm tích lũy, đơn hàng và địa chỉ dùng sidebar chung bên trái; trên màn hình nhỏ sidebar chuyển lên trên. Tên mục dùng màu văn bản tối, mục hiện tại có nền xanh nhạt. Trang đơn hàng hiện là trang chờ, không tạo dữ liệu đơn hàng giả.

## Địa chỉ

Dùng nguyên bảng `DiaChi` và cột boolean `DiaChiGiao`, không đổi schema. Các API dưới `/api/auth/me/addresses` chỉ làm việc với tài khoản trong phiên:

- GET danh sách của chính chủ, địa chỉ chính đứng đầu.
- POST tạo; PUT `/<id>` sửa. Payload gồm `TinhThanh`, `PhuongXa`, `DiaChiCuThe`, trim và giới hạn 1–255 ký tự.
- PATCH `/<id>/primary` đổi địa chỉ chính; địa chỉ chính cũ trở thành phụ.
- DELETE `/<id>` xóa sau xác nhận ở giao diện. Xóa địa chỉ chính sẽ chọn địa chỉ phụ tạo sớm nhất (MaDiaChi nhỏ nhất), theo quyết định người dùng. Xóa hết rồi thêm lại sẽ có địa chỉ chính mới.

Địa chỉ tạo đầu là chính; những địa chỉ tiếp theo là phụ. Mọi thao tác ghi khóa dòng chủ tài khoản trước khi đọc và cập nhật danh sách; toàn bộ thay đổi cờ chính/phụ và dữ liệu được commit trong một giao dịch. Chặn ID không thuộc tài khoản; không nhận MaNguoiDung hoặc DiaChiGiao từ payload tạo/sửa. Các lần ghi cũng chuẩn hóa lại cờ nếu dữ liệu cũ có nhiều/không có địa chỉ chính. Không thêm constraint/index chưa được phê duyệt; mọi luồng ghi địa chỉ qua ứng dụng phải dùng cơ chế khóa này.

Danh sách chọn tỉnh/thành và phường/xã dùng [Province Open API v2](https://provinces.open-api.vn/), phiên bản sau sáp nhập 07/2025:

- GET `https://provinces.open-api.vn/api/v2/p/`.
- GET `https://provinces.open-api.vn/api/v2/p/{code}?depth=2` lấy phường/xã của tỉnh được chọn.

Frontend không gửi cookie, số điện thoại hay địa chỉ cụ thể tới nhà cung cấp. Lưu tên tỉnh/phường vào các cột có sẵn; mã nhà cung cấp chỉ dùng trong danh sách chọn. Cache thành công trong bộ nhớ trang; lỗi có thử lại, không cache lỗi. Chuyển tỉnh xóa lựa chọn phường cũ; hủy/bỏ qua phản hồi cũ khi đóng hoặc đổi lựa chọn. Tên địa chỉ cũ không khớp danh sách mới được giữ thành lựa chọn đã lưu, cho phép sửa đường/số nhà mà không tự di chuyển dữ liệu hành chính.

## Điểm tích lũy

GET `/api/auth/me/points?page=1&per_page=20` trả số dư và lịch sử điểm của chính chủ, mới nhất trước, có phân trang. Tính tổng SoDiem cho LoaiGiaoDich=True và trừ SoDiem cho False. Số dư lấy từ toàn bộ lịch sử của tài khoản; phân trang chỉ áp dụng danh sách giao dịch. Chỉ trả mã giao dịch, số điểm, loại, lý do và thời gian; không lộ MaNguoiDung. Sử dụng số nguyên chính xác và kiểu đủ lớn khi tổng hợp.

Đây là trang đọc dữ liệu hiện có, không thêm quy tắc tích/đổi điểm, không ghi giao dịch thưởng. Trang có trạng thái trống, lỗi/thử lại, phiên hết hạn và xóa dữ liệu hiển thị khi đăng xuất.

## Xác minh và giới hạn

- 359 kiểm thử backend đạt, gồm địa chỉ và điểm, chủ sở hữu/CSRF/whitelist, lỗi DB/rollback, một địa chỉ chính, chuyển chính và tự chọn lại khi xóa.
- 65 kiểm thử JavaScript đạt, gồm API địa giới: v2, quan hệ tỉnh/phường, cache, lỗi/thử lại và hủy yêu cầu; kiểm tra cookie/CSRF và ID lớn.
- Kiểm thử trình duyệt với API giả lập cho hồ sơ, sidebar, vai trò, địa chỉ CRUD/chính-phụ, danh sách chọn, giữ giá trị cũ, lỗi, điểm/phân trang/trống và bố cục 1440–320px. Không có thông báo nổi cho thao tác chỉ xem.
- Đã đọc trực tiếp API địa giới để xác minh endpoint v2, dữ liệu phường/xã và CORS. Các kiểm thử ghi dùng mock; chưa ghi vào PostgreSQL thật, chưa kiểm tra cạnh tranh giao dịch trên DB thật, không upload Cloudinary trong đợt này.
