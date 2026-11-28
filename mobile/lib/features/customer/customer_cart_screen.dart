import 'package:flutter/material.dart';
import 'package:flutter/semantics.dart';

import '../../core/theme/app_colors.dart';
import '../../models/catalog.dart';
import '../../models/customer_cart.dart';
import 'customer_components.dart';
import 'customer_home_controller.dart';
import 'customer_cart_controller.dart';

class CustomerCartColors {
  CustomerCartColors._();
  // Nền toàn trang giỏ hàng.
  static const page = AppColors.background;
  // Nền thanh tiêu đề Giỏ hàng.
  static const headerBackground = AppColors.appBarBackground;
  // Chữ Giỏ hàng trên thanh tiêu đề.
  static const headerTitle = AppColors.appBarForeground;
  // Mũi tên quay lại mua sắm.
  static const backIcon = AppColors.appBarForeground;
  // Nền thẻ sản phẩm.
  static const card = AppColors.surface;
  // Tên sản phẩm trong thẻ.
  static const productName = AppColors.textPrimary;
  // Nền vùng ảnh sản phẩm.
  static const imageBackground = AppColors.background;
  // Icon thay thế ảnh thuốc.
  static const imagePlaceholder = AppColors.textSecondary;
  // Giá hiện tại của sản phẩm.
  static const productPrice = AppColors.primaryDark;
  // Giá gốc gạch ngang.
  static const originalPrice = AppColors.textSecondary;
  // Icon tăng giảm số lượng.
  static const quantityIcon = AppColors.textPrimary;
  // Chữ số lượng sản phẩm.
  static const quantityText = AppColors.textPrimary;
  // Hai vạch ngăn cách nút trừ, số lượng và nút cộng trong ô số lượng.
  static const quantityDivider = AppColors.border;
  // Nền ô số lượng chia ba ngăn.
  static const quantityBackground = AppColors.surface;
  // Viền ô số lượng và đơn vị.
  static const controlBorder = AppColors.border;
  // Chữ đơn vị bán đang chọn.
  static const unitText = AppColors.textPrimary;
  // Nền nhãn Đang ưu đãi.
  static const offerBackground = AppColors.primaryLight;
  // Chữ Đang ưu đãi.
  static const offerText = AppColors.primaryDark;
  // Nền khối chương trình khuyến mãi dưới thẻ.
  static const promotionBackground = AppColors.background;
  // Icon giảm giá bên cạnh chương trình khuyến mãi.
  static const promotionIcon = AppColors.primaryDark;
  // Nội dung chương trình khuyến mãi.
  static const promotionText = AppColors.textSecondary;
  // Tiêu đề Giảm ...% / Chương trình khuyến mãi ở dưới thẻ sản phẩm.
  static const promotionTitle = AppColors.primaryDark;
  // Nền đỏ của nút xóa khi vuốt thẻ.
  static const deleteBackground = AppColors.error;
  // Icon thùng rác trong vùng xóa.
  static const deleteForeground = AppColors.surface;
  // Ô chọn sản phẩm đã chọn.
  static const selection = AppColors.primaryDark;
  // Dấu tích của ô chọn.
  static const selectionCheck = AppColors.surface;
  // Ẩn dấu tích mặc định để dùng dấu tích nhỏ hơn ở chính giữa ô tròn.
  static const selectionNativeCheck = Color(0x00000000);
  // Nhãn Chọn tất cả và số sản phẩm.
  static const selectionLabel = AppColors.textPrimary;
  // Chữ Tiếp tục mua sắm.
  static const continueText = AppColors.primaryDark;
  // Cảnh báo tồn kho hoặc điều kiện tư vấn.
  static const warning = AppColors.error;
  // Nền thanh tổng tiền cố định.
  static const summaryBackground = AppColors.surface;
  // Viền phía trên thanh tổng tiền.
  static const summaryBorder = AppColors.border;
  // Nhãn Thành tiền.
  static const totalLabel = AppColors.textPrimary;
  // Số tiền thanh toán dự kiến.
  static const totalAmount = AppColors.primaryDark;
  // Tổng giá gốc gạch ngang, nhỏ hơn giá hiện tại, dưới dòng Thành tiền.
  static const totalOriginalAmount = AppColors.textSecondary;
  // Nhãn Tiết kiệm được.
  static const savingLabel = AppColors.textSecondary;
  // Số tiền tiết kiệm được.
  static const savingAmount = AppColors.primaryDark;
  // Số xu dự kiến được nhận.
  static const earnedCoins = AppColors.warning;
  // Nền vàng của đồng xu giống --warning-color trên Website.
  static const coinBackground = Color(0xFFFFC107);
  // Viền và ký hiệu đồng xu giống --coin-edge trên Website.
  static const coinEdge = Color(0xFF9B6800);
  // Nền nút Mua hàng.
  static const buyBackground = AppColors.primaryDark;
  // Chữ nút Mua hàng.
  static const buyText = AppColors.surface;
  // Vòng tải khi kéo cập nhật giỏ.
  static const refresh = AppColors.primaryDark;
  // Chữ snackbar; null giữ Theme hiện tại.
  static const Color? snackbarText = null;
  // Lời nhắc ở giữa màn hình khi giỏ hàng trống.
  static const emptyMessage = AppColors.textSecondary;
  // Chữ nút Tiếp tục mua sắm ở trạng thái giỏ trống.
  static const emptyAction = AppColors.primaryDark;
  // Nền hộp thoại xác nhận xóa sản phẩm.
  static const confirmBackground = AppColors.surface;
  // Tiêu đề Xóa sản phẩm trong hộp thoại.
  static const confirmTitle = AppColors.textPrimary;
  // Câu hỏi có tên sản phẩm trong hộp thoại xác nhận.
  static const confirmDescription = AppColors.textSecondary;
  // Biểu tượng thùng rác trong hộp thoại xác nhận.
  static const confirmIcon = AppColors.error;
  // Nền tròn nhạt sau icon thùng rác.
  static const confirmIconBackground = AppColors.errorBackground;
  // Biểu tượng đóng hộp thoại xác nhận xóa.
  static const confirmCloseIcon = AppColors.textPrimary;
  // Nền nút Giữ lại sản phẩm.
  static const confirmCancelBackground = AppColors.background;
  // Chữ nút Giữ lại sản phẩm.
  static const confirmCancelText = AppColors.primaryDark;
  // Nền nút xác nhận Xóa sản phẩm.
  static const confirmDeleteBackground = AppColors.error;
  // Chữ nút xác nhận Xóa sản phẩm.
  static const confirmDeleteText = AppColors.surface;
  // Lớp phủ sau hộp thoại; null giữ màu Theme hiện tại.
  static const Color? confirmBarrier = null;
}

