import 'package:flutter/material.dart';

import '../../core/theme/app_colors.dart';

import 'dart:async';
import 'dart:math' as math;

import '../../models/catalog.dart';
import 'customer_components.dart';
import 'customer_product_widgets.dart';
import 'customer_home_controller.dart';

class HomeColors {
  HomeColors._();
  // Vòng xanh xuất hiện khi kéo trang chủ xuống để tải lại dữ liệu.
  static const homeRefreshForeground = AppColors.primary;
  // Nền vòng tải lại; null giữ nguyên màu Theme/SDK hiện tại.
  static const Color? homeRefreshBackground = null;
  // Chữ PHARMACY ngay dưới Lan Yến trong cụm nhận diện ở chính giữa.
  static const headerSubtitle = AppColors.primaryDark;
  // Chữ ngày/giờ/phút/giây nằm dưới từng ô số đếm ngược.
  static const countdownUnit = AppColors.primaryDark;
  // Chữ tiêu đề của khung Ưu đãi từ Lan Yến.
  static const promotionTitle = AppColors.textPrimary;

  // Màu đường viền của khung Ưu đãi từ Lan Yến.
  static final promotionBorder = AppColors.primaryDark.withValues(alpha: .24);

  // Màu biểu tượng của khung Ưu đãi từ Lan Yến.
  static const promotionIcon = AppColors.primaryDark;

  // Màu nền của khung Ưu đãi từ Lan Yến.
  static const promotionBackground = AppColors.primaryLight;

  // Màu nền của ô số của đồng hồ đếm ngược.
  static const countdownCellBackground = AppColors.surface;

  // Màu nhãn của đồng hồ Bắt đầu sau/Kết thúc sau.
  static const countdownLabel = AppColors.primaryDark;

  // Màu chữ số của đồng hồ Bắt đầu sau/Kết thúc sau.
  static const countdownDigit = AppColors.primaryDark;

  // Màu nền của thẻ chương trình đang diễn ra chưa được chọn.
  static const activeProgramBackground = AppColors.surface;

  // Màu nền của thẻ chương trình đang diễn ra mà bạn đang chọn.
  static const activeProgramSelectedBackground = AppColors.primaryDark;

  // Chữ tiêu đề của thẻ chương trình đang diễn ra chưa được chọn.
  static const activeProgramTitle = AppColors.primaryDark;

  // Chữ khoảng ngày áp dụng của thẻ chương trình đang diễn ra chưa được chọn.
  static const activeProgramDates = AppColors.primaryDark;

  // Chữ Đang diễn ra/Sắp diễn ra của thẻ chương trình đang diễn ra chưa được chọn.
  static const activeProgramStatus = AppColors.primaryDark;

  // Chữ tiêu đề của thẻ chương trình đang diễn ra mà bạn đang chọn.
  static const activeProgramSelectedTitle = AppColors.surface;

  // Chữ khoảng ngày áp dụng của thẻ chương trình đang diễn ra mà bạn đang chọn.
  static const activeProgramSelectedDates = AppColors.surface;

  // Chữ Đang diễn ra/Sắp diễn ra của thẻ chương trình đang diễn ra mà bạn đang chọn.
  static const activeProgramSelectedStatus = AppColors.surface;

  // Màu nền của thẻ chương trình sắp diễn ra chưa được chọn.
  static const upcomingProgramBackground = AppColors.warningBackground;

  // Màu nền của thẻ chương trình sắp diễn ra mà bạn đang chọn.
  static const upcomingProgramSelectedBackground = AppColors.warning;

  // Chữ tiêu đề của thẻ chương trình sắp diễn ra chưa được chọn.
  static const upcomingProgramTitle = AppColors.warning;

  // Chữ khoảng ngày áp dụng của thẻ chương trình sắp diễn ra chưa được chọn.
  static const upcomingProgramDates = AppColors.warning;

  // Chữ Đang diễn ra/Sắp diễn ra của thẻ chương trình sắp diễn ra chưa được chọn.
  static const upcomingProgramStatus = AppColors.warning;

  // Chữ tiêu đề của thẻ chương trình sắp diễn ra mà bạn đang chọn.
  static const upcomingProgramSelectedTitle = AppColors.surface;

  // Chữ khoảng ngày áp dụng của thẻ chương trình sắp diễn ra mà bạn đang chọn.
  static const upcomingProgramSelectedDates = AppColors.surface;

  // Chữ Đang diễn ra/Sắp diễn ra của thẻ chương trình sắp diễn ra mà bạn đang chọn.
  static const upcomingProgramSelectedStatus = AppColors.surface;

  // Hiệu ứng khi bấm của thẻ chọn chương trình khuyến mãi. Null giữ nguyên màu Theme/SDK.
  static const Color? programPressed = null;

  // Màu khi nhận focus bàn phím của thẻ chọn chương trình khuyến mãi. Null giữ nguyên màu Theme/SDK.
  static const Color? programFocus = null;

  // Màu khi trỏ chuột của thẻ chọn chương trình khuyến mãi. Null giữ nguyên màu Theme/SDK.
  static const Color? programHover = null;

  // Màu nền của hộp hiện tên chương trình khi nhấn giữ. Null giữ nguyên màu Theme/SDK.
  static const Color? programTooltipBackground = null;

  // Màu chữ của hộp hiện tên chương trình khi nhấn giữ. Null giữ nguyên màu Theme/SDK.
  static const Color? programTooltipText = null;

  // Chữ tiêu đề của khối danh mục sản phẩm.
  static const categoryTitle = AppColors.textPrimary;

  // Màu nền của khối danh mục sản phẩm.
  static const categoryBackground = AppColors.surface;

  // Màu biểu tượng của khối danh mục sản phẩm.
  static const categoryIcon = AppColors.primaryDark;

  // Màu chữ của khối danh mục sản phẩm.
  static const categoryText = AppColors.textPrimary;

  // Chữ khi bị vô hiệu hóa của nút Xem thêm/Thu gọn danh mục. Null giữ nguyên màu Theme/SDK.
  static const Color? expandDisabledText = null;

  // Nền khi bị vô hiệu hóa của nút Xem thêm/Thu gọn danh mục. Null giữ nguyên màu Theme/SDK.
  static const Color? expandDisabledBackground = null;

  // Lớp màu khi nhấn/focus/hover của nút Xem thêm/Thu gọn danh mục. Null giữ nguyên màu Theme/SDK.
  static const Color? expandOverlay = null;

