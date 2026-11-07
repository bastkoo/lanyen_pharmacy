# LAN YEN PHARMACY
# DESIGN SYSTEM

**Version:** 1.1  
**Status:** Active  
**Brand:** Lan Yến Pharmacy  
**Design Direction:** Modern Healthcare – Clean – Trustworthy – Distinctive

---

# 1. DESIGN PHILOSOPHY

Lan Yến Pharmacy hướng đến một hệ thống nhà thuốc trực tuyến có giao diện hiện đại, chuyên nghiệp, đáng tin cậy và dễ sử dụng.

### 1.1. Core Design Principles

- Modern Healthcare
- Clean
- Trustworthy
- Professional
- User-friendly
- Distinctive
- Purpose-driven

### 1.2. Design Goals

Giao diện phải:

- Tạo cảm giác đáng tin cậy và chuyên nghiệp.
- Giúp người dùng tiếp cận thông tin nhanh chóng.
- Hỗ trợ các nghiệp vụ nhà thuốc một cách rõ ràng.
- Có cấu trúc thông tin hợp lý.
- Giảm thao tác không cần thiết.
- Duy trì nhận diện thương hiệu nhất quán.
- Có đặc điểm thiết kế phù hợp với từng nhóm người dùng.

### 1.3. Design Philosophy

Không thiết kế website theo kiểu template thương mại điện tử đại trà.

Mỗi trang phải có bố cục phù hợp với mục đích sử dụng thực tế.

Tính nhất quán của thương hiệu không đồng nghĩa với việc mọi trang phải có cùng một bố cục.

---

# 2. BRAND IDENTITY

**Brand name:** Lan Yến Pharmacy

**Industry:** Pharmacy and Pharmaceutical Retail

### 2.1. Brand Personality

- Hiện đại.
- Chuyên nghiệp.
- Tối giản có chủ đích.
- Thân thiện.
- Đáng tin cậy.
- Rõ ràng.

### 2.2. Brand Colors

Màu nhận diện chính:

- Green
- White

Màu xanh lá là yếu tố nhận diện thương hiệu, nhưng không được sử dụng quá mức trên toàn bộ giao diện.

### 2.3. Visual Identity

Các yếu tố thị giác cần thể hiện:

- Sự sạch sẽ.
- Tính chuyên nghiệp.
- Sự rõ ràng.
- Tính chính xác.
- Cảm giác an tâm khi sử dụng dịch vụ nhà thuốc.

Không sử dụng hình ảnh, biểu tượng hoặc hiệu ứng khiến thương hiệu mất đi tính chuyên nghiệp.

---

# 3. COLOR SYSTEM

Tất cả màu sắc phải được quản lý thông qua Design Tokens.

Không tự ý tạo thêm màu thương hiệu hoặc thay đổi bảng màu chính.

## 3.1. Brand Colors

| Token | Value | Purpose |
|---|---|---|
| Primary | `#16865B` | Màu thương hiệu |
| Primary Dark | `#106B48` | Hover, trạng thái nhấn |
| Primary Light | `#E8F5EE` | Nền nhấn nhẹ |

## 3.2. Background Colors

| Token | Value | Purpose |
|---|---|---|
| White | `#FFFFFF` | Bề mặt |
| Background | `#F5F7F6` | Nền tổng thể |
| Surface | `#FFFFFF` | Khu vực nội dung |

## 3.3. Text Colors

| Token | Value | Purpose |
|---|---|---|
| Text | `#333333` | Nội dung chính |
| Text Secondary | `#767676` | Nội dung phụ |
| Text Light | `#FFFFFF` | Chữ trên nền tối |

## 3.4. Status Colors

| Token | Value | Purpose |
|---|---|---|
| Success | `#28A745` | Thành công |
| Warning | `#FFC107` | Cảnh báo |
| Danger | `#DC3545` | Lỗi, nguy hiểm |
| Info | `#17A2B8` | Thông tin |

## 3.5. Status Color Usage

Màu trạng thái phải được sử dụng đúng ngữ nghĩa.

