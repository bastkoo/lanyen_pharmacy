import 'package:flutter/material.dart';

import '../../core/theme/app_colors.dart';
import '../../models/catalog.dart';
import 'customer_home_controller.dart';

class CustomerProductColors {
  CustomerProductColors._();
  // Màu nền của thông tin trên thẻ sản phẩm.
  static const productBackground = AppColors.surface;
  // Màu hiển thị của thông tin trên thẻ sản phẩm.
  static const productConsultationHint = AppColors.textSecondary;
  // Màu hiển thị của vùng ảnh sản phẩm.
  static const productImagePlaceholder = AppColors.textSecondary;
  // Giá gốc gạch ngang của giá gốc bị gạch ngang trên thẻ sản phẩm.
  static const productOriginalPrice = AppColors.textSecondary;
  // Chữ giá bán của thông tin trên thẻ sản phẩm.
  static const productPrice = AppColors.primaryDark;
  // Màu hiển thị của thông tin trên thẻ sản phẩm.
  static const productOfferCaption = AppColors.error;
  // Chữ tên sản phẩm của thông tin trên thẻ sản phẩm.
  static const productName = AppColors.textPrimary;
  // Màu hiển thị của thông tin trên thẻ sản phẩm.
  static const productStock = AppColors.textSecondary;
  // Màu hiển thị của thông tin trên thẻ sản phẩm.
  static const productConsultation = AppColors.primaryDark;
  // Chữ số lượng ưu đãi còn lại/dự kiến của thông tin trên thẻ sản phẩm.
  static const productQuota = AppColors.textSecondary;
  // Màu nền của nhãn phần trăm/Ưu đãi trên ảnh sản phẩm.
  static const productBadgeBackground = AppColors.error;
  // Màu chữ của nhãn phần trăm/Ưu đãi trên ảnh sản phẩm.
  static const productBadgeText = AppColors.surface;
  // Màu nền của ô đơn vị tính đang được chọn.
  static const unitSelectedBackground = AppColors.primaryLight;
  // Màu nền của dãy ô đơn vị tính Vỉ/Hộp/Viên.
  static const unitBackground = AppColors.surface;
  // Màu chữ của ô đơn vị tính đang được chọn.
  static const unitSelectedText = AppColors.primaryDark;
  // Màu chữ của dãy ô đơn vị tính Vỉ/Hộp/Viên.
  static const unitText = AppColors.textPrimary;

  // Màu đường viền của dãy ô đơn vị tính Vỉ/Hộp/Viên.
  static const unitBorder = AppColors.border;

  // Màu nền của nút Chọn mua/Nhắn tin của sản phẩm.
  static const purchaseBackground = AppColors.primary;

  // Màu chữ của nút Chọn mua/Nhắn tin của sản phẩm.
  static const purchaseText = AppColors.surface;

  // Màu đường viền của ô đơn vị tính đang được chọn.
  static const unitSelectedBorder = AppColors.primaryDark;

  // Chữ khi bị vô hiệu hóa của nút Chọn mua/Nhắn tin của sản phẩm. Null giữ nguyên màu Theme/SDK.
  static const Color? purchaseDisabledText = null;

  // Nền khi bị vô hiệu hóa của nút Chọn mua/Nhắn tin của sản phẩm. Null giữ nguyên màu Theme/SDK.
  static const Color? purchaseDisabledBackground = null;

  // Lớp màu khi nhấn/focus/hover của nút Chọn mua/Nhắn tin của sản phẩm. Null giữ nguyên màu Theme/SDK.
  static const Color? purchaseOverlay = null;

  // Màu bóng của nút Chọn mua/Nhắn tin của sản phẩm. Null giữ nguyên màu Theme/SDK.
  static const Color? purchaseShadow = null;

  // Sắc phủ bề mặt của nút Chọn mua/Nhắn tin của sản phẩm. Null giữ nguyên màu Theme/SDK.
  static const Color? purchaseSurfaceTint = null;