// Trang giỏ giữ lựa chọn và báo giá, dùng chung dữ liệu lưu giỏ với shell.
class CustomerCartScreen extends StatefulWidget {
  const CustomerCartScreen({
    super.key,
    required this.home,
    required this.onContinue,
    required this.onCheckout,
  });
  final CustomerHomeController home;
  final VoidCallback onContinue;
  final ValueChanged<List<int>> onCheckout;
  @override
  State<CustomerCartScreen> createState() => _CustomerCartScreenState();
}

class _CustomerCartScreenState extends State<CustomerCartScreen> {
  late final CustomerCartController controller;
  bool confirmingRemoval = false;
  bool get empty =>
      !widget.home.cartLoading &&
      widget.home.cartError == null &&
      widget.home.cart != null &&
      widget.home.cart!.items.isEmpty;
  @override
  void initState() {
    super.initState();
    controller = CustomerCartController(widget.home);
  }

  @override
  void dispose() {
    controller.dispose();
    super.dispose();
  }

  Future<void> edit(CartLine line, int quantity, {int? unitId}) async {
    if (quantity == 0) {
      if (confirmingRemoval || controller.busy) return;
      final owner = widget.home.customerId;
      confirmingRemoval = true;
      final confirmed = await showDialog<bool>(
        context: context,
        barrierColor: CustomerCartColors.confirmBarrier,
        builder: (_) => _ConfirmCartRemoval(name: line.name),
      );
      confirmingRemoval = false;
      if (!mounted || confirmed != true || owner != widget.home.customerId) {
        return;
      }
    }
    final ok = await widget.home.editCart(
      line,
      quantity,
      destinationId: unitId,
    );
    if (!mounted) return;
    if (!ok) {
      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(
          content: Text(
            widget.home.purchaseMessage ?? 'Chưa thể cập nhật giỏ.',
            style: const TextStyle(color: CustomerCartColors.snackbarText),
          ),
        ),
      );
    }
  }

  @override
  Widget build(BuildContext context) => ListenableBuilder(
    listenable: controller,
    builder: (context, _) => Scaffold(
      backgroundColor: CustomerCartColors.page,
      appBar: AppBar(
        backgroundColor: CustomerCartColors.headerBackground,
        leading: IconButton(
          tooltip: 'Tiếp tục mua sắm',
          onPressed: widget.onContinue,
          icon: const Icon(
            Icons.arrow_back,
            color: CustomerCartColors.backIcon,
          ),
        ),
        title: const Text(
          'Giỏ hàng',
          style: TextStyle(color: CustomerCartColors.headerTitle),
        ),
      ),
      bottomNavigationBar: empty
          ? null
          : _CartSummary(
              controller: controller,
              onCheckout: () =>
                  widget.onCheckout(controller.selected.toList()..sort()),
            ),
      body: empty
          ? _EmptyCart(onContinue: widget.onContinue)
          : RefreshIndicator(
              color: CustomerCartColors.refresh,
              onRefresh: () async {
                await widget.home.loadCart();
                await controller.refresh();
              },
              child: ListView(
                key: const ValueKey('customer-cart'),
                padding: const EdgeInsets.fromLTRB(12, 0, 12, 24),
                physics: const AlwaysScrollableScrollPhysics(),
                children: [
                  _CartSelection(
                    controller: controller,
                    onContinue: widget.onContinue,
                  ),
                  if (widget.home.cartLoading && widget.home.cart == null)
                    const CustomerStatus(loading: true)
                  else if (widget.home.cartError != null)
                    CustomerStatus(
                      message: widget.home.cartError!,
                      onRetry: widget.home.loadCart,
                    )
                  else if (controller.lines.isEmpty)
                    const CustomerStatus(message: 'Giỏ hàng chưa có sản phẩm.')
                  else ...[
                    Text(
                      '${widget.home.cart?.productCount ?? 0} sản phẩm',
                      style: const TextStyle(
                        color: CustomerCartColors.selectionLabel,
                      ),
                    ),
                    const SizedBox(height: 12),
                    if (controller.loading)
                      const LinearProgressIndicator(
                        color: CustomerCartColors.refresh,
                      ),
                    if (controller.error != null)
                      CustomerStatus(
                        message: controller.error!,
                        onRetry: controller.refresh,
                      ),
                    for (final line in controller.lines)
                      Padding(
                        padding: const EdgeInsets.only(bottom: 12),
                        child: _SwipeCartLine(
                          key: ValueKey('cart-line-${line.unitId}'),
                          unitId: line.unitId,
                          disabled: controller.busy,
                          onDelete: () => edit(line, 0),
                          child: _CartProductCard(
                            line: line,
                            selected: controller.selected.contains(line.unitId),
                            busy: controller.busy,
                            onToggle: () => controller.toggle(line.unitId),
                            onQuantity: (q) => edit(line, q),
                            onUnit: (id) =>
                                edit(line, line.quantity, unitId: id),
                          ),
                        ),
                      ),
                  ],
                ],
              ),
            ),
    ),
  );
}