Không mặc định sử dụng màu trạng thái làm màu chữ trên nền trắng.

Quy tắc:

- Success: có thể sử dụng nền xanh nhạt và chữ xanh đậm.
- Warning: ưu tiên nền vàng nhạt và chữ tối.
- Danger: ưu tiên nền đỏ nhạt và chữ đỏ đậm.
- Info: ưu tiên nền xanh nhạt và chữ xanh đậm.

Khi cần màu chữ trạng thái, có thể sử dụng biến thể tối hơn phù hợp với yêu cầu tương phản. Những biến thể này là màu chức năng, không phải màu thương hiệu mới.

Không dùng màu sắc làm phương tiện duy nhất để truyền đạt trạng thái.

## 3.6. Color Accessibility

Đối với văn bản thông thường:

- Tối thiểu WCAG AA: 4.5:1.

Đối với văn bản lớn:

- Tối thiểu WCAG AA: 3:1.

Đối với các thành phần giao diện và biểu tượng cần thiết để nhận biết trạng thái:

- Tối thiểu 3:1 so với màu liền kề theo yêu cầu tương ứng của WCAG.

Không sử dụng màu có độ tương phản thấp cho nội dung quan trọng.

## 3.7. Color Rules

- Xanh lá là màu nhận diện, không phải màu phủ toàn bộ giao diện.
- Trắng và xám nhạt là các màu nền chủ đạo.
- Không lạm dụng màu xanh trong mọi thành phần.
- Màu trạng thái phải sử dụng đúng ngữ nghĩa.
- Đảm bảo độ tương phản và khả năng đọc.
- Không tự ý thêm màu thương hiệu mới.
- Không hardcode màu thương hiệu lặp đi lặp lại trong CSS.

---

# 4. TYPOGRAPHY

## 4.1. Font Family

Font mặc định:

`Arial, sans-serif`

Ưu tiên khả năng đọc, tính ổn định và sự tương thích trên nhiều thiết bị.

Không tự ý thêm font bên ngoài nếu chưa có lý do thiết kế rõ ràng.

## 4.2. Font Size

| Token | Size |
|---|---:|
| XS | 12px |
| SM | 14px |
| MD | 16px |
| LG | 20px |
| XL | 24px |
| 2XL | 30px |

## 4.3. Typography Rules

- Phân cấp tiêu đề rõ ràng.
- Nội dung phải dễ đọc.
- Không sử dụng quá nhiều kiểu chữ trong một trang.
- Không lạm dụng chữ in hoa.
- Không sử dụng font trang trí thiếu chuyên nghiệp.
- Không sử dụng kích thước chữ quá nhỏ cho thông tin quan trọng.
- Không tạo quá nhiều cấp độ tiêu đề không cần thiết.

## 4.4. Line Height

Quy tắc tham khảo:

| Content Type | Line Height |
|---|---:|
| Heading | 1.2–1.4 |
| Body | 1.5–1.7 |
| Small Text | 1.4–1.5 |

Line height có thể điều chỉnh theo nội dung và kích thước chữ thực tế.

---

# 5. SPACING SYSTEM

Sử dụng hệ thống khoảng cách thống nhất.

| Token | Value |
|---|---:|
| XS | 4px |
| SM | 8px |
| MD | 16px |
| LG | 24px |
| XL | 32px |
| 2XL | 48px |

### 5.1. Spacing Rules

- Spacing phải có chủ đích.
- Không sử dụng khoảng cách tùy tiện.
- Các thành phần liên quan cần có khoảng cách gần nhau hơn các nhóm nội dung độc lập.
- Khoảng cách giữa các khu vực lớn phải thể hiện rõ phân cấp nội dung.
- Không sử dụng quá nhiều khoảng trắng khiến thông tin bị phân tán.
- Không nhồi nhét quá nhiều nội dung trong một khu vực.

---

# 6. BORDER RADIUS

| Token | Value |
|---|---:|
| SM | 4px |
| MD | 8px |
| LG | 12px |
| XL | 16px |

### Border Radius Rules