  // Chữ khi bị vô hiệu hóa của dãy ô đơn vị tính Vỉ/Hộp/Viên. Null giữ nguyên màu Theme/SDK.
  static const Color? unitDisabledText = null;

  // Nền khi bị vô hiệu hóa của dãy ô đơn vị tính Vỉ/Hộp/Viên. Null giữ nguyên màu Theme/SDK.
  static const Color? unitDisabledBackground = null;

  // Lớp màu khi nhấn/focus/hover của dãy ô đơn vị tính Vỉ/Hộp/Viên. Null giữ nguyên màu Theme/SDK.
  static const Color? unitOverlay = null;

  // Màu bóng của dãy ô đơn vị tính Vỉ/Hộp/Viên. Null giữ nguyên màu Theme/SDK.
  static const Color? unitShadow = null;

  // Sắc phủ bề mặt của dãy ô đơn vị tính Vỉ/Hộp/Viên. Null giữ nguyên màu Theme/SDK.
  static const Color? unitSurfaceTint = null;

  // Hiệu ứng khi bấm của thông tin trên thẻ sản phẩm. Null giữ nguyên màu Theme/SDK.
  static const Color? productPressed = null;

  // Màu khi nhận focus bàn phím của thông tin trên thẻ sản phẩm. Null giữ nguyên màu Theme/SDK.
  static const Color? productFocus = null;

  // Màu khi trỏ chuột của thông tin trên thẻ sản phẩm. Null giữ nguyên màu Theme/SDK.
  static const Color? productHover = null;

  // Màu nhấn giữ của thông tin trên thẻ sản phẩm. Null giữ nguyên màu Theme/SDK.
  static const Color? productHighlight = null;

  // Màu chữ của thông báo sau khi thêm giỏ hàng. Null giữ nguyên màu Theme/SDK.
  static const Color? snackbarText = null;

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

  // Màu hiển thị của dãy ô đơn vị tính Vỉ/Hộp/Viên.
  static ButtonStyle unitButtonStyle(BuildContext context, bool selected) =>
      _colors(
        _effectiveStyle(
          const TextButton(
            onPressed: null,
            child: SizedBox(),
          ).defaultStyleOf(context),
          Theme.of(context).textButtonTheme.style,
        ),
        foreground: selected ? unitSelectedText : unitText,
        background: selected ? unitSelectedBackground : unitBackground,
        disabledText: unitDisabledText,
        disabledBackground: unitDisabledBackground,
        overlay: unitOverlay,
        shadow: unitShadow,
        tint: unitSurfaceTint,
      ).copyWith(
        minimumSize: const WidgetStatePropertyAll(Size(48, 48)),
        padding: const WidgetStatePropertyAll(
          EdgeInsets.symmetric(horizontal: 8, vertical: 8),
        ),
        side: WidgetStatePropertyAll(
          BorderSide(color: selected ? unitSelectedBorder : unitBorder),
        ),
      );

  // Màu hiển thị của nút Chọn mua/Nhắn tin của sản phẩm.
  static ButtonStyle purchaseStyle(BuildContext context) => _colors(
    _effectiveStyle(
      const FilledButton(
        onPressed: null,
        child: SizedBox(),
      ).defaultStyleOf(context),
      Theme.of(context).filledButtonTheme.style,
    ),
    foreground: purchaseText,
    background: purchaseBackground,
    disabledText: purchaseDisabledText,
    disabledBackground: purchaseDisabledBackground,
    overlay: purchaseOverlay,
    shadow: purchaseShadow,
    tint: purchaseSurfaceTint,
  );
}