  // Màu bóng của nút Xem thêm/Thu gọn danh mục. Null giữ nguyên màu Theme/SDK.
  static const Color? expandShadow = null;

  // Sắc phủ bề mặt của nút Xem thêm/Thu gọn danh mục. Null giữ nguyên màu Theme/SDK.
  static const Color? expandSurfaceTint = null;

  // Chữ/biểu tượng của nút Xem thêm/Thu gọn danh mục. Null giữ nguyên màu Theme/SDK.
  static const Color? expandForeground = null;

  // Màu nền của nút Xem thêm/Thu gọn danh mục. Null giữ nguyên màu Theme/SDK.
  static const Color? expandBackground = null;

  // Hiệu ứng khi bấm của khối danh mục sản phẩm. Null giữ nguyên màu Theme/SDK.
  static const Color? categoryPressed = null;

  // Màu khi nhận focus bàn phím của khối danh mục sản phẩm. Null giữ nguyên màu Theme/SDK.
  static const Color? categoryFocus = null;

  // Màu khi trỏ chuột của khối danh mục sản phẩm. Null giữ nguyên màu Theme/SDK.
  static const Color? categoryHover = null;

  // Màu nhấn giữ của khối danh mục sản phẩm. Null giữ nguyên màu Theme/SDK.
  static const Color? categoryHighlight = null;

  // Màu nền của cụm logo và tên nhà thuốc ở đầu trang.
  static const headerBackground = AppColors.surface;

  // Chữ tiêu đề của cụm logo và tên nhà thuốc ở đầu trang.
  static const headerTitle = AppColors.primaryDark;

  // Màu đường viền của thanh tìm kiếm ở đầu trang.
  static const searchBorder = AppColors.textSecondary;

  // Màu nền của nút mũi tên đóng tìm kiếm.
  static const searchBackground = AppColors.background;

  // Màu hiển thị của thanh tìm kiếm ở đầu trang.
  static const searchContainer = AppColors.surface;

  // Màu đường viền của thanh tìm kiếm ở đầu trang.
  static const searchFocusBorder = AppColors.primaryDark;

  // Màu chữ của thanh tìm kiếm ở đầu trang.
  static const searchText = AppColors.textPrimary;

  // Màu nhãn của thanh tìm kiếm ở đầu trang.
  static const searchLabel = AppColors.textSecondary;

  // Màu nhãn của thanh tìm kiếm ở đầu trang.
  static const searchFocusedLabel = AppColors.primary;

  // Con trỏ nhập chữ của thanh tìm kiếm ở đầu trang.
  static const searchCursor = AppColors.primary;

  // Màu lỗi của thanh tìm kiếm ở đầu trang.
  static const searchError = AppColors.error;

  // Màu biểu tượng của thanh tìm kiếm ở đầu trang. Null giữ nguyên màu Theme/SDK.
  static const Color? searchPrefixIcon = null;

  // Chữ/biểu tượng của nút mũi tên gửi tìm kiếm. Null giữ nguyên màu Theme/SDK.
  static const Color? searchActionForeground = null;

  // Chữ khi bị vô hiệu hóa của nút mũi tên gửi tìm kiếm. Null giữ nguyên màu Theme/SDK.
  static const Color? searchActionDisabledText = null;

  // Nền khi bị vô hiệu hóa của nút mũi tên gửi tìm kiếm. Null giữ nguyên màu Theme/SDK.
  static const Color? searchActionDisabledBackground = null;

  // Lớp màu khi nhấn/focus/hover của nút mũi tên gửi tìm kiếm. Null giữ nguyên màu Theme/SDK.
  static const Color? searchActionOverlay = null;

  // Màu bóng của nút mũi tên gửi tìm kiếm. Null giữ nguyên màu Theme/SDK.
  static const Color? searchActionShadow = null;

  // Sắc phủ bề mặt của nút mũi tên gửi tìm kiếm. Null giữ nguyên màu Theme/SDK.
  static const Color? searchActionSurfaceTint = null;

  // Chữ/biểu tượng của nút mũi tên đóng tìm kiếm. Null giữ nguyên màu Theme/SDK.
  static const Color? searchBackForeground = null;

  // Màu nền của nút mũi tên đóng tìm kiếm. Null giữ nguyên màu Theme/SDK.
  static const Color? searchBackBackground = null;

  // Chữ khi bị vô hiệu hóa của nút mũi tên đóng tìm kiếm. Null giữ nguyên màu Theme/SDK.
  static const Color? searchBackDisabledText = null;

  // Nền khi bị vô hiệu hóa của nút mũi tên đóng tìm kiếm. Null giữ nguyên màu Theme/SDK.
  static const Color? searchBackDisabledBackground = null;

  // Lớp màu khi nhấn/focus/hover của nút mũi tên đóng tìm kiếm. Null giữ nguyên màu Theme/SDK.
  static const Color? searchBackOverlay = null;

  // Màu bóng của nút mũi tên đóng tìm kiếm. Null giữ nguyên màu Theme/SDK.
  static const Color? searchBackShadow = null;

  // Màu hiển thị của nút mũi tên đóng tìm kiếm. Null giữ nguyên màu Theme/SDK.
  static const Color? searchBackTint = null;

  // Chữ thông điệp của banner lời chào của nhà thuốc.
  static const brandMessage = AppColors.primaryDark;

  // Màu nền của banner lời chào của nhà thuốc.
  static const brandBackground = AppColors.primaryLight;

  // Màu hiển thị của banner lời chào của nhà thuốc.
  static const brandPharmacist = AppColors.primaryDark;

  // Màu hiển thị của banner lời chào của nhà thuốc.
  static const brandCustomer = AppColors.warning;

  // Màu hiển thị của bong bóng trò chuyện trên banner.
  static const brandBubble = AppColors.surface;

  // Màu biểu tượng của bong bóng trò chuyện trên banner.
  static const brandBubbleIcon = AppColors.primaryDark;

  // Màu biểu tượng của khối bấm vào Tư vấn thuốc.
  static const consultPharmacistIcon = AppColors.warning;

  // Màu nền của khối bấm vào Tư vấn thuốc.
  static const consultBackground = AppColors.warningBackground;

  // Màu biểu tượng của khối bấm vào Tư vấn thuốc.
  static const consultChatIcon = AppColors.error;

  // Màu hiển thị của khối bấm vào Tư vấn thuốc.
  static const consultSubtitle = AppColors.textSecondary;