- Không bo tròn mọi thành phần một cách máy móc.
- Lựa chọn radius phù hợp với từng loại thành phần.
- Các thành phần cùng nhóm nên có quy tắc nhất quán.
- Không sử dụng radius quá lớn nếu không có mục đích thiết kế rõ ràng.

---

# 7. SHADOW SYSTEM

| Token | Value |
|---|---|
| SM | `0 2px 5px rgba(0, 0, 0, 0.08)` |
| MD | `0 4px 12px rgba(0, 0, 0, 0.12)` |
| LG | `0 8px 24px rgba(0, 0, 0, 0.12)` |

### Shadow Rules

- Ưu tiên bóng đổ nhẹ.
- Không lạm dụng shadow để tạo chiều sâu giả tạo.
- Chỉ sử dụng shadow khi cần phân biệt các lớp giao diện.
- Không sử dụng shadow giống nhau cho tất cả thành phần.
- Có thể sử dụng border thay cho shadow khi phù hợp hơn.

---

# 8. LAYOUT SYSTEM

Layout phải phục vụ nội dung và hành vi của người dùng.

Không áp dụng một bố cục cố định cho tất cả trang.

## 8.1. Layout Principles

- Ưu tiên cấu trúc rõ ràng.
- Xác định nội dung quan trọng nhất trước khi chọn layout.
- Tạo phân cấp giữa các khu vực nội dung.
- Giữ sự cân bằng giữa mật độ thông tin và khoảng trắng.
- Không ép mọi trang vào cùng một cấu trúc.

## 8.2. Content Width

Chiều rộng nội dung cần phù hợp với từng loại trang.

Nguyên tắc:

- Trang danh sách có thể sử dụng không gian ngang rộng hơn.
- Trang biểu mẫu cần giới hạn chiều rộng để dễ đọc và thao tác.
- Trang chi tiết cần bố trí nội dung theo mức độ quan trọng.
- Trang giới thiệu hoặc nội dung dài cần kiểm soát chiều rộng dòng chữ.

Không bắt buộc mọi trang sử dụng cùng một `max-width`.

## 8.3. Grid System

Có thể sử dụng CSS Grid hoặc Flexbox tùy theo bố cục.

Không bắt buộc mọi trang phải sử dụng cùng số cột.

Số cột phải dựa trên:

- Loại nội dung.
- Kích thước màn hình.
- Mức độ ưu tiên thông tin.
- Khả năng thao tác của người dùng.

## 8.4. Layout Consistency

Các trang thuộc cùng một khu vực nghiệp vụ cần duy trì những yếu tố chung phù hợp.

Tuy nhiên, không được hy sinh tính phù hợp của trang chỉ để đạt sự đồng nhất hình thức.

---

# 9. RESPONSIVE DESIGN

Giao diện phải hoạt động tốt trên:

- Desktop.
- Laptop.
- Tablet.
- Mobile.

## 9.1. Responsive Principles

Không chỉ thu nhỏ giao diện Desktop để tạo phiên bản Mobile.

Cần xem xét lại:

- Thứ tự nội dung.
- Cách điều hướng.
- Cách hiển thị thông tin.
- Kích thước thành phần tương tác.
- Cách trình bày bảng dữ liệu.
- Cách nhập liệu.
- Mật độ nội dung.

## 9.2. Breakpoint Reference

Các breakpoint tham khảo:

| Device | Width |
|---|---:|
| Small Mobile | 320px–374px |
| Mobile | 375px–767px |
| Tablet | 768px–1023px |
| Desktop | 1024px–1439px |
| Large Desktop | 1440px trở lên |

Có thể điều chỉnh breakpoint theo nội dung thực tế.

Không bắt buộc phải sử dụng tất cả breakpoint nếu không cần thiết.

## 9.3. Mobile Requirements

- Không xuất hiện cuộn ngang ngoài những khu vực được thiết kế có chủ đích.
- Nội dung quan trọng phải dễ tiếp cận.
- Các thao tác chính phải thuận tiện trên màn hình cảm ứng.
- Không để các nút hoặc liên kết quá sát nhau.
- Bảng dữ liệu phải có phương án hiển thị phù hợp.
- Không ẩn thông tin quan trọng chỉ để giao diện trông gọn hơn.