// Thẻ ảnh, tên, giá và nút thao tác của một sản phẩm.
class CustomerProductCard extends StatelessWidget {
  const CustomerProductCard({
    super.key,
    required this.home,
    required this.product,
    required this.onTap,
    required this.onConsult,
    this.compact = false,
    this.dense = false,
  });
  final CustomerHomeController home;
  final CatalogProduct product;
  final VoidCallback onTap, onConsult;
  final bool compact;
  final bool dense;
  @override
  Widget build(BuildContext context) => Material(
    color: CustomerProductColors.productBackground,
    borderRadius: BorderRadius.circular(12),
    child: Padding(
      padding: EdgeInsets.all(dense ? 6 : 10),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: [
          InkWell(
            focusColor: CustomerProductColors.productFocus,
            hoverColor: CustomerProductColors.productHover,
            highlightColor: CustomerProductColors.productHighlight,
            splashColor: CustomerProductColors.productPressed,
            onTap: onTap,
            borderRadius: BorderRadius.circular(8),
            child: Column(
              children: [
                CustomerProductImage(
                  product: product,
                  compact: true,
                  dense: dense,
                ),
                const SizedBox(height: 6),
                Align(
                  alignment: Alignment.topLeft,
                  child: Text(
                    product.displayName,
                    maxLines: compact ? 3 : null,
                    overflow: compact ? TextOverflow.ellipsis : null,
                    style: TextStyle(
                      fontSize: dense ? 12 : 13,
                      color: CustomerProductColors.productName,
                      height: 1.4,
                      fontWeight: FontWeight.w600,
                    ),
                  ),
                ),
              ],
            ),
          ),
          const SizedBox(height: 6),
          if (compact) const Spacer(),
          CustomerPurchaseControls(
            home: home,
            product: product,
            onConsult: onConsult,
            compact: compact,
            dense: dense,
          ),
        ],
      ),
    ),
  );
}

// Giá theo đơn vị, số lượng ưu đãi và thao tác thêm giỏ/tư vấn.
class CustomerPurchaseControls extends StatefulWidget {
  const CustomerPurchaseControls({
    super.key,
    required this.home,
    required this.product,
    required this.onConsult,
    this.compact = false,
    this.dense = false,
    this.showEmptyQuota = true,
    this.showDetails = true,
    this.showAction = true,
    this.selectedUnitId,
    this.onUnitChanged,
  });
  final CustomerHomeController home;
  final CatalogProduct product;
  final VoidCallback onConsult;
  final bool compact;
  final bool dense;
  final bool showEmptyQuota;
  final bool showDetails, showAction;
  final int? selectedUnitId;
  final ValueChanged<int>? onUnitChanged;
  @override
  State<CustomerPurchaseControls> createState() =>
      CustomerPurchaseControlsState();
}