// Giỏ trống chỉ hiện lời nhắc và đường dẫn tiếp tục mua sắm ở giữa màn hình.
class _EmptyCart extends StatelessWidget {
  const _EmptyCart({required this.onContinue});
  final VoidCallback onContinue;
  @override
  Widget build(BuildContext context) => Center(
    key: const ValueKey('cart-empty'),
    child: SingleChildScrollView(
      padding: const EdgeInsets.all(24),
      child: Column(
        mainAxisSize: MainAxisSize.min,
        children: [
          const Text(
            'Giỏ hàng hiện tại đang trống',
            textAlign: TextAlign.center,
            style: TextStyle(
              color: CustomerCartColors.emptyMessage,
              fontSize: 16,
              height: 1.5,
            ),
          ),
          const SizedBox(height: 8),
          TextButton(
            key: const ValueKey('cart-empty-continue'),
            onPressed: onContinue,
            style: TextButton.styleFrom(
              foregroundColor: CustomerCartColors.emptyAction,
            ),
            child: const Text('Tiếp tục mua sắm'),
          ),
        ],
      ),
    ),
  );
}

// Hộp xác nhận cùng kiểu bo góc với thông báo đăng nhập, chỉ xóa sau khi xác nhận.
class _ConfirmCartRemoval extends StatelessWidget {
  const _ConfirmCartRemoval({required this.name});
  final String name;
  @override
  Widget build(BuildContext context) => Dialog(
    key: const ValueKey('cart-delete-dialog'),
    backgroundColor: CustomerCartColors.confirmBackground,
    insetPadding: const EdgeInsets.all(20),
    shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(24)),
    child: ConstrainedBox(
      constraints: const BoxConstraints(maxWidth: 420),
      child: SingleChildScrollView(
        padding: const EdgeInsets.fromLTRB(24, 8, 24, 24),
        child: Column(
          mainAxisSize: MainAxisSize.min,
          children: [
            Align(
              alignment: Alignment.centerRight,
              child: IconButton(
                tooltip: 'Đóng',
                onPressed: () => Navigator.pop(context, false),
                icon: const Icon(
                  Icons.close,
                  color: CustomerCartColors.confirmCloseIcon,
                ),
              ),
            ),
            Container(
              width: 72,
              height: 72,
              decoration: const BoxDecoration(
                shape: BoxShape.circle,
                color: CustomerCartColors.confirmIconBackground,
              ),
              child: const Icon(
                Icons.delete_outline,
                size: 36,
                color: CustomerCartColors.confirmIcon,
              ),
            ),
            const SizedBox(height: 20),
            const Text(
              'Xóa sản phẩm?',
              textAlign: TextAlign.center,
              style: TextStyle(
                color: CustomerCartColors.confirmTitle,
                fontSize: 22,
                fontWeight: FontWeight.w600,
              ),
            ),
            const SizedBox(height: 12),
            Text(
              'Bạn có muốn xóa “$name” khỏi giỏ hàng không?',
              textAlign: TextAlign.center,
              style: const TextStyle(
                color: CustomerCartColors.confirmDescription,
                fontSize: 14,
                height: 1.5,
              ),
            ),
            const SizedBox(height: 24),
            Wrap(
              alignment: WrapAlignment.center,
              spacing: 12,
              runSpacing: 12,
              children: [
                TextButton(
                  key: const ValueKey('cart-delete-cancel'),
                  onPressed: () => Navigator.pop(context, false),
                  style: TextButton.styleFrom(
                    backgroundColor: CustomerCartColors.confirmCancelBackground,
                    foregroundColor: CustomerCartColors.confirmCancelText,
                    minimumSize: const Size(120, 48),
                  ),
                  child: const Text('Giữ lại'),
                ),
                FilledButton(
                  key: const ValueKey('cart-delete-confirm'),
                  onPressed: () => Navigator.pop(context, true),
                  style: FilledButton.styleFrom(
                    backgroundColor: CustomerCartColors.confirmDeleteBackground,
                    foregroundColor: CustomerCartColors.confirmDeleteText,
                    minimumSize: const Size(120, 48),
                  ),
                  child: const Text('Xóa sản phẩm'),
                ),
              ],
            ),
          ],
        ),
      ),
    ),
  );
}