---

# 10. COMPONENT DESIGN SYSTEM

Component dùng chung phải có chức năng rõ ràng và được sử dụng nhất quán.

Không tạo component dùng chung chỉ vì hai khu vực có hình thức tương tự nhưng bản chất nghiệp vụ khác nhau.

## 10.1. Buttons

Các loại button có thể bao gồm:

- Primary.
- Secondary.
- Outline.
- Text.
- Danger.
- Icon Button.

Quy tắc:

- Nội dung hoặc nhãn phải rõ ràng.
- Phân biệt hành động chính và hành động phụ.
- Có trạng thái hover, focus, active và disabled khi phù hợp.
- Không sử dụng nhiều nút chính cạnh tranh trong cùng một khu vực.
- Hành động nguy hiểm cần được thể hiện rõ ràng.

## 10.2. Form Controls

Bao gồm:

- Input.
- Textarea.
- Select.
- Checkbox.
- Radio.
- File Input.

Quy tắc:

- Có label phù hợp.
- Có trạng thái focus.
- Có trạng thái disabled khi cần.
- Có thông báo lỗi rõ ràng.
- Có hướng dẫn nhập liệu khi cần.
- Không chỉ sử dụng placeholder thay cho label.
- Không làm mất dữ liệu người dùng khi xảy ra lỗi xác thực.

## 10.3. Tables

Bảng dữ liệu cần:

- Có tiêu đề cột rõ ràng.
- Có cấu trúc semantic HTML.
- Có cách hiển thị phù hợp trên màn hình nhỏ.
- Có trạng thái dữ liệu rỗng.
- Có trạng thái loading và error khi cần.
- Không nhồi nhét quá nhiều thông tin vào một hàng.

Chỉ sử dụng bảng khi dữ liệu thực sự cần được so sánh theo hàng và cột.

## 10.4. Status Badges

Badge dùng để biểu thị trạng thái hoặc phân loại.

Quy tắc:

- Nội dung ngắn gọn.
- Màu sắc đúng ngữ nghĩa.
- Có chữ hoặc biểu tượng hỗ trợ.
- Không sử dụng badge chỉ để trang trí.
- Không tạo quá nhiều biến thể không cần thiết.

## 10.5. Modal and Dialog

- Chỉ sử dụng khi cần một tương tác tập trung.
- Không dùng modal cho mọi thông báo.
- Có tiêu đề và hành động rõ ràng.
- Hỗ trợ bàn phím.
- Quản lý focus hợp lý.
- Cho phép đóng theo cách phù hợp.
- Hạn chế xếp chồng nhiều modal.

## 10.6. Toast and Notifications

- Nội dung ngắn gọn.
- Thông báo đúng ngữ cảnh.
- Phân biệt thành công, cảnh báo, lỗi và thông tin.
- Không sử dụng thông báo tự biến mất cho lỗi quan trọng cần người dùng xử lý.
- Không làm gián đoạn các thao tác không liên quan.

## 10.7. Component States

Các component cần có trạng thái phù hợp:

- Default.
- Hover.
- Focus.
- Active.
- Disabled.
- Loading.
- Error.
- Success.

Không bắt buộc mọi component có đầy đủ tất cả trạng thái nếu không phù hợp với chức năng.

---

# 11. INTERACTION & MOTION

## 11.1. Transitions

| Token | Value |
|---|---|
| Fast | `0.2s ease` |
| Normal | `0.3s ease` |

## 11.2. Interaction Principles

- Phản hồi sau thao tác phải rõ ràng.
- Trạng thái tương tác phải dễ nhận biết.
- Không tạo hiệu ứng gây mất tập trung.
- Không sử dụng animation chỉ để trang trí.
- Không làm chậm các thao tác quan trọng.

## 11.3. Loading States

Khi hệ thống đang xử lý:

- Hiển thị trạng thái đang tải khi cần.
- Ngăn thao tác lặp lại nếu hành động không thể thực hiện đồng thời.
- Không tạo cảm giác hệ thống bị treo.
- Giữ lại nội dung hiện có khi phù hợp.
- Cung cấp phản hồi khi xử lý hoàn tất hoặc thất bại.

## 11.4. Reduced Motion

Phải tôn trọng tùy chọn giảm chuyển động của hệ điều hành thông qua:

`prefers-reduced-motion`

Không phụ thuộc vào animation để truyền đạt thông tin hoặc trạng thái quan trọng.

---

# 12. ACCESSIBILITY

Mục tiêu: WCAG 2.2 Level AA.

## 12.1. Basic Requirements

- Đảm bảo độ tương phản màu sắc.
- Có trạng thái focus dễ nhận biết.
- Các nút phải có nội dung hoặc nhãn rõ ràng.
- Không chỉ dùng màu sắc để biểu thị trạng thái.
- Form phải có nhãn phù hợp.
- Hỗ trợ thao tác bàn phím.
- Sử dụng semantic HTML.
- Duy trì thứ tự focus hợp lý.
- Hỗ trợ nội dung trên nhiều kích thước màn hình.

## 12.2. Keyboard Accessibility

Các chức năng quan trọng phải sử dụng được bằng bàn phím.

Không tạo thành phần tương tác tùy chỉnh nếu HTML native đã đáp ứng nhu cầu.

## 12.3. Focus Management

- Focus indicator phải dễ nhìn.
- Không loại bỏ outline nếu không có phương án thay thế phù hợp.
- Dialog cần quản lý focus.
- Không để người dùng bàn phím bị mắc kẹt ngoài chủ đích.
- Nội dung cập nhật động cần thông báo phù hợp khi cần.

## 12.4. Form Accessibility

- Mỗi trường nhập liệu cần có label.
- Lỗi phải được mô tả bằng văn bản.
- Liên kết thông báo lỗi với trường nhập liệu tương ứng.
- Không chỉ sử dụng màu để đánh dấu lỗi.
- Không xóa dữ liệu đã nhập khi xảy ra lỗi không cần thiết.

## 12.5. Detailed Guidance

Tuân thủ thêm:

`.agents/skills/accessibility/SKILL.md`

Không tự ý hạ thấp tiêu chuẩn accessibility để đổi lấy giao diện đẹp hơn.

---

# 13. NON-GENERIC UI RULES

Đây là nhóm quy tắc bắt buộc.

## 13.1. Không sử dụng giao diện đại trà

Agent không được:

- Lấy template có sẵn rồi chỉ đổi màu.
- Lặp lại một bố cục cho tất cả các trang.
- Mặc định sử dụng Dashboard Card Grid.
- Mặc định sử dụng Sidebar + Header + Card.
- Tạo Hero Section chỉ để lấp đầy không gian.
- Thêm biểu đồ, thẻ thống kê hoặc hiệu ứng không có giá trị sử dụng.
- Sử dụng các bố cục phổ biến mà không đánh giá sự phù hợp.
- Tạo giao diện chỉ để bắt chước một website tham khảo.

Các pattern phổ biến vẫn được phép sử dụng khi chúng thực sự phù hợp với mục đích và nghiệp vụ.

## 13.2. Thiết kế theo mục đích

Trước khi thiết kế một trang, Agent phải xác định:

1. Trang này phục vụ mục đích gì?
2. Ai là người sử dụng?
3. Những thông tin nào quan trọng nhất?
4. Hành động chính của người dùng là gì?
5. Cách trình bày nào phù hợp nhất?
6. Có thể tạo điểm khác biệt nào mà không ảnh hưởng trải nghiệm?
7. Những trạng thái giao diện nào cần được thiết kế?

## 13.3. Tính độc đáo

- Mỗi trang cần có đặc điểm bố cục phù hợp với chức năng riêng.
- Không bắt buộc mọi trang phải khác nhau hoàn toàn.
- Không sao chép bố cục một cách máy móc.
- Không dùng cùng một cấu trúc cho những trang có mục đích khác nhau.
- Tính độc đáo phải đến từ cách tổ chức nội dung và trải nghiệm, không chỉ từ trang trí.

