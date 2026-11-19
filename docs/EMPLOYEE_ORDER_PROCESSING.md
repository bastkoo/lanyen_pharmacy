# Xử lý đơn hàng nhân viên

Yêu cầu và các quyết định được người dùng duyệt ngày 19/11/2026:

- Chỉ nhân viên `VaiTro=1` sử dụng API `/api/employee/orders`.
- Danh sách mặc định gồm trạng thái 0, 1, 2. Ưu tiên 1, sau đó 0, 2; trong mỗi nhóm, đơn đặt trước xuất hiện trước. Lọc nhanh Đang chờ xử lý (1), Đang giao (2). Tìm một phần mã đơn hoặc SĐT, hỗ trợ dạng đầu 0 và +84.
- Hiển thị giờ đặt theo múi giờ Việt Nam. Trạng thái 0 quá 24 giờ chưa trả tiền có chữ đỏ “Quá thời gian xử lý” dưới giờ đặt.
- Chuyển 0→1 xác nhận đã thanh toán tại quầy; 1→2 giao hàng; 2→3 xác nhận đã giao, đồng thời xác nhận đã thu tiền nếu là COD. Nút In hóa đơn xuất hiện ở trạng thái 1, trước nút chuyển trạng thái và Hủy đơn hàng; ba nút dùng màu vàng, xanh lá, đỏ.
- Chi tiết nhân viên hiển thị ảnh và mã vạch sản phẩm để đối chiếu khi xác nhận đơn. Mã vạch không xuất hiện trong bản in.
- Cộng xu theo `TongThanhToan // 1000`, dùng số tiền sau giảm giá/đổi xu, không dùng số thực. Ghi giao dịch cộng xu trong `DiemThuong` cùng transaction chuyển 2→3. Khóa tài khoản khách và đọc lại đơn dưới khóa trước khi đổi trạng thái; request có `from_status` để phát hiện cập nhật cạnh tranh. Không cho nhảy hoặc quay ngược trạng thái, không cộng lặp khi gửi lại.
- `MaNhanVien` ghi nhận nhân viên cập nhật. `XuDaCong` đọc từ giao dịch tích xu của đơn; thông báo đã cộng xu chỉ hiện khi đơn là 3 và có giao dịch ghi nhận, gồm chi tiết nhân viên và chi tiết khách hàng. Đơn cũ đã giao nhưng chưa có giao dịch không được báo đã cộng xu.
- Nhân viên có thể hủy 0, 1, 2. Hoàn đúng phân bổ `DuLieuHoanTra`: lô thuốc, hạn mức khuyến mãi và xu đã đổi. Dùng cùng cơ chế transaction/khóa/chống hoàn lặp đã có. Khách hàng vẫn chỉ được tự hủy 0/1. Tiền đã thanh toán QR cần xử lý hoàn riêng, không giả lập hoàn tiền.
- Số đơn trạng thái 1 hiển thị trong huy hiệu tròn, viền và số màu đỏ ở thanh điều hướng và bộ lọc Đang chờ xử lý, cập nhật mỗi 30 giây và sau thao tác. Huy hiệu nhún nhẹ, tắt chuyển động khi thiết bị yêu cầu `prefers-reduced-motion: reduce`. Bỏ khối giới thiệu chung “Công việc của bạn” ở tất cả mục nhân viên. Tìm kiếm tự chạy sau 300ms ngừng gõ, không cần nút Tìm kiếm. Đơn không phát sinh xu (`TongThanhToan // 1000 = 0`) không tạo giao dịch cộng xu.

## Tạo đơn tại quầy

- Sidebar desktop rộng 280px để tên mục Xử lý đơn hàng và huy hiệu nằm cùng dòng. Ô tìm kiếm đơn cần xử lý và đơn hoàn tất dùng toàn bộ chiều rộng vùng nội dung. Trang tạo đơn bỏ tiêu đề/mô tả hiển thị, giữ tên trang ẩn cho hỗ trợ đọc màn hình và điều hướng focus.
- Sau kiểm tra SĐT, tên khách và số dư xu hiển thị cạnh nhau, kể cả số dư 0. Công tắc Sử dụng xu gọn 36×20px, có focus bàn phím; chỉ hiện khi số dư lớn hơn 0.
- Nhãn công tắc là `Sử dụng xu (-N [icon xu])`, với N là số xu có thể đổi cho đơn: nhỏ hơn giữa số dư và phần nguyên tiền hàng sau khuyến mãi chia 10. Nhãn giữ cùng số khi bật/tắt, cập nhật theo giỏ; không lấy số tiền còn lại sau đổi xu để tính lần nữa. Công tắc tạm khóa khi đang lấy báo giá hoặc không có xu đổi được.

