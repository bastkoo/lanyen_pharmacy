import 'package:flutter/material.dart';

import '../../core/theme/app_colors.dart';

import 'dart:async';

class CustomerNavigationColors {
  CustomerNavigationColors._();
  // Màu nền của thanh điều hướng cố định dưới cùng.
  static const navigationBackground = AppColors.surface;

  // Màu nền của nút tư vấn tròn nhô lên giữa thanh dưới.
  static const navigationConsultBackground = AppColors.primaryDark;

  // Màu biểu tượng của mục chưa được chọn trên thanh dưới.
  static const navigationUnselectedIcon = AppColors.textSecondary;

  // Màu biểu tượng của mục đang được chọn trên thanh dưới.
  static const navigationSelectedIcon = AppColors.primaryDark;

  // Màu nhãn của mục đang được chọn trên thanh dưới.
  static const navigationSelectedLabel = AppColors.primaryDark;

  // Màu nhãn của mục chưa được chọn trên thanh dưới.
  static const navigationUnselectedLabel = AppColors.textSecondary;

  // Màu biểu tượng của nút tư vấn tròn nhô lên giữa thanh dưới.
  static const navigationConsultIcon = AppColors.surface;

  // Màu đường viền của nút tư vấn tròn nhô lên giữa thanh dưới.
  static const navigationConsultBorder = AppColors.surface;

  // Màu nền của huy hiệu số sản phẩm trên Giỏ hàng.
  static const navigationBadgeBackground = AppColors.error;

  // Màu chữ của huy hiệu số sản phẩm trên Giỏ hàng.
  static const navigationBadgeText = AppColors.surface;

  // Hiệu ứng khi bấm của thanh điều hướng cố định dưới cùng. Null giữ nguyên màu Theme/SDK.
  static const Color? navigationPressed = null;

  // Màu khi nhận focus bàn phím của thanh điều hướng cố định dưới cùng. Null giữ nguyên màu Theme/SDK.
  static const Color? navigationFocus = null;

  // Màu khi trỏ chuột của thanh điều hướng cố định dưới cùng. Null giữ nguyên màu Theme/SDK.
  static const Color? navigationHover = null;

  // Màu nhấn giữ của thanh điều hướng cố định dưới cùng. Null giữ nguyên màu Theme/SDK.
  static const Color? navigationHighlight = null;

  // Màu khi nhận focus bàn phím của nút tư vấn tròn nhô lên giữa thanh dưới. Null giữ nguyên màu Theme/SDK.
  static const Color? navigationConsultFocus = null;

  // Màu khi trỏ chuột của nút tư vấn tròn nhô lên giữa thanh dưới. Null giữ nguyên màu Theme/SDK.
  static const Color? navigationConsultHover = null;

  // Màu nhấn giữ của nút tư vấn tròn nhô lên giữa thanh dưới. Null giữ nguyên màu Theme/SDK.
  static const Color? navigationConsultHighlight = null;

  // Hiệu ứng khi bấm của nút tư vấn tròn nhô lên giữa thanh dưới. Null giữ nguyên màu Theme/SDK.
  static const Color? navigationConsultPressed = null;
}

// Thanh chuyển mục cố định dưới cùng.
class CustomerNavigation extends StatefulWidget {
  const CustomerNavigation({
    super.key,
    required this.selected,
    required this.onSelect,
    required this.cartCount,
  });
  final int selected;
  final int? cartCount;
  final ValueChanged<int> onSelect;
  @override
  State<CustomerNavigation> createState() => CustomerNavigationState();
}

// Luân phiên biểu tượng trong nút tư vấn tròn.
class CustomerNavigationState extends State<CustomerNavigation> {
  Timer? timer;
  int consultIcon = 0;
  static const consultIcons = [
    Icons.forum_outlined,
    Icons.support_agent,
    Icons.smart_toy_outlined,
  ];
  @override
  void didChangeDependencies() {
    super.didChangeDependencies();
    timer?.cancel();
    // Giữ tên nút ổn định; tôn trọng thiết lập giảm chuyển động.
    if (!MediaQuery.disableAnimationsOf(context)) {
      timer = Timer.periodic(
        const Duration(seconds: 2),
        (_) => setState(
          () => consultIcon = (consultIcon + 1) % consultIcons.length,
        ),
      );
    }
  }