  // Hiệu ứng khi bấm của khối bấm vào Tư vấn thuốc. Null giữ nguyên màu Theme/SDK.
  static const Color? consultPressed = null;

  // Màu khi nhận focus bàn phím của khối bấm vào Tư vấn thuốc. Null giữ nguyên màu Theme/SDK.
  static const Color? consultFocus = null;

  // Màu khi trỏ chuột của khối bấm vào Tư vấn thuốc. Null giữ nguyên màu Theme/SDK.
  static const Color? consultHover = null;

  // Màu nhấn giữ của khối bấm vào Tư vấn thuốc. Null giữ nguyên màu Theme/SDK.
  static const Color? consultHighlight = null;

  // Chữ tiêu đề của khối bấm vào Tư vấn thuốc.
  static const consultTitle = AppColors.textPrimary;

  // Màu hiển thị của khối thông điệp nhà thuốc cuối trang.
  static const footerBody = AppColors.textSecondary;

  // Màu hiển thị của khối thông điệp nhà thuốc cuối trang.
  static const footerHeading = AppColors.primaryDark;

  // Màu biểu tượng của khối thông điệp nhà thuốc cuối trang.
  static const footerHeartIcon = AppColors.error;

  // Đường phân cách của khối thông điệp nhà thuốc cuối trang.
  static const footerDivider = AppColors.border;

  // Màu biểu tượng của khối thông điệp nhà thuốc cuối trang.
  static const footerLeafIcon = AppColors.primaryDark;

  // Chữ LAN YẾN PHARMACY nhỏ của khối thông điệp nhà thuốc cuối trang.
  static const footerEyebrow = AppColors.primaryDark;

  // Chữ câu nói cuối trang của khối thông điệp nhà thuốc cuối trang.
  static const footerTagline = AppColors.primaryDark;

  // Màu chữ của dòng Xin chào tên khách hàng.
  static const greetingText = AppColors.textPrimary;

  // Màu chữ của nút Đơn của tôi.
  static const ordersText = AppColors.primaryDark;

  // Màu biểu tượng của nút Đơn của tôi.
  static const ordersIcon = AppColors.primaryDark;

  // Chữ khi bị vô hiệu hóa của nút Đơn của tôi. Null giữ nguyên màu Theme/SDK.
  static const Color? ordersDisabledText = null;

  // Nền khi bị vô hiệu hóa của nút Đơn của tôi. Null giữ nguyên màu Theme/SDK.
  static const Color? ordersDisabledBackground = null;

  // Lớp màu khi nhấn/focus/hover của nút Đơn của tôi. Null giữ nguyên màu Theme/SDK.
  static const Color? ordersOverlay = null;

  // Màu bóng của nút Đơn của tôi. Null giữ nguyên màu Theme/SDK.
  static const Color? ordersShadow = null;

  // Sắc phủ bề mặt của nút Đơn của tôi. Null giữ nguyên màu Theme/SDK.
  static const Color? ordersSurfaceTint = null;

  // Màu nền của nút Đơn của tôi. Null giữ nguyên màu Theme/SDK.
  static const Color? ordersBackground = null;

  // Lớp màu khi nhấn/focus/hover của thẻ chọn chương trình khuyến mãi.
  static WidgetStateProperty<Color?> programOverlay(BuildContext context) =>
      WidgetStateProperty.resolveWith((states) {
        if (states.contains(WidgetState.pressed)) return programPressed;
        if (states.contains(WidgetState.focused)) return programFocus;
        if (states.contains(WidgetState.hovered)) return programHover;
        return null;
      });

  // Màu hiển thị của hộp hiện tên chương trình khi nhấn giữ. Null giữ nguyên màu Theme/SDK.
  static Decoration? programTooltipDecoration(BuildContext context) =>
      programTooltipBackground == null
      ? Theme.of(context).tooltipTheme.decoration
      : BoxDecoration(
          color: programTooltipBackground,
          borderRadius: BorderRadius.circular(4),
        );

  // Màu hiển thị của hộp hiện tên chương trình khi nhấn giữ. Null giữ nguyên màu Theme/SDK.
  static TextStyle? programTooltipTextStyle(BuildContext context) =>
      programTooltipText == null
      ? Theme.of(context).tooltipTheme.textStyle
      : (Theme.of(context).tooltipTheme.textStyle ??
                Theme.of(context).textTheme.bodyMedium)
            ?.copyWith(color: programTooltipText);

  // Màu hiển thị của nút mũi tên đóng tìm kiếm.
  static ButtonStyle searchBackStyle(BuildContext context) => _colors(
    const ButtonStyle().merge(Theme.of(context).iconButtonTheme.style),
    foreground: searchBackForeground,
    background: searchBackBackground,
    disabledText: searchBackDisabledText,
    disabledBackground: searchBackDisabledBackground,
    overlay: searchBackOverlay,
    shadow: searchBackShadow,
    tint: searchBackTint,
  );

  // Màu hiển thị của thành phần thông báo trên màn hình.
  static ButtonStyle _effectiveStyle(
    ButtonStyle defaults,
    ButtonStyle? themed,
  ) => themed?.merge(defaults) ?? defaults;

  // Màu hiển thị của thành phần thông báo trên màn hình. Null giữ nguyên màu Theme/SDK.
  static ButtonStyle _colors(
    ButtonStyle base, {
    Color? foreground,
    Color? background,
    Color? disabledText,
    Color? disabledBackground,
    Color? overlay,
    Color? shadow,
    Color? tint,
  }) => base.copyWith(
    foregroundColor: WidgetStateProperty.resolveWith(
      (states) => states.contains(WidgetState.disabled)
          ? disabledText ?? base.foregroundColor?.resolve(states)
          : foreground ?? base.foregroundColor?.resolve(states),
    ),
    backgroundColor: WidgetStateProperty.resolveWith(
      (states) => states.contains(WidgetState.disabled)
          ? disabledBackground ?? base.backgroundColor?.resolve(states)
          : background ?? base.backgroundColor?.resolve(states),
    ),
    overlayColor: overlay == null
        ? base.overlayColor
        : WidgetStatePropertyAll(overlay),
    shadowColor: shadow == null
        ? base.shadowColor
        : WidgetStatePropertyAll(shadow),
    surfaceTintColor: tint == null
        ? base.surfaceTintColor
        : WidgetStatePropertyAll(tint),
  );