## 13.4. Tính thực tiễn

Không hy sinh khả năng sử dụng để đổi lấy vẻ ngoài.

Giao diện đẹp nhưng khó thao tác không được xem là giao diện đạt yêu cầu.

## 13.5. Design Review

Trước khi hoàn thành, Agent phải tự đánh giá:

- Bố cục có phù hợp với nghiệp vụ không?
- Có thành phần nào không cần thiết không?
- Trang có quá giống một template mặc định không?
- Thông tin quan trọng có dễ tìm không?
- Người dùng có thể hoàn thành tác vụ thuận tiện không?
- Giao diện có giữ đúng nhận diện thương hiệu không?

---

# 14. PHARMACY-SPECIFIC UI PATTERNS

Giao diện phải phản ánh đặc thù của hệ thống nhà thuốc, không chỉ là một website bán hàng thông thường.

Các quy tắc dưới đây hướng dẫn cách trình bày giao diện, không tự tạo thêm nghiệp vụ.

## 14.1. Medicine Information

Khi hiển thị thông tin thuốc:

- Tên thuốc phải dễ nhận biết.
- Phân cấp thông tin rõ ràng.
- Thông tin quan trọng không bị lẫn với nội dung phụ.
- Không sử dụng hình ảnh thay thế cho thông tin văn bản cần thiết.
- Không tự ý tạo thông tin công dụng, liều dùng hoặc chỉ định chưa có trong dữ liệu được duyệt.
- Phân biệt rõ thông tin sản phẩm và thông tin lô thuốc khi nghiệp vụ yêu cầu.

## 14.2. Medicine Images

- Hình ảnh cần rõ ràng.
- Tỷ lệ hiển thị nhất quán trong cùng một nhóm.
- Không kéo giãn làm biến dạng bao bì.
- Có phương án hiển thị khi hình ảnh không tồn tại.
- Không sử dụng hình ảnh gây hiểu nhầm về sản phẩm.

## 14.3. Inventory and Batch Information

Khi trình bày thông tin tồn kho hoặc lô thuốc:

- Các thông tin liên quan phải được nhóm hợp lý.
- Trạng thái cần dễ nhận biết.
- Thông tin số lượng, hạn sử dụng và ngày tháng phải dễ đọc.
- Không dùng màu sắc làm phương tiện duy nhất để biểu thị tình trạng.
- Không tạo thêm trường dữ liệu hoặc nghiệp vụ chưa được phê duyệt.

## 14.4. Order Information

Khi hiển thị đơn hàng:

- Mã đơn hàng cần dễ nhận biết.
- Trạng thái đơn hàng phải rõ ràng.
- Thông tin sản phẩm và số lượng cần dễ đối chiếu.
- Thông tin tổng tiền phải có phân cấp trực quan.
- Các hành động liên quan đến đơn hàng cần rõ ràng.
- Không hiển thị các thao tác mà người dùng không có quyền thực hiện.

## 14.5. Customer and Employee Information

- Thông tin cá nhân cần được trình bày có trật tự.
- Không hiển thị thông tin nhạy cảm không cần thiết.
- Các thao tác quản lý phải phù hợp với vai trò người dùng.
- Trạng thái và quyền truy cập phải dễ phân biệt.

## 14.6. Pharmacy Forms

Các biểu mẫu liên quan đến thuốc, lô thuốc, đơn hàng, người dùng và khuyến mãi cần:

- Có nhãn rõ ràng.
- Nhóm trường theo nghiệp vụ.
- Đánh dấu trường bắt buộc và tùy chọn đúng theo quy định.
- Hiển thị lỗi gần trường nhập liệu.
- Không tự ý thay đổi quy tắc nhập liệu đã được phê duyệt.

## 14.7. Business Accuracy

Không được dùng thiết kế giao diện để ngụ ý một nghiệp vụ hoặc trạng thái mà hệ thống không thực sự hỗ trợ.

---

# 15. AGENT DESIGN WORKFLOW