// Chọn tất cả và tiếp tục mua sắm tự xuống hàng trên màn nhỏ.
class _CartSelection extends StatelessWidget {
  const _CartSelection({required this.controller, required this.onContinue});
  final CustomerCartController controller;
  final VoidCallback onContinue;
  @override
  Widget build(BuildContext context) => Padding(
    padding: const EdgeInsets.symmetric(vertical: 8),
    child: Wrap(
      alignment: WrapAlignment.spaceBetween,
      crossAxisAlignment: WrapCrossAlignment.center,
      children: [
        Row(
          mainAxisSize: MainAxisSize.min,
          children: [
            _CartCheck(
              value: controller.allSelected,
              onChanged: controller.busy ? null : (_) => controller.selectAll(),
            ),
            const Flexible(
              child: Text(
                'Chọn tất cả',
                style: TextStyle(color: CustomerCartColors.selectionLabel),
              ),
            ),
          ],
        ),
        TextButton(
          onPressed: onContinue,
          style: TextButton.styleFrom(
            foregroundColor: CustomerCartColors.continueText,
          ),
          child: const Text('Tiếp tục mua sắm'),
        ),
      ],
    ),
  );
}

// Ô chọn tròn giữ hành vi bàn phím của Checkbox, dấu tích nhỏ 11px ở chính giữa.
class _CartCheck extends StatelessWidget {
  const _CartCheck({
    required this.value,
    required this.onChanged,
    this.semanticLabel,
  });
  final bool value;
  final ValueChanged<bool?>? onChanged;
  final String? semanticLabel;
  @override
  Widget build(BuildContext context) => SizedBox(
    width: 40,
    height: 40,
    child: Stack(
      alignment: Alignment.center,
      children: [
        Checkbox(
          value: value,
          onChanged: onChanged,
          semanticLabel: semanticLabel,
          shape: const CircleBorder(),
          activeColor: CustomerCartColors.selection,
          checkColor: CustomerCartColors.selectionNativeCheck,
        ),
        if (value)
          const IgnorePointer(
            child: ExcludeSemantics(
              child: Icon(
                Icons.check,
                size: 11,
                color: CustomerCartColors.selectionCheck,
              ),
            ),
          ),
      ],
    ),
  );
}

// Vuốt phải sang trái chỉ mở nút xóa đỏ, phải bấm nút mới thực sự xóa.
class _SwipeCartLine extends StatefulWidget {
  const _SwipeCartLine({
    super.key,
    required this.unitId,
    required this.child,
    required this.onDelete,
    required this.disabled,
  });
  final int unitId;
  final Widget child;
  final VoidCallback onDelete;
  final bool disabled;
  @override
  State<_SwipeCartLine> createState() => _SwipeCartLineState();
}

