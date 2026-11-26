# Mobile Design System — Lan Yến Pharmacy

Phiên bản 1.0 · 26/11/2026 · Áp dụng riêng Flutter trong mobile/.

## Nhận diện và bố cục

Kế thừa Green 1.0 từ docs/DESIGN_SYSTEM.md và frontend/css/base/variables.css.
Dùng màu xanh và trắng làm nhận diện, typography có phân cấp, bề mặt trung tính,
khoảng cách có ý nghĩa. Không thay Website tokens, không áp bố cục Website vào Flutter.
Các bảng forest/sage/ivory trong yêu cầu chỉ tham khảo, không phải bảng màu thay thế.

Preview là bảng mẫu đọc dọc, có cổng chọn vai trò và vùng thử tương tác, không phải
trang bán hàng hoặc dashboard giả. Dùng khoảng cách và divider thay card grid.
Customer ưu tiên đọc rõ và thân thiện; Employee ưu tiên thao tác và trạng thái;
Manager ưu tiên thứ tự thông tin và đọc dữ liệu khi được triển khai. Dùng cùng Theme.
Chưa tự tạo navigation nghiệp vụ hoặc KPI cho Employee/Manager.

## Màu

| Token AppColors | Giá trị | Nguồn / mục đích |
|---|---|---|
| primary | #16865B | Green 1.0, nút chính |
| primaryDark | #106B48 | Green 1.0, nhấn/focus/chữ trên mint |
| primaryLight | #E8F5EE | Green 1.0, nền nhấn |
| background / surface | #F5F7F6 / #FFFFFF | Nền / bề mặt Website |
| textPrimary / textSecondary | #24362F / #586860 | Token chức năng Manager đã có, đủ rõ trên nền sáng |
| border | #DDE5E0 | Divider nhẹ; không thay viền control |
| success | #106B48 | Thành công kèm biểu tượng/văn bản |
| warning / warningBackground | #785313 / #FFF7E5 | Cảnh báo chức năng |
| error / errorBackground | #A52D35 / #FFF1F1 | Lỗi chức năng |
| information | #24362F | Thông tin trung tính kèm icon |

Không dùng trực tiếp màu status sáng của Website làm chữ nhỏ trên nền trắng.
Màu chức năng tối lấy từ section 18 Design System, không tạo thương hiệu mới.

Hai cấp: AppColors chỉ giữ màu chung; màu riêng trong class ngay sau imports của
file sử dụng. Ví dụ LoginColors/PreviewColors, private constructor, static const
khi phù hợp, từng thuộc tính có chú thích tiếng Việt. Không literal màu trong
build/TextStyle/decoration; không file home_colors.dart. Màu động dẫn xuất từ token.
Theme-derived colors được phép qua Theme chung.

## Typography

Be Vietnam Pro được sao chép nguyên từ assets Website sang mobile/assets/fonts,
kèm giấy phép OFL, đóng gói weights 400/500/600. Không tải CDN lúc chạy.
Tên file nguồn Website không thay đổi. Fallback nền tảng khi ký tự không có glyph.

| Vai trò | Cỡ logical px | Line height | Weight |
|---|---:|---:|---:|
| Tiêu đề chính | 30 | 1.3 | 600 |
| Tiêu đề màn hình phụ | 24 | 1.35 | 600 |
| Tiêu đề khu vực | 20 | 1.4 | 600 |
| Body | 16 | 1.6 | 400 |
| Supporting | 14 | 1.5 | 400 |
| Nhãn/nút | 16 | 1.5 | 500 |

Không khóa TextScaler, không ellipsis nội dung thiết yếu. Hỗ trợ 100/125/150/200%.
Không ép mọi trang cùng composition. Không dùng chữ in hoa cho đoạn dài.

## Spacing, shape, elevation và icon

Spacing 4/8/16/24/32/48; screen padding 24, tối đa nội dung preview 760.
Radius 4/8/12/16; input/button 8, brand specimen 12. Không bo mọi dòng thành card.
Preview elevation 0, không shadow trang trí; chỉ bổ sung elevation khi thực sự có
lớp modal hoặc nội dung nổi. Không gradient/glassmorphism/banner quá lớn.
Material outlined icons SDK dùng nhất quán, khoảng 24; có tooltip cho icon button,
icon trạng thái trang trí bị loại khỏi semantics khi đã có text.

## Controls và navigation

FilledButton cho thao tác chính, OutlinedButton cho lựa chọn vai trò và trở về,
TextButton cho phục hồi route. Target tối thiểu 48x48 logical pixel, nhãn được wrap.
Material states giữ pressed/focus/disabled; input có label và helper thường trực,
viền thường màu textSecondary, focus primaryDark 2px. Không dùng placeholder thay label.
Ghi chú preview chỉ lưu state Widget, không gửi máy chủ hoặc lưu trữ.
Các section đáng kể là Widget class cùng file, callbacks truyền tường minh.

Một cổng vào chung và shell riêng; mỗi shell chuẩn bị điểm sở hữu navigation
cho phạm vi sau. Hiện chỉ có điều hướng vào/thoát demo, không tab nghiệp vụ giả.
Route lạ hoặc sai vai trò hiển thị thông báo và nút trở về; role client không
thay Backend authorization. Thoát loại bỏ nội dung và state preview cũ.

## Trạng thái và motion

Mẫu success/information/warning/error có văn bản và icon; empty có mô tả rõ.
Không hiển thị loading giả khi không có tác vụ bất đồng bộ. Khi thêm API thật:
loading có nhãn semantics và chống submit trùng; empty không biến thành lỗi;
error có nguyên nhân dễ hiểu, giữ input và retry có kiểm soát.
Không tự retry giao dịch ghi. Không trình bày lỗi raw từ Backend.

Tokens motion 200/300ms; AnimatedSwitcher dùng 200ms hoặc zero khi
MediaQuery.disableAnimations=true. Không animation liên tục, không cản thao tác.

## Responsive và accessibility

Thiết kế dựa trên constraints, SingleChildScrollView, SafeArea, Column/Expanded.
Một cột trên điện thoại; nội dung có maxWidth khi rộng. Không ép chiều cao text.
Kiểm tra 320/360/390/430/600/900 và text scale 1/1.25/1.5/2.
Keyboard mặc định resize Scaffold; input và nút phải cuộn vào vùng nhìn thấy.
Test thêm keyboard insets/safe areas; không đồng nhất widget tests với bàn phím native.

Mục tiêu text thường >=4.5:1, text lớn >=3:1, control/focus cần thiết >=3:1.
Có heading semantics, label input, tooltip, focus bằng SDK, live region cho phản hồi.
Kiểm tra guideline touch targets/labels/text contrast và tương phản token thực.
TalkBack/VoiceOver và thiết bị thật cần kiểm thử riêng trước tuyên bố tuân thủ.

## Hình ảnh và giới hạn

Logo Website đã được tham khảo ở frontend/assets/images/LY-removebg-preview.png;
preview hiện dùng tên chữ thương hiệu để không thêm ảnh không cần thiết.
Giữ tỷ lệ, semanticLabel cho ảnh có ý nghĩa, placeholder/error khi có ảnh mạng.
Không bịa ảnh sản phẩm, giá, công dụng thuốc hoặc trust badge.
Hiện chỉ light theme; dark theme cần thiết kế/kiểm thử token riêng, chưa tuyên bố hỗ trợ.