Trước khi viết giao diện, Agent phải thực hiện:

## Phase 1: Analyze

Phân tích:

- Mục đích trang.
- Nhóm người dùng.
- Nghiệp vụ liên quan.
- Thông tin quan trọng.
- Hành động chính.
- Các trạng thái giao diện.

## Phase 2: Research Existing Project

- Đọc `AGENTS.md`.
- Đọc `docs/DESIGN_SYSTEM.md`.
- Đọc `.agents/skills/pharmacy-project/SKILL.md`.
- Đọc Skill thiết kế và phát triển frontend phù hợp.
- Kiểm tra các trang và component hiện có.
- Kiểm tra các CSS tokens đang sử dụng.

Không tự ý bỏ qua cấu trúc hiện tại để tạo một giao diện độc lập không phù hợp.

## Phase 3: Design

- Chọn bố cục phù hợp với mục đích.
- Xác định thứ tự thông tin.
- Xác định cách điều hướng.
- Xác định responsive behavior.
- Xác định trạng thái tương tác.
- Tránh sử dụng template mặc định.

## Phase 4: Implement

Triển khai bằng:

- HTML.
- CSS.
- JavaScript.

Tuân thủ kiến trúc frontend hiện tại và sử dụng Design Tokens.

Không tự ý thêm framework hoặc thư viện.

## Phase 5: Review

Kiểm tra:

- Bố cục.
- Màu sắc.
- Typography.
- Spacing.
- Responsive.
- Khả năng sử dụng.
- Accessibility.
- Tính nhất quán.
- Mức độ phù hợp với thương hiệu.
- Tính đặc thù của trang.

## Phase 6: Refine

Sửa những điểm chưa đạt trước khi hoàn thành.

Không thêm hiệu ứng hoặc thành phần trang trí chỉ để làm giao diện phức tạp hơn.

## Phase 7: Report

Báo cáo:

- Trang hoặc component đã thay đổi.
- Những quyết định thiết kế chính.
- Các trạng thái đã triển khai.
- Kích thước màn hình đã kiểm tra.
- Các vấn đề còn tồn tại.

---

# 16. DESIGN ACCEPTANCE CRITERIA

Một giao diện chỉ được xem là hoàn thành khi đáp ứng các yêu cầu phù hợp với phạm vi công việc:

### Brand and Design

- Tuân thủ Design System.
- Sử dụng đúng Green 1.0.
- Có typography và spacing rõ ràng.
- Phù hợp với nghiệp vụ.
- Không mang tính template đại trà.
- Có bố cục phù hợp với chức năng riêng.

### Usability

- Thông tin dễ tìm.
- Hành động rõ ràng.
- Trạng thái tương tác phù hợp.
- Không có thành phần trang trí thừa.
- Không gây nhầm lẫn về nghiệp vụ.

### Responsive

- Hoạt động tốt trên các kích thước màn hình phù hợp.
- Không có lỗi tràn nội dung ngoài chủ đích.
- Các thao tác chính sử dụng được trên thiết bị cảm ứng.

### Accessibility

- Đáp ứng các tiêu chí WCAG 2.2 AA áp dụng.
- Có khả năng thao tác bằng bàn phím.
- Có focus indicator.
- Có nhãn và thông báo lỗi phù hợp.
- Đảm bảo độ tương phản cần thiết.

### Technical

- Không làm thay đổi nghiệp vụ ngoài yêu cầu.
- Không làm hỏng chức năng hiện có.
- Không thêm framework hoặc thư viện chưa được duyệt.
- Không tạo CSS trùng lặp không cần thiết.
- Đã kiểm tra các chức năng bị ảnh hưởng.

Không được tuyên bố giao diện đạt toàn bộ tiêu chí nếu chưa thực hiện kiểm tra tương ứng.

---

# 17. FINAL PRINCIPLE

Consistency does not mean every page must look the same.

Lan Yến Pharmacy must maintain a consistent brand identity while allowing each page to have its own purposeful visual structure.

Design with intention.

Build with identity.

Prioritize usability.

Respect the pharmacy business.

Never design by template alone.