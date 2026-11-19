# Xử lý đơn hàng nhân viên

Yêu cầu và các quyết định được người dùng duyệt ngày 19/11/2026:

- Chỉ nhân viên `VaiTro=1` sử dụng API `/api/employee/orders`.
- Danh sách mặc định gồm trạng thái 0, 1, 2. Ưu tiên 1, sau đó 0, 2; trong mỗi nhóm, đơn đặt trước xuất hiện trước. Lọc nhanh Đang chờ xử lý (1), Đang giao (2). Tìm một phần mã đơn hoặc SĐT, hỗ trợ dạng đầu 0 và +84.
- Hiển thị giờ đặt theo múi giờ Việt Nam. Trạng thái 0 quá 24 giờ chưa trả tiền có chữ đỏ “Quá thời gian xử lý” dưới giờ đặt.
- Chuyển 0→1 xác nhận đã thanh toán tại quầy; 1→2 giao hàng; 2→3 xác nhận đã giao, đồng thời xác nhận đã thu tiền nếu là COD. Nút In hóa đơn xuất hiện ở trạng thái 1, trước nút chuyển trạng thái và Hủy đơn hàng; ba nút dùng màu vàng, xanh lá, đỏ.
- Chi tiết nhân viên hiển thị ảnh và mã vạch sản phẩm để đối chiếu khi xác nhận đơn. Mã vạch không xuất hiện trong bản in.
- Cộng xu theo `TongThanhToan // 100`, dùng số tiền sau giảm giá/đổi xu, không dùng số thực. Ghi giao dịch cộng xu trong `DiemThuong` cùng transaction chuyển 2→3. Khóa tài khoản khách và đọc lại đơn dưới khóa trước khi đổi trạng thái; request có `from_status` để phát hiện cập nhật cạnh tranh. Không cho nhảy hoặc quay ngược trạng thái, không cộng lặp khi gửi lại.
- `MaNhanVien` ghi nhận nhân viên cập nhật. `XuDaCong` đọc từ giao dịch tích xu của đơn; thông báo đã cộng xu chỉ hiện khi đơn là 3 và có giao dịch ghi nhận, gồm chi tiết nhân viên và chi tiết khách hàng. Đơn cũ đã giao nhưng chưa có giao dịch không được báo đã cộng xu.
- Nhân viên có thể hủy 0, 1, 2. Hoàn đúng phân bổ `DuLieuHoanTra`: lô thuốc, hạn mức khuyến mãi và xu đã đổi. Dùng cùng cơ chế transaction/khóa/chống hoàn lặp đã có. Khách hàng vẫn chỉ được tự hủy 0/1. Tiền đã thanh toán QR cần xử lý hoàn riêng, không giả lập hoàn tiền.

## API

| Phương thức | Đường dẫn | Nội dung |
| --- | --- | --- |
| GET | `/api/employee/orders?status=all&search=&page=1&per_page=20` | Danh sách, tổng số, phân trang |
| GET | `/api/employee/orders/<id>` | Khách hàng, giờ đặt, thanh toán, sản phẩm, ghi chú, khả năng in và xu đã cộng |
| POST | `/api/employee/orders/<id>/status` | `{ "from_status": 1, "to_status": 2 }` |
| POST | `/api/employee/orders/<id>/cancel` | `{}` |

Các API ghi yêu cầu CSRF. Giá, khách hàng, xu và dữ liệu hoàn không nhận từ client. API hiện có của khách hàng giữ nguyên; chi tiết đơn đã giao bổ sung trường `XuDaCong`.

## Tự hủy QR quá 24 giờ

Điều kiện chính xác: `PhuongThucThanhToan=1`, `TrangThaiThanhToan=0`, `TrangThaiDonHang=0`, `NgayDat < hiện tại - 24 giờ`. Đơn COD không áp dụng. Mốc thời gian được tính theo giờ Việt Nam.

Backend kiểm tra mỗi 60 giây khi tiến trình đang chạy. `python run.py` khởi động worker cùng server (chỉ tiến trình con khi debug reloader bật). Với Flask CLI/WSGI, worker được khởi động sau request đầu tiên và tiếp tục chạy dù trang nhân viên đóng. Không có worker tự chạy trong test (`TESTING=True`). Có thể chạy riêng:

```powershell
.venv/Scripts/python.exe -m flask --app run.py expire-unpaid-orders
.venv/Scripts/python.exe -m flask --app run.py expire-unpaid-orders --watch
```

Lệnh đầu kiểm tra một lần; `--watch` lặp mỗi phút. Không cần thêm thư viện hay thay schema. Server dừng thì worker cùng tiến trình cũng dừng; nếu triển khai nhiều process, kiểm tra lại điều kiện dưới khóa ngăn hủy/hoàn lặp.

Mỗi đơn được đọc lại sau khi khóa tài khoản và đơn. Nếu vừa thanh toán hoặc trạng thái đã đổi, không hủy. Đơn thiếu phân bổ hoàn trả không bị tự cộng kho sai lô: bỏ qua và cần nhà thuốc đối soát, tiếp tục hiển thị cảnh báo quá hạn nếu vẫn ở 0. Gateway từ chối mở thanh toán hoặc ghi nhận thanh toán cho đơn 0 đã quá hạn, không tự phục hồi đơn đã hủy.

## In và kiểm thử

In hóa đơn sử dụng nội dung DOM an toàn từ chi tiết đơn mới nhất, chỉ trạng thái 1; gọi hộp in của trình duyệt, không tự in khi vừa chuyển trạng thái. Bản in gồm mã/giờ đặt, khách hàng, sản phẩm, tổng tiền, giảm giá/đổi xu, tổng thanh toán và nhân viên; không gồm mã vạch. Không thêm mã số thuế, VAT hay tuyên bố hóa đơn điện tử khi chưa có nghiệp vụ đó.

Kiểm thử: `test_employee_orders.py`, hồi quy `test_orders.py`, Chrome `node backend/tests/browser_manager.mjs --employee` và `--checkout`. Browser dùng auth/API giả lập, chặn lệnh in thật để kiểm tra DOM và CSS bản in. Không dùng đơn hàng thật để kiểm thử thu tiền, giao hàng hoặc hủy/hoàn.