  // Màu hiển thị của nút Đơn của tôi.
  static ButtonStyle ordersStyle(BuildContext context) => _colors(
    _effectiveStyle(
      const TextButton(
        onPressed: null,
        child: SizedBox(),
      ).defaultStyleOf(context),
      Theme.of(context).textButtonTheme.style,
    ),
    foreground: ordersText,
    background: ordersBackground,
    disabledText: ordersDisabledText,
    disabledBackground: ordersDisabledBackground,
    overlay: ordersOverlay,
    shadow: ordersShadow,
    tint: ordersSurfaceTint,
  );

  // Màu hiển thị của nút Xem thêm/Thu gọn danh mục.
  static ButtonStyle expandStyle(BuildContext context) => _colors(
    _effectiveStyle(
      const TextButton(
        onPressed: null,
        child: SizedBox(),
      ).defaultStyleOf(context),
      Theme.of(context).textButtonTheme.style,
    ),
    foreground: expandForeground,
    background: expandBackground,
    disabledText: expandDisabledText,
    disabledBackground: expandDisabledBackground,
    overlay: expandOverlay,
    shadow: expandShadow,
    tint: expandSurfaceTint,
  );

  // Màu hiển thị của nút mũi tên gửi tìm kiếm.
  static ButtonStyle searchActionStyle(BuildContext context) => _colors(
    const ButtonStyle().merge(Theme.of(context).iconButtonTheme.style),
    foreground: searchActionForeground,
    background: null,
    disabledText: searchActionDisabledText,
    disabledBackground: searchActionDisabledBackground,
    overlay: searchActionOverlay,
    shadow: searchActionShadow,
    tint: searchActionSurfaceTint,
  );
}

// Trang chủ chỉ gồm nhận diện, lời chào, ưu đãi, danh mục và thông điệp thương hiệu.
class CustomerHomeScreen extends StatefulWidget {
  const CustomerHomeScreen({
    super.key,
    required this.home,
    required this.userName,
    required this.onOrders,
    required this.onConsult,
    required this.onProduct,
    required this.onBrowse,
  });
  final CustomerHomeController home;
  final String userName;
  final VoidCallback onOrders, onConsult;
  final ValueChanged<CatalogProduct> onProduct;
  final void Function(String query, CatalogCategory? category) onBrowse;
  @override
  State<CustomerHomeScreen> createState() => _CustomerHomeScreenState();
}

// Theo dõi cuộn để chuyển nhận diện lớn thành logo nhỏ cạnh ô tìm kiếm.
class _CustomerHomeScreenState extends State<CustomerHomeScreen> {
  final search = TextEditingController();
  final scroll = ScrollController();
  bool collapsed = false;
  double headerHeight = 68;
  @override
  void initState() {
    super.initState();
    scroll.addListener(_scrolled);
  }

  void _scrolled() {
    final next = scroll.hasClients && scroll.offset >= headerHeight - 1;
    if (next != collapsed && mounted) setState(() => collapsed = next);
  }

  @override
  void dispose() {
    scroll.removeListener(_scrolled);
    scroll.dispose();
    search.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    headerHeight =
        68 * math.max(1, MediaQuery.textScalerOf(context).scale(16) / 16);
    return ListenableBuilder(
      listenable: widget.home,
      builder: (context, _) => NestedScrollView(
        controller: scroll,
        headerSliverBuilder: (context, innerScrolled) => [
          SliverToBoxAdapter(
            child: SizedBox(height: headerHeight, child: const _BrandHeader()),
          ),
          SliverPersistentHeader(
            pinned: true,
            delegate: _SearchHeaderDelegate(
              height:
                  76 +
                  math.max(0, MediaQuery.textScalerOf(context).scale(16) - 16) *
                      1.5,
              child: _SearchBar(
                search: search,
                collapsed: collapsed,
                browsing: false,
                onBack: () {},
                onSearch: (value) {
                  FocusScope.of(context).unfocus();
                  widget.onBrowse(value.trim(), null);
                },
              ),
            ),
          ),
        ],
        body: RefreshIndicator(
          onRefresh: widget.home.load,
          color: HomeColors.homeRefreshForeground,
          backgroundColor: HomeColors.homeRefreshBackground,
          child: ListView(
            key: const ValueKey('customer-home-content'),
            padding: const EdgeInsets.fromLTRB(16, 12, 16, 24),
            physics: const AlwaysScrollableScrollPhysics(),
            children: [
              Center(
                child: ConstrainedBox(
                  constraints: const BoxConstraints(maxWidth: 760),
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.stretch,
                    children: [
                      _Greeting(
                        name: widget.userName,
                        onOrders: widget.onOrders,
                      ),
                      const SizedBox(height: 12),
                      const _BrandBanner(),
                      const SizedBox(height: 10),
                      _ConsultBanner(onTap: widget.onConsult),
                      const SizedBox(height: 18),
                      _PromotionsSection(
                        home: widget.home,
                        onProduct: widget.onProduct,
                        onConsult: widget.onConsult,
                      ),
                      const SizedBox(height: 24),
                      _CategoriesSection(
                        home: widget.home,
                        onCategory: (category) => widget.onBrowse('', category),
                      ),
                      const SizedBox(height: 28),
                      const _BrandQuestions(),
                    ],
                  ),
                ),
              ),
            ],
          ),
        ),
      ),
    );
  }
}

// Logo và tên nhà thuốc ở đầu trang.
// Nhận diện căn giữa: logo cạnh hai dòng Lan Yến và PHARMACY có cùng chiều ngang.
class _BrandHeader extends StatelessWidget {
  const _BrandHeader();
  @override
  Widget build(BuildContext context) {
    final style = Theme.of(context).textTheme.titleLarge!.copyWith(
      fontSize: 22,
      color: HomeColors.headerTitle,
      fontWeight: FontWeight.w600,
    );
    final measure = TextPainter(
      text: TextSpan(text: 'Lan Yến', style: style),
      textDirection: TextDirection.ltr,
      textScaler: MediaQuery.textScalerOf(context),
    )..layout();
    return ColoredBox(
      color: HomeColors.headerBackground,
      child: Center(
        child: FittedBox(
          fit: BoxFit.scaleDown,
          child: Row(
            mainAxisSize: MainAxisSize.min,
            children: [
              Image.asset(
                'assets/images/logo.png',
                key: const ValueKey('home-brand-logo'),
                width: 44,
                height: 44,
                excludeFromSemantics: true,
              ),
              const SizedBox(width: 12),
              SizedBox(
                width: measure.width,
                child: Column(
                  mainAxisSize: MainAxisSize.min,
                  crossAxisAlignment: CrossAxisAlignment.stretch,
                  children: [
                    Text('Lan Yến', style: style),
                    FittedBox(
                      fit: BoxFit.fitWidth,
                      child: Text(
                        'PHARMACY',
                        style: TextStyle(
                          fontSize: 11,
                          letterSpacing: 2.4,
                          fontWeight: FontWeight.w600,
                          color: HomeColors.headerSubtitle,
                        ),
                      ),
                    ),
                  ],
                ),
              ),
            ],
          ),
        ),
      ),
    );
  }
}