- Mục **Tạo đơn hàng** (`#counter`) mở danh sách tất cả đơn trạng thái 3, phân trang 20 đơn, tìm theo mã/SĐT, chọn để xem bill và in. Không giới hạn theo nhân viên hay kênh đặt. Quyền in trạng thái 3 ở trang này tách khỏi nút in trạng thái 1 ở trang xử lý đơn.
- **Tạo đơn hàng mới** mở hộp thoại native `<dialog>` rộng tối đa 1320px, giỏ bên trái khoảng 40%, thuốc bên phải 60%; trên màn hình nhỏ xếp dọc. Mỗi dòng giỏ có ảnh, tên, giá gốc/giá ưu đãi, số lượng, lựa chọn đơn vị, thành tiền và nút bỏ. Đổi sang đơn vị đã có trong giỏ sẽ gộp số lượng. Tra cứu SĐT với nút Kiểm tra; tài khoản mua có thể thuộc vai trò 0, 1, 2 (giữ kiểm tra trạng thái khóa). Khách chưa có tài khoản nhập tên và chỉ được tạo tài khoản khách hàng khi tạo đơn thành công. Không cấp phiên đăng nhập hay bỏ qua OTP của khách. Người vận hành trang vẫn là nhân viên vai trò 1.
- Tìm thuốc tự động theo tên/mã vạch, lọc loại, phân trang và chọn đơn vị bán; thêm, đổi số lượng, bỏ thuốc. Báo giá từ backend bao gồm khuyến mãi và đổi xu tối đa; không dùng giá client để trừ kho. Tài khoản có số dư mới hiện lựa chọn dùng xu, quy đổi giữ nguyên 1 xu = 10đ.
- Thuốc hiển thị thành danh sách dọc có ảnh, mã vạch, đơn vị, giá và nút Thêm. Ô chọn chỉ ghi đơn vị tính; giá màu đỏ nằm riêng. Nếu hạn mức khuyến mãi còn đủ một đơn vị đang chọn, hiển thị giá gốc gạch ngang và giá ưu đãi do cùng bộ tính giá giỏ hàng xác định. Tổng tiền gốc dùng `GiaGoc` của dòng được giảm giá, tránh tính nhầm từ giá đã giảm.
- Có thể thêm thuốc và lấy báo giá trước khi nhập/kiểm tra SĐT. Dòng giỏ hiển thị giá tạm tính từ danh mục ngay, sau đó cập nhật báo giá backend cho toàn bộ số lượng và hạn mức khuyến mãi; không ghi giao dịch, không tra cứu ví nếu chưa có SĐT được kiểm tra. Nút Hoàn thành vẫn yêu cầu xác nhận khách hàng. `SDT` là tùy chọn/chấp nhận chuỗi rỗng chỉ ở `/counter/quote`; `/counter` tạo đơn vẫn bắt buộc SĐT hợp lệ.
- Chi tiết ở trang xử lý đơn và chi tiết bill tại quầy đều dùng hộp thoại: ảnh/tên/số lượng/giá/mã vạch ở trái, tổng tiền/thanh toán/nút in và thao tác ở phải; màn hình nhỏ xếp dọc. Đóng bằng nút × hoặc Escape, trả focus về thao tác mở; không đóng trong lúc gửi giao dịch. Bản in vẫn không có mã vạch.
- Cộng xu theo quyết định cuối: **1.000đ = 1 xu**, tính `TongThanhToan // 1000`; đơn 0đ không cộng xu. Tiền mặt: nhân viên chọn và bấm Hoàn thành sau khi thu đủ tiền, đơn được ghi nhận đã thanh toán và trạng thái 3. QR: tạo đơn 0 chưa thanh toán, mở Checkout SePay trong tab mới; chỉ IPN xác thực mới ghi nhận đã thanh toán. Trang nhân viên kiểm tra mỗi 5 giây và gọi hoàn tất có khóa/chống lặp để chuyển 1→3, cộng xu. Callback trình duyệt chỉ điều hướng về bill nhân viên, không xác nhận thanh toán. Đơn QR chưa hoàn tất có thể mở lại từ danh sách chờ; cũng dùng cơ chế tự hủy sau 24 giờ hiện có.
- Tạo đơn tái sử dụng transaction giá, khóa tài khoản, hạn mức khuyến mãi, phân bổ lô FIFO khả dụng và trừ xu hiện có. `KenhDatHang=True`, ghi `MaNhanVien`; không thêm cột/bảng. `DuLieuHoanTra` giữ phân bổ hoàn trả và bổ sung `counter_request={actor,id,fingerprint}` để nhận diện gửi lại; khóa advisory theo nhân viên/UUID trước khi tạo khách/đơn. Gửi lại cùng nội dung trả đơn cũ, không trừ lặp; nội dung đổi cùng UUID bị từ chối. Hoàn tất QR khóa tài khoản rồi khóa đơn, chỉ cộng xu một lần. Tài khoản khách mới và đơn cùng transaction.
- In bill dùng cùng mẫu in an toàn, không hiển thị mã vạch. Thanh toán SePay phải có cấu hình hợp lệ; kiểm thử dùng API/DB giả lập, không tạo đơn hay chuyển tiền thật.

API bổ sung, đều yêu cầu nhân viên vai trò 1; các POST có CSRF:

| Phương thức | Đường dẫn dưới `/api/employee/orders` | Nội dung |
| --- | --- | --- |
| GET | `/pending-count` | Tổng đơn trạng thái 1, không phụ thuộc tìm kiếm |
| GET | `/completed?search=&page=1` | Tất cả đơn trạng thái 3 |
| GET | `/counter/customer?phone=...` | Tên, tồn tại tài khoản và số xu |
| GET | `/counter/products?search=&category_id=&page=1` | Thuốc, đơn vị, giá gốc và giá khuyến mãi đủ hạn mức |
| POST | `/counter/quote` | `{SDT,items:[{MaThuoc,MaDonGia,SoLuong}],DoiDiem}` |
| POST | `/counter` | Báo giá thêm `HoTen,PhuongThucThanhToan,TongThanhToan,request_id` UUID |
| GET | `/counter/pending` | Tối đa 50 đơn tại quầy đang chờ hoàn tất gần nhất |
| GET | `/counter/<id>` | Bill đơn hoàn tất hoặc đơn tại quầy |
| POST | `/counter/<id>/payment` | `{}` mở Checkout đã ký |
| POST | `/counter/<id>/complete` | `{}` hoàn tất khi thanh toán đã được xác nhận |

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