  @override
  void dispose() {
    timer?.cancel();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) => SafeArea(
    top: false,
    child: Stack(
      clipBehavior: Clip.none,
      alignment: Alignment.topCenter,
      children: [
        Padding(
          padding: const EdgeInsets.only(top: 14),
          child: Material(
            color: CustomerNavigationColors.navigationBackground,
            borderRadius: const BorderRadius.vertical(top: Radius.circular(20)),
            child: Padding(
              padding: const EdgeInsets.fromLTRB(4, 6, 4, 4),
              child: Row(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: List.generate(
                  5,
                  (index) => Expanded(
                    child: _NavigationItem(
                      index: index,
                      selected: widget.selected,
                      cartCount: widget.cartCount,
                      onSelect: widget.onSelect,
                    ),
                  ),
                ),
              ),
            ),
          ),
        ),
        Semantics(
          label: 'Tư vấn',
          selected: widget.selected == 2,
          button: true,
          child: Material(
            color: CustomerNavigationColors.navigationConsultBackground,
            shape: const CircleBorder(
              side: BorderSide(
                color: CustomerNavigationColors.navigationConsultBorder,
                width: 5,
              ),
            ),
            child: InkWell(
              splashColor: CustomerNavigationColors.navigationConsultPressed,
              focusColor: CustomerNavigationColors.navigationConsultFocus,
              hoverColor: CustomerNavigationColors.navigationConsultHover,
              highlightColor:
                  CustomerNavigationColors.navigationConsultHighlight,
              key: const ValueKey('customer-tab-2'),
              customBorder: const CircleBorder(),
              onTap: () => widget.onSelect(2),
              child: Padding(
                padding: const EdgeInsets.all(17),
                child: ExcludeSemantics(
                  child: AnimatedSwitcher(
                    duration: MediaQuery.disableAnimationsOf(context)
                        ? Duration.zero
                        : const Duration(milliseconds: 200),
                    child: Icon(
                      consultIcons[consultIcon],
                      key: ValueKey(consultIcon),
                      color: CustomerNavigationColors.navigationConsultIcon,
                      size: 26,
                    ),
                  ),
                ),
              ),
            ),
          ),
        ),
      ],
    ),
  );
}

// Một mục Trang chủ/Điểm thưởng/Giỏ hàng/Tài khoản.
class _NavigationItem extends StatelessWidget {
  const _NavigationItem({
    required this.index,
    required this.selected,
    required this.cartCount,
    required this.onSelect,
  });
  final int index, selected;
  final int? cartCount;
  final ValueChanged<int> onSelect;
  static const labels = [
    'Trang chủ',
    'Điểm thưởng',
    'Tư vấn',
    'Giỏ hàng',
    'Tài khoản',
  ];
  static const icons = [
    Icons.home_outlined,
    Icons.stars_outlined,
    Icons.forum_outlined,
    Icons.shopping_cart_outlined,
    Icons.person_outline,
  ];
  @override
  Widget build(BuildContext context) {
    final color = selected == index || index == 2
        ? CustomerNavigationColors.navigationSelectedIcon
        : CustomerNavigationColors.navigationUnselectedIcon;
    final labelColor = selected == index || index == 2
        ? CustomerNavigationColors.navigationSelectedLabel
        : CustomerNavigationColors.navigationUnselectedLabel;
    final content = Padding(
      padding: const EdgeInsets.symmetric(vertical: 4),
      child: Column(
        mainAxisSize: MainAxisSize.min,
        children: [
          SizedBox(
            height: 40,
            child: index == 2
                ? null
                : Center(
                    child: Badge(
                      backgroundColor:
                          CustomerNavigationColors.navigationBadgeBackground,
                      textColor: CustomerNavigationColors.navigationBadgeText,
                      isLabelVisible: index == 3 && (cartCount ?? 0) > 0,
                      label: Text('${cartCount ?? 0}'),
                      child: Icon(icons[index], color: color),
                    ),
                  ),
          ),
          const SizedBox(height: 2),
          Text(
            labels[index],
            textAlign: TextAlign.center,
            style: TextStyle(
              fontSize: 12,
              color: labelColor,
              fontWeight: selected == index ? FontWeight.w600 : FontWeight.w400,
            ),
          ),
        ],
      ),
    );
    if (index == 2) return ExcludeSemantics(child: content);
    return Semantics(
      selected: selected == index,
      button: true,
      label: index == 3 && cartCount != null
          ? 'Giỏ hàng, $cartCount sản phẩm'
          : labels[index],
      excludeSemantics: true,
      child: InkWell(
        focusColor: CustomerNavigationColors.navigationFocus,
        hoverColor: CustomerNavigationColors.navigationHover,
        highlightColor: CustomerNavigationColors.navigationHighlight,
        splashColor: CustomerNavigationColors.navigationPressed,
        key: ValueKey('customer-tab-$index'),
        onTap: () => onSelect(index),
        borderRadius: BorderRadius.circular(8),
        child: content,
      ),
    );
  }
}