class _SearchHeaderDelegate extends SliverPersistentHeaderDelegate {
  _SearchHeaderDelegate({required this.height, required this.child});
  final double height;
  final Widget child;
  @override
  double get minExtent => height;
  @override
  double get maxExtent => height;
  @override
  Widget build(
    BuildContext context,
    double shrinkOffset,
    bool overlapsContent,
  ) => child;
  @override
  bool shouldRebuild(_SearchHeaderDelegate oldDelegate) =>
      oldDelegate.height != height || oldDelegate.child != child;
}

// Thanh nhập từ khóa và nút tìm thuốc.
class _SearchBar extends StatelessWidget {
  const _SearchBar({
    required this.search,
    this.collapsed = false,
    required this.browsing,
    required this.onBack,
    required this.onSearch,
  });
  final TextEditingController search;
  final bool collapsed;
  final bool browsing;
  final VoidCallback onBack;
  final ValueChanged<String> onSearch;
  @override
  Widget build(BuildContext context) => ColoredBox(
    color: HomeColors.searchContainer,
    child: Center(
      child: ConstrainedBox(
        constraints: const BoxConstraints(maxWidth: 792),
        child: Padding(
          padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 8),
          child: Row(
            children: [
              if (collapsed) ...[
                Image.asset(
                  'assets/images/logo.png',
                  key: const ValueKey('home-search-logo'),
                  width: 32,
                  height: 32,
                  excludeFromSemantics: true,
                ),
                const SizedBox(width: 8),
              ],
              Expanded(
                child: TextField(
                  key: const ValueKey('home-search'),
                  style: const TextStyle(color: HomeColors.searchText),
                  cursorColor: HomeColors.searchCursor,
                  controller: search,
                  textInputAction: TextInputAction.search,
                  maxLength: 255,
                  onSubmitted: onSearch,
                  decoration: InputDecoration(
                    labelText: 'Tìm thông tin thuốc',
                    prefixIconColor: HomeColors.searchPrefixIcon,
                    labelStyle: WidgetStateTextStyle.resolveWith(
                      (states) => TextStyle(
                        color: states.contains(WidgetState.error)
                            ? HomeColors.searchError
                            : states.contains(WidgetState.focused)
                            ? HomeColors.searchFocusedLabel
                            : HomeColors.searchLabel,
                      ),
                    ),
                    counterText: '',
                    filled: true,
                    fillColor: HomeColors.searchBackground,
                    border: OutlineInputBorder(
                      borderRadius: BorderRadius.circular(100),
                    ),
                    enabledBorder: OutlineInputBorder(
                      borderRadius: BorderRadius.circular(100),
                      borderSide: const BorderSide(
                        color: HomeColors.searchBorder,
                      ),
                    ),
                    focusedBorder: OutlineInputBorder(
                      borderRadius: BorderRadius.circular(100),
                      borderSide: const BorderSide(
                        color: HomeColors.searchFocusBorder,
                        width: 2,
                      ),
                    ),
                    prefixIcon: browsing
                        ? IconButton(
                            style: HomeColors.searchBackStyle(context),
                            onPressed: onBack,
                            tooltip: 'Đóng tìm kiếm',
                            icon: const Icon(Icons.arrow_back),
                          )
                        : const Icon(Icons.search),
                    suffixIcon: IconButton(
                      style: HomeColors.searchActionStyle(context),
                      tooltip: 'Tìm kiếm',
                      icon: const Icon(Icons.arrow_forward),
                      onPressed: () => onSearch(search.text),
                    ),
                  ),
                ),
              ),
            ],
          ),
        ),
      ),
    ),
  );
}

// Lời chào theo tên và nút Đơn của tôi.
class _Greeting extends StatelessWidget {
  const _Greeting({required this.name, required this.onOrders});
  final String name;
  final VoidCallback onOrders;
  @override
  Widget build(BuildContext context) => LayoutBuilder(
    builder: (context, constraints) {
      final greeting = Text(
        'Xin chào, $name',
        style: Theme.of(context).textTheme.titleMedium?.copyWith(
          fontWeight: FontWeight.w600,
          color: HomeColors.greetingText,
        ),
      );
      final orders = TextButton.icon(
        style: HomeColors.ordersStyle(context),
        onPressed: onOrders,
        icon: const Icon(
          Icons.receipt_long_outlined,
          size: 20,
          color: HomeColors.ordersIcon,
        ),
        label: const Text('Đơn của tôi'),
      );
      if (constraints.maxWidth < 320 ||
          MediaQuery.textScalerOf(context).scale(16) > 20) {
        return Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [greeting, orders],
        );
      }
      return Row(
        children: [
          Expanded(child: greeting),
          const SizedBox(width: 8),
          orders,
        ],
      );
    },
  );
}

// Lời nhắn thương hiệu ngắn ở trang chủ.
class _BrandBanner extends StatelessWidget {
  const _BrandBanner();
  @override
  Widget build(BuildContext context) => Container(
    padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 12),
    decoration: BoxDecoration(
      color: HomeColors.brandBackground,
      borderRadius: BorderRadius.circular(12),
    ),
    child: const Row(
      children: [
        _PharmacistIllustration(),
        SizedBox(width: 12),
        Expanded(
          child: Text(
            'Sự quan tâm bắt đầu\ntừ những điều nhỏ nhất.',
            style: TextStyle(
              color: HomeColors.brandMessage,
              fontWeight: FontWeight.w600,
            ),
          ),
        ),
      ],
    ),
  );
}

// Minh họa trò chuyện nhẹ bằng SDK, dừng khi người dùng giảm chuyển động.

// Minh họa chuyển động nhẹ trên banner.
class _PharmacistIllustration extends StatefulWidget {
  const _PharmacistIllustration();
  @override
  State<_PharmacistIllustration> createState() =>
      _PharmacistIllustrationState();
}