class _SwipeCartLineState extends State<_SwipeCartLine> {
  double reveal = 0;
  @override
  Widget build(BuildContext context) => Semantics(
    customSemanticsActions: widget.disabled
        ? null
        : {
            const CustomSemanticsAction(label: 'Xóa khỏi giỏ hàng'):
                widget.onDelete,
          },
    child: ClipRRect(
      borderRadius: BorderRadius.circular(16),
      child: Stack(
        children: [
          Positioned.fill(
            child: ColoredBox(
              color: reveal == 0
                  ? CustomerCartColors.card
                  : CustomerCartColors.deleteBackground,
              child: Align(
                alignment: Alignment.centerRight,
                child: SizedBox(
                  width: 80,
                  child: IconButton(
                    key: ValueKey('cart-delete-${widget.unitId}'),
                    tooltip: 'Xóa sản phẩm',
                    onPressed: widget.disabled || reveal == 0
                        ? null
                        : widget.onDelete,
                    color: CustomerCartColors.deleteForeground,
                    icon: const Icon(Icons.delete_outline, size: 30),
                  ),
                ),
              ),
            ),
          ),
          GestureDetector(
            onHorizontalDragUpdate: widget.disabled
                ? null
                : (e) => setState(
                    () => reveal = (reveal - e.delta.dx).clamp(0.0, 80.0),
                  ),
            onHorizontalDragEnd: widget.disabled
                ? null
                : (_) => setState(() => reveal = reveal > 32 ? 80 : 0),
            child: AnimatedContainer(
              duration: MediaQuery.disableAnimationsOf(context)
                  ? Duration.zero
                  : const Duration(milliseconds: 150),
              transform: Matrix4.translationValues(-reveal, 0, 0),
              child: widget.child,
            ),
          ),
        ],
      ),
    ),
  );
}

// Thẻ sản phẩm gồm ảnh, giá, số lượng, đơn vị và chương trình ưu đãi.
class _CartProductCard extends StatelessWidget {
  const _CartProductCard({
    required this.line,
    required this.selected,
    required this.busy,
    required this.onToggle,
    required this.onQuantity,
    required this.onUnit,
  });
  final CartLine line;
  final bool selected, busy;
  final VoidCallback onToggle;
  final ValueChanged<int> onQuantity, onUnit;
  @override
  Widget build(BuildContext context) => Container(
    color: CustomerCartColors.card,
    padding: const EdgeInsets.fromLTRB(4, 12, 12, 12),
    child: Row(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        _CartCheck(
          value: selected,
          onChanged: busy ? null : (_) => onToggle(),
          semanticLabel: 'Chọn ${line.name}',
        ),
        Expanded(
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.stretch,
            children: [
              Row(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  _CartImage(line: line),
                  const SizedBox(width: 8),
                  Expanded(
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        if (line.discounted)
                          Container(
                            padding: const EdgeInsets.symmetric(
                              horizontal: 8,
                              vertical: 4,
                            ),
                            margin: const EdgeInsets.only(bottom: 8),
                            decoration: BoxDecoration(
                              color: CustomerCartColors.offerBackground,
                              borderRadius: BorderRadius.circular(6),
                            ),
                            child: Text(
                              line.discountPercent == null
                                  ? 'Đang ưu đãi'
                                  : 'Đang ưu đãi · -${line.discountPercent}%',
                              style: const TextStyle(
                                color: CustomerCartColors.offerText,
                                fontWeight: FontWeight.w600,
                                fontSize: 11,
                              ),
                            ),
                          ),
                        Text(
                          line.packaging.isEmpty
                              ? line.name
                              : '${line.name} (${line.packaging})',
                          style: const TextStyle(
                            color: CustomerCartColors.productName,
                            fontWeight: FontWeight.w600,
                            fontSize: 13,
                            height: 1.45,
                          ),
                        ),
                        const SizedBox(height: 8),
                        if (line.consultation)
                          const Text(
                            'Cần dược sĩ tư vấn',
                            style: TextStyle(color: CustomerCartColors.warning),
                          )
                        else
                          Wrap(
                            spacing: 8,
                            runSpacing: 4,
                            crossAxisAlignment: WrapCrossAlignment.center,
                            children: [
                              Text(
                                line.price == null
                                    ? 'Chưa tính được giá'
                                    : formatVnd(line.price!),
                                key: ValueKey('cart-price-${line.unitId}'),
                                style: const TextStyle(
                                  color: CustomerCartColors.productPrice,
                                  fontSize: 16,
                                  fontWeight: FontWeight.w600,
                                ),
                              ),
                              if (line.discounted)
                                Text(
                                  formatVnd(line.original!),
                                  key: ValueKey('cart-original-${line.unitId}'),
                                  style: const TextStyle(
                                    color: CustomerCartColors.originalPrice,
                                    fontSize: 11,
                                    decorationColor:
                                        CustomerCartColors.originalPrice,
                                    decoration: TextDecoration.lineThrough,
                                  ),
                                ),
                            ],
                          ),
                        if (!line.available)
                          const Padding(
                            padding: EdgeInsets.only(top: 6),
                            child: Text(
                              'Cần kiểm tra lại tồn kho',
                              style: TextStyle(
                                color: CustomerCartColors.warning,
                              ),
                            ),
                          ),
                        const SizedBox(height: 8),
                        Wrap(
                          spacing: 6,
                          runSpacing: 8,
                          crossAxisAlignment: WrapCrossAlignment.center,
                          children: [
                            _QuantityControl(
                              line: line,
                              busy: busy,
                              onChanged: onQuantity,
                            ),
                            _UnitSelector(
                              line: line,
                              busy: busy,
                              onSelected: onUnit,
                            ),
                          ],
                        ),
                      ],
                    ),
                  ),
                ],
              ),
              if (line.discounted)
                Container(
                  margin: const EdgeInsets.only(top: 14),
                  padding: const EdgeInsets.all(12),
                  decoration: BoxDecoration(
                    color: CustomerCartColors.promotionBackground,
                    borderRadius: BorderRadius.circular(10),
                  ),
                  child: Row(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      const Icon(
                        Icons.sell_outlined,
                        color: CustomerCartColors.promotionIcon,
                        size: 22,
                      ),
                      const SizedBox(width: 8),
                      Expanded(
                        child: Column(
                          crossAxisAlignment: CrossAxisAlignment.start,
                          children: [
                            Text(
                              line.discountPercent == null
                                  ? 'Chương trình khuyến mãi'
                                  : 'Giảm ${line.discountPercent}% · Chương trình khuyến mãi',
                              style: const TextStyle(
                                color: CustomerCartColors.promotionTitle,
                                fontSize: 11,
                                fontWeight: FontWeight.w600,
                              ),
                            ),
                            if (line.promotionName.isNotEmpty) ...[
                              const SizedBox(height: 4),
                              Text(
                                line.promotionName,
                                style: const TextStyle(
                                  color: CustomerCartColors.promotionText,
                                  fontSize: 11,
                                  height: 1.45,
                                ),
                              ),
                            ],
                            if (line.promotionalQuantity > 0 &&
                                line.promotionalQuantity < line.quantity)
                              Text(
                                'Áp dụng ${line.promotionalQuantity}/${line.quantity} ${line.unit}',
                                style: const TextStyle(
                                  color: CustomerCartColors.promotionText,
                                  fontSize: 11,
                                ),
                              ),
                          ],
                        ),
                      ),
                    ],
                  ),
                ),
            ],
          ),
        ),
      ],
    ),
  );
}