// Trạng thái và tương tác của khối giao diện phía trên.
// Giữ lựa chọn đơn vị và nối thao tác mua với controller giỏ JWT hiện có.
class CustomerPurchaseControlsState extends State<CustomerPurchaseControls> {
  int? selectedId;
  @override
  Widget build(BuildContext context) {
    final product = widget.product, home = widget.home;
    final price =
        product.prices
            .where((unit) => unit.id == (widget.selectedUnitId ?? selectedId))
            .firstOrNull ??
        product.displayPrice;
    final available = price?.available == true;
    final exhausted = product.hasOffer && (price?.quota ?? 0) <= 0;
    final label = product.consultation
        ? 'Nhắn tin'
        : product.upcomingOffer
        ? 'Sắp diễn ra'
        : !available
        ? 'Hết hàng'
        : exhausted
        ? 'Hết ưu đãi'
        : 'Chọn mua';
    return ListenableBuilder(
      listenable: home,
      builder: (context, _) => DefaultTextStyle.merge(
        style: TextStyle(fontSize: widget.dense ? 12 : 14, height: 1.35),
        child: Column(
          mainAxisSize: MainAxisSize.min,
          crossAxisAlignment: CrossAxisAlignment.stretch,
          children: [
            if (widget.showDetails) ...[
              _PriceLabel(product: product, selectedPrice: price),
              const SizedBox(height: 6),
              if (price != null &&
                  (product.hasOffer || price.activeOffer) &&
                  (widget.showEmptyQuota || price.quota > 0)) ...[
                Text(
                  product.upcomingOffer
                      ? 'Dự kiến ${price.quota} ${price.unit} ưu đãi'
                      : 'Còn ${price.quota} ${price.unit} ưu đãi',
                  style: TextStyle(
                    fontSize: widget.dense ? 10 : 12,
                    color: CustomerProductColors.productQuota,
                  ),
                ),
                const SizedBox(height: 6),
              ],
              if (product.prices.length > 1 && !product.consultation) ...[
                _UnitOptions(
                  prices: product.prices,
                  selectedId: price?.id,
                  dense: widget.dense,
                  onSelected: (value) {
                    setState(() => selectedId = value);
                    widget.onUnitChanged?.call(value);
                  },
                ),
                const SizedBox(height: 6),
              ],
            ],
            if (widget.showAction)
              FilledButton(
                style: CustomerProductColors.purchaseStyle(context).copyWith(
                  minimumSize: const WidgetStatePropertyAll(Size(0, 48)),
                  padding: WidgetStatePropertyAll(
                    EdgeInsets.symmetric(
                      horizontal: widget.dense ? 2 : 6,
                      vertical: 8,
                    ),
                  ),
                  textStyle: WidgetStateProperty.resolveWith(
                    (states) =>
                        (CustomerProductColors.purchaseStyle(context).textStyle
                                    ?.resolve(states) ??
                                Theme.of(context).textTheme.labelLarge!)
                            .copyWith(
                              fontSize: widget.dense ? 11 : 13,
                              fontWeight: FontWeight.w600,
                            ),
                  ),
                ),
                onPressed: product.consultation
                    ? widget.onConsult
                    : !available ||
                          exhausted ||
                          product.upcomingOffer ||
                          home.adding
                    ? null
                    : () async {
                        await home.addToCart(product, price!);
                        if (!context.mounted) return;
                        ScaffoldMessenger.of(context).hideCurrentSnackBar();
                        ScaffoldMessenger.of(context).showSnackBar(
                          SnackBar(
                            content: Text(
                              home.purchaseMessage ??
                                  'Vui lòng kiểm tra giỏ hàng.',
                              style: const TextStyle(
                                color: CustomerProductColors.snackbarText,
                              ),
                            ),
                          ),
                        );
                      },
                child: Text(
                  home.adding && home.addingProductId == product.id
                      ? 'Đang thêm…'
                      : label,
                ),
              ),
          ],
        ),
      ),
    );
  }
}

// Các ô đơn vị tính chia đều toàn bộ chiều ngang, không giấu trong menu xổ xuống.
class _UnitOptions extends StatelessWidget {
  const _UnitOptions({
    required this.prices,
    required this.selectedId,
    required this.onSelected,
    this.dense = false,
  });
  final List<CatalogPrice> prices;
  final int? selectedId;
  final bool dense;
  final ValueChanged<int> onSelected;
  @override
  Widget build(BuildContext context) => Row(
    children: prices
        .map(
          (unit) => Expanded(
            child: Padding(
              padding: const EdgeInsets.symmetric(horizontal: 1),
              child: Semantics(
                selected: selectedId == unit.id,
                child: TextButton(
                  key: ValueKey('unit-option-${unit.id}'),
                  style:
                      CustomerProductColors.unitButtonStyle(
                        context,
                        selectedId == unit.id,
                      ).copyWith(
                        minimumSize: const WidgetStatePropertyAll(Size(0, 48)),
                        padding: const WidgetStatePropertyAll(
                          EdgeInsets.symmetric(horizontal: 2, vertical: 6),
                        ),
                        shape: WidgetStatePropertyAll(
                          RoundedRectangleBorder(
                            borderRadius: BorderRadius.circular(6),
                          ),
                        ),
                        textStyle: WidgetStateProperty.resolveWith(
                          (states) =>
                              (CustomerProductColors.unitButtonStyle(
                                        context,
                                        selectedId == unit.id,
                                      ).textStyle?.resolve(states) ??
                                      Theme.of(context).textTheme.labelLarge!)
                                  .copyWith(fontSize: dense ? 10 : 12),
                        ),
                      ),
                  onPressed: () => onSelected(unit.id),
                  child: Text(
                    unit.unit,
                    textAlign: TextAlign.center,
                    maxLines: 1,
                    overflow: TextOverflow.ellipsis,
                  ),
                ),
              ),
            ),
          ),
        )
        .toList(),
  );
}