// Điều khiển chuyển động, dừng theo thiết lập giảm chuyển động.
class _PharmacistIllustrationState extends State<_PharmacistIllustration> {
  Timer? timer;
  bool speaking = false;
  @override
  void didChangeDependencies() {
    super.didChangeDependencies();
    timer?.cancel();
    if (!MediaQuery.disableAnimationsOf(context) &&
        TickerMode.valuesOf(context).enabled) {
      timer = Timer.periodic(
        const Duration(milliseconds: 1600),
        (_) => setState(() => speaking = !speaking),
      );
    }
  }

  @override
  void dispose() {
    timer?.cancel();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) => ExcludeSemantics(
    child: SizedBox(
      width: 66,
      height: 58,
      child: Stack(
        children: [
          const Positioned(
            left: 0,
            bottom: 0,
            child: Icon(
              Icons.support_agent,
              size: 32,
              color: HomeColors.brandPharmacist,
            ),
          ),
          const Positioned(
            right: 0,
            bottom: 0,
            child: Icon(
              Icons.person_outline,
              size: 28,
              color: HomeColors.brandCustomer,
            ),
          ),
          Positioned(
            left: 23,
            top: 0,
            child: AnimatedSlide(
              offset: speaking ? const Offset(.12, 0) : const Offset(-.12, .1),
              duration: MediaQuery.disableAnimationsOf(context)
                  ? Duration.zero
                  : const Duration(milliseconds: 280),
              child: Container(
                padding: const EdgeInsets.all(4),
                decoration: const BoxDecoration(
                  color: HomeColors.brandBubble,
                  borderRadius: BorderRadius.all(Radius.circular(8)),
                ),
                child: const Icon(
                  Icons.more_horiz,
                  size: 19,
                  color: HomeColors.brandBubbleIcon,
                ),
              ),
            ),
          ),
        ],
      ),
    ),
  );
}

// Lối mở sang trang tư vấn/nhắn tin.
class _ConsultBanner extends StatelessWidget {
  const _ConsultBanner({required this.onTap});
  final VoidCallback onTap;
  @override
  Widget build(BuildContext context) => Material(
    color: HomeColors.consultBackground,
    borderRadius: BorderRadius.circular(12),
    child: InkWell(
      focusColor: HomeColors.consultFocus,
      hoverColor: HomeColors.consultHover,
      highlightColor: HomeColors.consultHighlight,
      splashColor: HomeColors.consultPressed,
      onTap: onTap,
      borderRadius: BorderRadius.circular(12),
      child: Padding(
        padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 12),
        child: Row(
          children: [
            const Icon(
              Icons.support_agent,
              color: HomeColors.consultPharmacistIcon,
              size: 30,
            ),
            const SizedBox(width: 12),
            Expanded(
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  const Text(
                    'Tư vấn thuốc',
                    style: TextStyle(
                      fontWeight: FontWeight.w600,
                      color: HomeColors.consultTitle,
                    ),
                  ),
                  Text(
                    'Dược sĩ đồng hành cùng bạn',
                    style: Theme.of(context).textTheme.bodySmall
                        ?.copyWith(color: HomeColors.consultSubtitle),
                  ),
                ],
              ),
            ),
            const SizedBox(width: 4),
            const Icon(
              Icons.forum_outlined,
              color: HomeColors.consultChatIcon,
              size: 24,
            ),
          ],
        ),
      ),
    ),
  );
}

// Khung ưu đãi tách khỏi nền, chương trình và thời gian cuộn ngang cùng nhau.

// Khung ưu đãi: chương trình, đồng hồ và các thẻ sản phẩm.
class _PromotionsSection extends StatelessWidget {
  const _PromotionsSection({
    required this.home,
    required this.onProduct,
    required this.onConsult,
  });
  final CustomerHomeController home;
  final ValueChanged<CatalogProduct> onProduct;
  final VoidCallback onConsult;
  @override
  Widget build(BuildContext context) => Container(
    padding: const EdgeInsets.all(12),
    decoration: BoxDecoration(
      color: HomeColors.promotionBackground,
      borderRadius: BorderRadius.circular(16),
      border: Border.all(color: HomeColors.promotionBorder),
    ),
    child: Column(
      crossAxisAlignment: CrossAxisAlignment.stretch,
      children: [
        const Padding(
          padding: EdgeInsets.fromLTRB(4, 4, 4, 12),
          child: Row(
            children: [
              Icon(
                Icons.local_offer_rounded,
                color: HomeColors.promotionIcon,
                size: 24,
              ),
              SizedBox(width: 8),
              Expanded(
                child: CustomerHeading(
                  'Ưu đãi từ Lan Yến',
                  color: HomeColors.promotionTitle,
                ),
              ),
            ],
          ),
        ),
        if (home.promotionsError != null)
          CustomerStatus(
            message: home.promotionsError!,
            onRetry: home.loadPromotions,
          )
        else if (home.promotionsLoading && home.promotions.isEmpty)
          const CustomerStatus(loading: true)
        else if (home.promotions.isEmpty)
          const CustomerStatus(
            message:
                'Chưa có chương trình khuyến mãi đang diễn ra hoặc sắp tới.',
          )
        else ...[
          SingleChildScrollView(
            scrollDirection: Axis.horizontal,
            child: Row(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: home.promotions
                  .map(
                    (program) => Padding(
                      padding: const EdgeInsets.only(right: 8),
                      child: _PromotionTab(
                        program: program,
                        selected: home.selectedPromotion?.id == program.id,
                        onTap: () => home.selectPromotion(program),
                      ),
                    ),
                  )
                  .toList(),
            ),
          ),
          if (home.selectedPromotion case final program?)
            _PromotionClock(home: home, program: program),
          if (home.offersLoading)
            const CustomerStatus(loading: true)
          else if (home.offersError != null)
            CustomerStatus(
              message: home.offersError!,
              onRetry: () => home.selectPromotion(home.selectedPromotion!),
            )
          else if (home.offers.isEmpty)
            const CustomerStatus(
              message: 'Chưa có sản phẩm được công bố trong chương trình này.',
            )
          else
            _ProductRail(
              home: home,
              products: home.offers,
              onProduct: onProduct,
              onConsult: onConsult,
            ),
          if (!home.offersLoading &&
              home.offersError == null &&
              home.offerPages > 1)
            CustomerPagination(
              page: home.offerPage,
              pages: home.offerPages,
              onPage: (page) =>
                  home.selectPromotion(home.selectedPromotion!, page: page),
            ),
        ],
      ],
    ),
  );
}