// Ảnh thuốc có icon dự phòng và chỉ dùng ảnh HTTPS.
class _CartImage extends StatelessWidget {
  const _CartImage({required this.line});
  final CartLine line;
  @override
  Widget build(BuildContext context) {
    const placeholder = Icon(
      Icons.medication_outlined,
      color: CustomerCartColors.imagePlaceholder,
      size: 32,
    );
    final uri = Uri.tryParse(line.image);
    return Container(
      width: 48,
      height: 56,
      padding: const EdgeInsets.all(6),
      decoration: BoxDecoration(
        color: CustomerCartColors.imageBackground,
        borderRadius: BorderRadius.circular(10),
      ),
      child: uri?.scheme == 'https' && uri!.host.isNotEmpty
          ? Image.network(
              line.image,
              fit: BoxFit.contain,
              semanticLabel: line.name,
              errorBuilder: (_, _, _) => placeholder,
            )
          : placeholder,
    );
  }
}

// Giảm từ một về không sẽ xóa sản phẩm khỏi giỏ.
class _QuantityControl extends StatelessWidget {
  const _QuantityControl({
    required this.line,
    required this.busy,
    required this.onChanged,
  });
  final CartLine line;
  final bool busy;
  final ValueChanged<int> onChanged;
  @override
  Widget build(BuildContext context) => Container(
    key: ValueKey('cart-quantity-control-${line.unitId}'),
    clipBehavior: Clip.antiAlias,
    decoration: BoxDecoration(
      color: CustomerCartColors.quantityBackground,
      border: Border.all(color: CustomerCartColors.controlBorder),
      borderRadius: BorderRadius.circular(24),
    ),
    child: SizedBox(
      height: (MediaQuery.textScalerOf(context).scale(12) * 1.5)
          .clamp(34.0, double.infinity)
          .toDouble(),
      child: Row(
        mainAxisSize: MainAxisSize.min,
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: [
          SizedBox(
            width: 34,
            child: IconButton(
              key: ValueKey('cart-minus-${line.unitId}'),
              padding: EdgeInsets.zero,
              iconSize: 17,
              tooltip: line.quantity == 1
                  ? 'Xóa ${line.name}'
                  : 'Giảm số lượng',
              onPressed: busy ? null : () => onChanged(line.quantity - 1),
              icon: const Icon(
                Icons.remove,
                color: CustomerCartColors.quantityIcon,
              ),
            ),
          ),
          const VerticalDivider(
            width: 1,
            thickness: 1,
            color: CustomerCartColors.quantityDivider,
          ),
          SizedBox(
            width: 30,
            child: Center(
              child: Padding(
                padding: const EdgeInsets.symmetric(horizontal: 4),
                child: FittedBox(
                  fit: BoxFit.scaleDown,
                  child: Text(
                    '${line.quantity}',
                    key: ValueKey('cart-quantity-${line.unitId}'),
                    style: const TextStyle(
                      color: CustomerCartColors.quantityText,
                      fontSize: 12,
                      fontWeight: FontWeight.w500,
                    ),
                  ),
                ),
              ),
            ),
          ),
          const VerticalDivider(
            width: 1,
            thickness: 1,
            color: CustomerCartColors.quantityDivider,
          ),
          SizedBox(
            width: 34,
            child: IconButton(
              key: ValueKey('cart-plus-${line.unitId}'),
              padding: EdgeInsets.zero,
              iconSize: 17,
              tooltip: 'Tăng số lượng',
              onPressed: busy || !line.available
                  ? null
                  : () => onChanged(line.quantity + 1),
              icon: const Icon(
                Icons.add,
                color: CustomerCartColors.quantityIcon,
              ),
            ),
          ),
        ],
      ),
    ),
  );
}