class CustomerProductImage extends StatelessWidget {
  const CustomerProductImage({
    super.key,
    required this.product,
    this.compact = false,
    this.dense = false,
    this.showOffer = true,
  });
  final CatalogProduct product;
  final bool compact, dense, showOffer;
  @override
  Widget build(BuildContext context) {
    final uri = Uri.tryParse(product.image);
    const placeholder = Center(
      child: Icon(
        Icons.medication_outlined,
        size: 44,
        color: CustomerProductColors.productImagePlaceholder,
      ),
    );
    return Stack(
      children: [
        AspectRatio(
          aspectRatio: compact ? 1.6 : 1.3,
          child: uri != null && uri.scheme == 'https' && uri.host.isNotEmpty
              ? Image.network(
                  product.image,
                  fit: BoxFit.contain,
                  semanticLabel: product.name,
                  errorBuilder: (_, error, stack) => placeholder,
                  loadingBuilder: (_, child, progress) =>
                      progress == null ? child : placeholder,
                )
              : placeholder,
        ),
        if (showOffer && product.offerBadge != null)
          Positioned(
            top: 0,
            right: 0,
            child: Container(
              padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 4),
              decoration: BoxDecoration(
                color: CustomerProductColors.productBadgeBackground,
                borderRadius: BorderRadius.circular(6),
              ),
              child: Text(
                product.offerBadge!,
                style: TextStyle(
                  color: CustomerProductColors.productBadgeText,
                  fontSize: dense ? 9 : 11,
                  fontWeight: FontWeight.w600,
                ),
              ),
            ),
          ),
      ],
    );
  }
}

// Giá gốc, giá ưu đãi; ẩn giá của sản phẩm cần tư vấn.
class _PriceLabel extends StatelessWidget {
  const _PriceLabel({required this.product, this.selectedPrice});
  final CatalogProduct product;
  final CatalogPrice? selectedPrice;
  @override
  Widget build(BuildContext context) {
    if (product.consultation) {
      return const Text(
        'Cần dược sĩ tư vấn',
        style: TextStyle(
          color: CustomerProductColors.productConsultation,
          fontWeight: FontWeight.w600,
        ),
      );
    }
    final price = selectedPrice ?? product.displayPrice;
    if (price == null) {
      return const Text(
        'Chưa công bố giá',
        style: TextStyle(color: CustomerProductColors.productStock),
      );
    }
    final discounted =
        ((product.activeOffer || price.activeOffer) && price.discounted) ||
        (product.upcomingOffer &&
            price.sale != null &&
            price.sale! < price.original);
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Text(
          '${formatVnd(discounted ? price.sale! : price.original)} / ${price.unit}',
          style: const TextStyle(
            color: CustomerProductColors.productPrice,
            fontWeight: FontWeight.w600,
          ),
        ),
        if (discounted)
          Text(
            formatVnd(price.original),
            semanticsLabel: 'Giá gốc ${formatVnd(price.original)}',
            style: const TextStyle(
              decoration: TextDecoration.lineThrough,
              color: CustomerProductColors.productOriginalPrice,
              decorationColor: CustomerProductColors.productOriginalPrice,
            ),
          ),
        if (product.upcomingOffer && discounted)
          const Text(
            'Giá ưu đãi dự kiến',
            style: TextStyle(
              fontSize: 12,
              color: CustomerProductColors.productOfferCaption,
            ),
          ),
      ],
    );
  }
}