// Số ngày, giờ, phút, giây tới mốc bắt đầu/kết thúc.
// Đồng hồ bốn ô; đơn vị nhỏ nằm dưới mỗi số, không công bố mỗi tick cho screen reader.
class _PromotionClock extends StatelessWidget {
  const _PromotionClock({required this.home, required this.program});
  final CustomerHomeController home;
  final CatalogPromotion program;
  @override
  Widget build(BuildContext context) => ValueListenableBuilder<DateTime>(
    valueListenable: home.clock,
    builder: (context, now, _) {
      final state = program.stateAt(now);
      final seconds = (program.remainingAt(now).inMilliseconds / 1000).ceil();
      final parts = [
        seconds ~/ 86400,
        seconds % 86400 ~/ 3600,
        seconds % 3600 ~/ 60,
        seconds % 60,
      ];
      return Padding(
        padding: const EdgeInsets.symmetric(vertical: 8, horizontal: 4),
        child: Wrap(
          spacing: 8,
          runSpacing: 4,
          crossAxisAlignment: WrapCrossAlignment.center,
          children: [
            Text(
              state == 'UPCOMING'
                  ? 'Bắt đầu sau'
                  : state == 'ACTIVE'
                  ? 'Kết thúc sau'
                  : 'Đã kết thúc',
              style: const TextStyle(
                color: HomeColors.countdownLabel,
                fontWeight: FontWeight.w600,
                fontSize: 13,
              ),
            ),
            if (state != 'ENDED')
              Semantics(
                label:
                    '${parts[0]} ngày ${parts[1]} giờ ${parts[2]} phút ${parts[3]} giây',
                excludeSemantics: true,
                child: Wrap(
                  spacing: 4,
                  runSpacing: 4,
                  children: List.generate(
                    4,
                    (index) => Padding(
                      padding: const EdgeInsets.only(right: 4),
                      child: Container(
                        padding: const EdgeInsets.symmetric(
                          horizontal: 7,
                          vertical: 4,
                        ),
                        decoration: BoxDecoration(
                          color: HomeColors.countdownCellBackground,
                          borderRadius: BorderRadius.circular(6),
                        ),
                        child: Column(
                          mainAxisSize: MainAxisSize.min,
                          children: [
                            Text(
                              parts[index].toString().padLeft(2, '0'),
                              style: const TextStyle(
                                color: HomeColors.countdownDigit,
                                fontWeight: FontWeight.w600,
                              ),
                            ),
                            Text(
                              const ['ngày', 'giờ', 'phút', 'giây'][index],
                              style: const TextStyle(
                                fontSize: 10,
                                height: 1.2,
                                color: HomeColors.countdownUnit,
                              ),
                            ),
                          ],
                        ),
                      ),
                    ),
                  ),
                ),
              ),
          ],
        ),
      );
    },
  );
}

// Dãy thẻ sản phẩm ưu đãi cuộn ngang.
class _ProductRail extends StatelessWidget {
  const _ProductRail({
    required this.home,
    required this.products,
    required this.onProduct,
    required this.onConsult,
  });
  final CustomerHomeController home;
  final List<CatalogProduct> products;
  final ValueChanged<CatalogProduct> onProduct;
  final VoidCallback onConsult;
  @override
  Widget build(BuildContext context) => LayoutBuilder(
    builder: (context, constraints) {
      final scale = MediaQuery.textScalerOf(context).scale(16) / 16;
      final width = scale > 1.4
          ? math.min(280.0, constraints.maxWidth)
          : math.min(204.0, math.max(156.0, (constraints.maxWidth - 10) / 2));
      return SingleChildScrollView(
        scrollDirection: Axis.horizontal,
        child: IntrinsicHeight(
          child: Row(
            crossAxisAlignment: CrossAxisAlignment.stretch,
            children: products
                .map(
                  (product) => Padding(
                    padding: const EdgeInsets.only(right: 12),
                    child: SizedBox(
                      width: width,
                      child: CustomerProductCard(
                        home: home,
                        product: product,
                        onTap: () => onProduct(product),
                        onConsult: onConsult,
                        compact: true,
                      ),
                    ),
                  ),
                )
                .toList(),
          ),
        ),
      );
    },
  );
}

// Sáu danh mục đầu và nút mở rộng toàn bộ.
class _CategoriesSection extends StatelessWidget {
  const _CategoriesSection({required this.home, required this.onCategory});
  final CustomerHomeController home;
  final ValueChanged<CatalogCategory> onCategory;
  @override
  Widget build(BuildContext context) => Column(
    crossAxisAlignment: CrossAxisAlignment.stretch,
    children: [
      const CustomerHeading(
        'Danh mục sản phẩm',
        color: HomeColors.categoryTitle,
      ),
      const SizedBox(height: 12),
      if (home.categoriesLoading)
        const CustomerStatus(loading: true)
      else if (home.categoriesError != null)
        CustomerStatus(
          message: home.categoriesError!,
          onRetry: home.loadCategories,
        )
      else if (home.categories.isEmpty)
        const CustomerStatus(message: 'Chưa có danh mục được công bố.')
      else
        LayoutBuilder(
          builder: (context, constraints) {
            final columns = constraints.maxWidth > 560
                ? 3
                : MediaQuery.textScalerOf(context).scale(16) > 24
                ? 1
                : 2;
            final width = (constraints.maxWidth - (columns - 1) * 12) / columns;
            final items = home.expandedCategories
                ? home.categories
                : home.categories.take(6);
            return Wrap(
              spacing: 12,
              runSpacing: 12,
              children: items
                  .map(
                    (category) => SizedBox(
                      width: width,
                      child: _CategoryTile(
                        category: category,
                        onTap: () => onCategory(category),
                      ),
                    ),
                  )
                  .toList(),
            );
          },
        ),
      if (home.categories.length > 6 &&
          !home.categoriesLoading &&
          home.categoriesError == null)
        TextButton(
          style: HomeColors.expandStyle(context),
          key: const ValueKey('expand-categories'),
          onPressed: home.toggleCategories,
          child: Text(
            home.expandedCategories
                ? 'Thu gọn danh mục'
                : 'Xem thêm ${home.categories.length - 6} danh mục',
          ),
        ),
    ],
  );
}