// Đơn vị bán chỉ lấy từ Backend, không tự suy ra hệ số quy đổi.
class _UnitSelector extends StatelessWidget {
  const _UnitSelector({
    required this.line,
    required this.busy,
    required this.onSelected,
  });
  final CartLine line;
  final bool busy;
  final ValueChanged<int> onSelected;
  @override
  Widget build(BuildContext context) {
    final units = {
      for (final i in line.units)
        i['MaDonGia'] as int: i['DonViTinh'] as String,
      line.unitId: line.unit,
    };
    return Container(
      width: MediaQuery.textScalerOf(context).scale(12) > 18 ? 104 : 76,
      height: (MediaQuery.textScalerOf(context).scale(12) * 1.5)
          .clamp(36.0, double.infinity)
          .toDouble(),
      alignment: Alignment.center,
      padding: const EdgeInsets.symmetric(horizontal: 8),
      decoration: BoxDecoration(
        border: Border.all(color: CustomerCartColors.controlBorder),
        borderRadius: BorderRadius.circular(24),
      ),
      child: DropdownButtonHideUnderline(
        child: DropdownButton<int>(
          key: ValueKey('cart-unit-${line.unitId}'),
          value: line.unitId,
          isExpanded: true,
          isDense: true,
          iconSize: 16,
          style: Theme.of(context).textTheme.bodyMedium
              ?.copyWith(color: CustomerCartColors.unitText, fontSize: 12),
          onChanged: busy || units.length < 2
              ? null
              : (id) {
                  if (id != null && id != line.unitId) onSelected(id);
                },
          items: units.entries
              .map(
                (i) => DropdownMenuItem(
                  value: i.key,
                  child: Text(
                    i.value,
                    maxLines: 1,
                    overflow: TextOverflow.ellipsis,
                  ),
                ),
              )
              .toList(),
        ),
      ),
    );
  }
}

// Hai mức giá luôn cùng một hàng; giá gốc nhỏ hơn và gạch ngang.
class _CartTotal extends StatelessWidget {
  const _CartTotal({required this.controller});
  final CustomerCartController controller;
  @override
  Widget build(BuildContext context) {
    final summary = controller.summary;
    const label = Text(
      'Thành tiền',
      style: TextStyle(
        color: CustomerCartColors.totalLabel,
        fontSize: 14,
        fontWeight: FontWeight.w600,
      ),
    );
    final prices = FittedBox(
      fit: BoxFit.scaleDown,
      alignment: Alignment.centerRight,
      child: Row(
        mainAxisSize: MainAxisSize.min,
        crossAxisAlignment: CrossAxisAlignment.baseline,
        textBaseline: TextBaseline.alphabetic,
        children: [
          if (!controller.loading &&
              controller.error == null &&
              summary?.total != null &&
              summary!.savings > BigInt.zero) ...[
            Text(
              formatVnd(summary.originalTotal),
              key: const ValueKey('cart-original-total'),
              semanticsLabel:
                  'Tổng giá gốc ${formatVnd(summary.originalTotal)}',
              style: const TextStyle(
                color: CustomerCartColors.totalOriginalAmount,
                fontSize: 11,
                decoration: TextDecoration.lineThrough,
                decorationColor: CustomerCartColors.totalOriginalAmount,
              ),
            ),
            const SizedBox(width: 8),
          ],
          Text(
            controller.loading
                ? 'Đang tính…'
                : summary?.total == null || controller.error != null
                ? 'Chưa tính được'
                : formatVnd(summary!.total!),
            key: const ValueKey('cart-total'),
            style: const TextStyle(
              color: CustomerCartColors.totalAmount,
              fontSize: 18,
              fontWeight: FontWeight.w600,
            ),
          ),
        ],
      ),
    );
    if (MediaQuery.textScalerOf(context).scale(14) > 21) {
      return Column(
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: [
          label,
          const SizedBox(height: 4),
          Align(alignment: Alignment.centerRight, child: prices),
        ],
      );
    }
    return Row(
      children: [
        label,
        const SizedBox(width: 12),
        Expanded(child: prices),
      ],
    );
  }
}

// Thanh cố định: thành tiền, tiết kiệm, xu sẽ nhận và Mua hàng; không đổi xu.
class _CartSummary extends StatelessWidget {
  const _CartSummary({required this.controller, required this.onCheckout});
  final CustomerCartController controller;
  final VoidCallback onCheckout;
  @override
  Widget build(BuildContext context) {
    final summary = controller.summary;
    return Container(
      key: const ValueKey('cart-summary'),
      padding: const EdgeInsets.fromLTRB(16, 12, 16, 12),
      decoration: const BoxDecoration(
        color: CustomerCartColors.summaryBackground,
        border: Border(
          top: BorderSide(color: CustomerCartColors.summaryBorder),
        ),
      ),
      child: SafeArea(
        top: false,
        child: Column(
          mainAxisSize: MainAxisSize.min,
          crossAxisAlignment: CrossAxisAlignment.stretch,
          children: [
            _CartTotal(controller: controller),
            const SizedBox(height: 8),
            Wrap(
              alignment: WrapAlignment.spaceBetween,
              spacing: 12,
              runSpacing: 10,
              crossAxisAlignment: WrapCrossAlignment.center,
              children: [
                Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    if (summary?.total != null &&
                        summary!.savings > BigInt.zero)
                      Text.rich(
                        TextSpan(
                          text: 'Tiết kiệm được ',
                          children: [
                            TextSpan(
                              text: formatVnd(summary.savings),
                              style: const TextStyle(
                                color: CustomerCartColors.savingAmount,
                              ),
                            ),
                          ],
                        ),
                        style: const TextStyle(
                          color: CustomerCartColors.savingLabel,
                          fontSize: 13,
                        ),
                      ),
                    if (summary?.total != null &&
                        summary!.savings > BigInt.zero)
                      const SizedBox(height: 6),
                    Row(
                      mainAxisSize: MainAxisSize.min,
                      children: [
                        const _RewardCoin(),
                        const SizedBox(width: 6),
                        Flexible(
                          child: Text(
                            summary?.estimatedPoints == null ||
                                    controller.loading
                                ? 'Xu dự kiến: —'
                                : 'Dự kiến +${summary!.estimatedPoints} xu',
                            style: const TextStyle(
                              color: CustomerCartColors.earnedCoins,
                              fontSize: 13,
                            ),
                          ),
                        ),
                      ],
                    ),
                  ],
                ),
                FilledButton(
                  key: const ValueKey('cart-buy'),
                  onPressed: controller.canBuy ? onCheckout : null,
                  style: FilledButton.styleFrom(
                    backgroundColor: CustomerCartColors.buyBackground,
                    foregroundColor: CustomerCartColors.buyText,
                    minimumSize: const Size(130, 48),
                    shape: const StadiumBorder(),
                  ),
                  child: const Text('Mua hàng'),
                ),
              ],
            ),
          ],
        ),
      ),
    );
  }
}

// Đồng xu Website: nền vàng, hai viền nâu và ký hiệu ₫ ở giữa.
class _RewardCoin extends StatelessWidget {
  const _RewardCoin();
  @override
  Widget build(BuildContext context) => Semantics(
    label: 'Xu',
    image: true,
    child: Container(
      width: 24,
      height: 24,
      padding: const EdgeInsets.all(2),
      decoration: BoxDecoration(
        shape: BoxShape.circle,
        color: CustomerCartColors.coinBackground,
        border: Border.all(color: CustomerCartColors.coinEdge, width: 1.4),
      ),
      child: Container(
        alignment: Alignment.center,
        decoration: BoxDecoration(
          shape: BoxShape.circle,
          border: Border.all(color: CustomerCartColors.coinEdge, width: .8),
        ),
        child: const Text(
          '₫',
          style: TextStyle(
            color: CustomerCartColors.coinEdge,
            fontSize: 13,
            fontWeight: FontWeight.w700,
            height: 1,
          ),
        ),
      ),
    ),
  );
}