// Một ô tên và biểu tượng danh mục.
class _CategoryTile extends StatelessWidget {
  const _CategoryTile({required this.category, required this.onTap});
  final CatalogCategory category;
  final VoidCallback onTap;
  @override
  Widget build(BuildContext context) => Material(
    color: HomeColors.categoryBackground,
    borderRadius: BorderRadius.circular(12),
    child: InkWell(
      focusColor: HomeColors.categoryFocus,
      hoverColor: HomeColors.categoryHover,
      highlightColor: HomeColors.categoryHighlight,
      splashColor: HomeColors.categoryPressed,
      onTap: onTap,
      borderRadius: BorderRadius.circular(12),
      child: Padding(
        padding: const EdgeInsets.all(16),
        child: Column(
          children: [
            Icon(
              _categoryIcon(category.name),
              size: 32,
              color: HomeColors.categoryIcon,
            ),
            const SizedBox(height: 12),
            Text(
              category.name,
              textAlign: TextAlign.center,
              style: const TextStyle(color: HomeColors.categoryText),
            ),
          ],
        ),
      ),
    ),
  );
}

// Chọn biểu tượng theo tên thật, không gán số lượng hoặc ý nghĩa điều trị.
IconData _categoryIcon(String name) {
  final text = name.toLowerCase();
  if (text.contains('tim') || text.contains('huyết áp')) {
    return Icons.monitor_heart_outlined;
  }
  if (text.contains('mắt')) return Icons.visibility_outlined;
  if (text.contains('chăm sóc da') || text.contains('cá nhân')) {
    return Icons.spa_outlined;
  }
  if (text.contains('thiết bị')) return Icons.medical_services_outlined;
  if (text.contains('vitamin')) return Icons.health_and_safety_outlined;
  if (text.contains('thần kinh')) return Icons.psychology_outlined;
  if (text.contains('xương')) return Icons.accessibility_new_outlined;
  return Icons.medication_outlined;
}

// Thông điệp thương hiệu cuối trang.
class _BrandQuestions extends StatelessWidget {
  const _BrandQuestions();
  @override
  Widget build(BuildContext context) => Column(
    crossAxisAlignment: CrossAxisAlignment.stretch,
    children: [
      const Divider(color: HomeColors.footerDivider),
      const SizedBox(height: 24),
      Row(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          const Icon(
            Icons.spa_outlined,
            size: 40,
            color: HomeColors.footerLeafIcon,
          ),
          const SizedBox(width: 16),
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                const Text(
                  'LAN YẾN PHARMACY',
                  style: TextStyle(
                    fontSize: 12,
                    letterSpacing: 1.5,
                    color: HomeColors.footerEyebrow,
                    fontWeight: FontWeight.w600,
                  ),
                ),
                const SizedBox(height: 12),
                Text(
                  'Trao sự tận tâm,\ngửi trọn an tâm.',
                  style: Theme.of(context).textTheme.headlineSmall
                      ?.copyWith(color: HomeColors.footerHeading),
                ),
                const SizedBox(height: 12),
                const Text(
                  'Mỗi câu hỏi đều xứng đáng được lắng nghe. Mỗi lựa chọn sức khỏe đều cần sự thấu hiểu.',
                  style: TextStyle(color: HomeColors.footerBody),
                ),
              ],
            ),
          ),
        ],
      ),
      const SizedBox(height: 24),
      const Row(
        children: [
          Icon(
            Icons.favorite_outline,
            color: HomeColors.footerHeartIcon,
            size: 20,
          ),
          SizedBox(width: 10),
          Expanded(
            child: Text(
              'Quan tâm mỗi ngày. An tâm mỗi lựa chọn.',
              style: TextStyle(fontSize: 14, color: HomeColors.footerTagline),
            ),
          ),
        ],
      ),
      const SizedBox(height: 16),
    ],
  );
}

// Một thẻ chọn chương trình đang diễn ra/sắp tới.
class _PromotionTab extends StatelessWidget {
  const _PromotionTab({
    required this.program,
    required this.selected,
    required this.onTap,
  });
  final CatalogPromotion program;
  final bool selected;
  final VoidCallback onTap;
  @override
  Widget build(BuildContext context) {
    final scale = MediaQuery.textScalerOf(context).scale(16) / 16;
    final active = program.active;
    final background = active
        ? (selected
              ? HomeColors.activeProgramSelectedBackground
              : HomeColors.activeProgramBackground)
        : (selected
              ? HomeColors.upcomingProgramSelectedBackground
              : HomeColors.upcomingProgramBackground);
    final title = active
        ? (selected
              ? HomeColors.activeProgramSelectedTitle
              : HomeColors.activeProgramTitle)
        : (selected
              ? HomeColors.upcomingProgramSelectedTitle
              : HomeColors.upcomingProgramTitle);
    final dates = active
        ? (selected
              ? HomeColors.activeProgramSelectedDates
              : HomeColors.activeProgramDates)
        : (selected
              ? HomeColors.upcomingProgramSelectedDates
              : HomeColors.upcomingProgramDates);
    final status = active
        ? (selected
              ? HomeColors.activeProgramSelectedStatus
              : HomeColors.activeProgramStatus)
        : (selected
              ? HomeColors.upcomingProgramSelectedStatus
              : HomeColors.upcomingProgramStatus);
    return SizedBox(
      width: scale > 1.4 ? 292 : 230,
      child: Semantics(
        selected: selected,
        label:
            '${program.name}, ${program.dates}, ${active ? 'Đang diễn ra' : 'Sắp diễn ra'}',
        child: Material(
          color: background,
          borderRadius: BorderRadius.circular(10),
          child: InkWell(
            onTap: onTap,
            borderRadius: BorderRadius.circular(10),
            overlayColor: HomeColors.programOverlay(context),
            child: Padding(
              padding: const EdgeInsets.all(12),
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Tooltip(
                    decoration: HomeColors.programTooltipDecoration(context),
                    textStyle: HomeColors.programTooltipTextStyle(context),
                    message: program.name,
                    child: Text(
                      program.name,
                      maxLines: 2,
                      overflow: TextOverflow.ellipsis,
                      style: TextStyle(
                        fontSize: 14,
                        height: 1.5,
                        fontWeight: FontWeight.w600,
                        color: title,
                      ),
                    ),
                  ),
                  const SizedBox(height: 4),
                  Text(
                    program.dates,
                    maxLines: 2,
                    style: TextStyle(fontSize: 12, height: 1.5, color: dates),
                  ),
                  const SizedBox(height: 4),
                  Text(
                    active ? 'Đang diễn ra' : 'Sắp diễn ra',
                    style: TextStyle(fontSize: 12, color: status),
                  ),
                ],
              ),
            ),
          ),
        ),
      ),
    );
  }
}
