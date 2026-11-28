import 'package:flutter/material.dart';

import '../../core/network/api.dart';
import '../../core/storage/checkout_storage.dart';
import '../../core/theme/app_colors.dart';
import '../../models/catalog.dart';
import '../../models/checkout.dart';
import '../../models/customer_cart.dart';
import '../../models/session_user.dart';
import 'customer_checkout_controller.dart';
import 'customer_order_screen.dart';

class CustomerCheckoutColors {
  CustomerCheckoutColors._();
  // Nền toàn trang xác nhận đặt hàng.
  static const background = AppColors.background;
  // Nền xanh cố định Appbar.
  static const headerBackground = AppColors.appBarBackground;
  // Chữ và mũi tên Appbar.
  static const headerForeground = AppColors.appBarForeground;
  // Nền từng phần nhận hàng/địa chỉ/sản phẩm/thanh toán.
  static const sectionBackground = AppColors.surface;
  // Tiêu đề từng phần đặt hàng.
  static const sectionTitle = AppColors.textPrimary;
  // Nội dung thông tin nhận hàng.
  static const bodyText = AppColors.textPrimary;
  // Địa chỉ phụ, quy cách và chú thích thanh toán.
  static const secondaryText = AppColors.textSecondary;
  // Chữ nút Thêm/Sửa địa chỉ.
  static const addressAction = AppColors.primaryDark;
  // Icon và chữ thông tin giao hàng.
  static const deliveryNoteText = AppColors.warning;
  // Nền lưu ý giao hàng.
  static const deliveryNoteBackground = AppColors.warningBackground;
  // Giá bán hiện tại trong sản phẩm đã chọn.
  static const productPrice = AppColors.primaryDark;
  // Giá gốc gạch ngang trong danh sách sản phẩm.
  static const productOriginal = AppColors.textSecondary;
  // Chữ chương trình khuyến mãi và lượng được ưu đãi.
  static const productPromotion = AppColors.primaryDark;
  // Đường phân cách sản phẩm và các dòng tổng tiền.
  static const divider = AppColors.border;
  // Màu lựa chọn hình thức nhận hàng/phương thức thanh toán.
  static const radio = AppColors.primaryDark;
  // Nền thanh nút đặt hàng cố định.
  static const bottomBackground = AppColors.surface;
  // Số tiền hàng cuối cùng ở thanh cố định.
  static const total = AppColors.primaryDark;
  // Nền nút Đặt hàng.
  static const submitBackground = AppColors.primaryDark;
  // Chữ nút Đặt hàng.
  static const submitText = AppColors.surface;
  // Chữ lỗi tải báo giá hoặc tạo đơn.
  static const error = AppColors.error;
  // Nền dialog thêm/sửa địa chỉ.
  static const addressDialogBackground = AppColors.surface;
  // Tiêu đề dialog địa chỉ.
  static const addressDialogTitle = AppColors.textPrimary;
  // Chữ nhập địa chỉ, ghi chú.
  static const fieldText = AppColors.textPrimary;
}

// Xác nhận đặt hàng riêng, chỉ nhận mã đơn vị đã chọn; mọi giá đều lấy lại từ Backend.
class CustomerCheckoutScreen extends StatefulWidget {
  const CustomerCheckoutScreen({
    super.key,
    required this.api,
    required this.units,
    required this.user,
    required this.storage,
    required this.onCreated,
  });
  final CheckoutApi api;
  final List<int> units;
  final SessionUser user;
  final CheckoutStorage storage;
  final VoidCallback onCreated;
  @override
  State<CustomerCheckoutScreen> createState() => _CustomerCheckoutScreenState();
}

class _CustomerCheckoutScreenState extends State<CustomerCheckoutScreen>
    with WidgetsBindingObserver {
  late final CustomerCheckoutController controller;
  bool notified = false;
  @override
  void initState() {
    super.initState();
    WidgetsBinding.instance.addObserver(this);
    controller = CustomerCheckoutController(
      widget.api,
      widget.units,
      widget.storage,
    )..addListener(changed);
    controller.initialize();
  }

  void changed() {
    if (controller.order != null && !notified) {
      notified = true;
      widget.onCreated();
    }
  }

  @override
  void didChangeAppLifecycleState(AppLifecycleState state) {
    if (state == AppLifecycleState.resumed &&
        controller.order == null &&
        !controller.submitting) {
      controller.refreshQuote();
    }
  }

  @override
  void dispose() {
    WidgetsBinding.instance.removeObserver(this);
    controller.removeListener(changed);
    controller.dispose();
    super.dispose();
  }

  Future<void> editAddress([DeliveryAddress? address]) => showDialog<void>(
    context: context,
    builder: (_) => _AddressDialog(controller: controller, address: address),
  );
  @override
  Widget build(BuildContext context) => ListenableBuilder(
    listenable: controller,
    builder: (context, _) {
      if (controller.order case final order?) {
        return CustomerOrderScreen(api: widget.api, initial: order);
      }
      final quote = controller.quote;
      return Scaffold(
        key: const ValueKey('customer-checkout'),
        backgroundColor: CustomerCheckoutColors.background,
        appBar: AppBar(
          backgroundColor: CustomerCheckoutColors.headerBackground,
          foregroundColor: CustomerCheckoutColors.headerForeground,
          title: const Text('Xác nhận đặt hàng'),
        ),
        bottomNavigationBar: _CheckoutBottom(controller: controller),
        body: ListView(
          key: const ValueKey('checkout-scroll'),
          padding: const EdgeInsets.all(16),
          children: [
            if (controller.loading || controller.quoting)
              const LinearProgressIndicator(
                color: CustomerCheckoutColors.radio,
              ),
            if (controller.error != null)
              Padding(
                padding: const EdgeInsets.only(bottom: 12),
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Text(
                      controller.error!,
                      style: const TextStyle(
                        color: CustomerCheckoutColors.error,
                      ),
                    ),
                    TextButton(
                      onPressed: controller.submitting
                          ? null
                          : controller.uncertain
                          ? controller.recover
                          : controller.retry,
                      child: Text(
                        controller.uncertain
                            ? 'Kiểm tra yêu cầu đã gửi'
                            : 'Tải lại báo giá',
                      ),
                    ),
                  ],
                ),
              ),
            _CheckoutSection(
              title: 'Hình thức nhận hàng',
              child: RadioGroup<String>(
                groupValue: controller.receipt,
                onChanged: (value) {
                  if (value != null) controller.setReceipt(value);
                },
                child: Column(
                  children: [
                    RadioListTile<String>(
                      value: 'delivery',
                      enabled: !controller.submitting && !controller.uncertain,
                      activeColor: CustomerCheckoutColors.radio,
                      contentPadding: EdgeInsets.zero,
                      title: const Text(
                        'Giao tận nơi',
                        style: TextStyle(
                          color: CustomerCheckoutColors.bodyText,
                        ),
                      ),
                    ),
                    RadioListTile<String>(
                      value: 'pickup',
                      enabled: !controller.submitting && !controller.uncertain,
                      activeColor: CustomerCheckoutColors.radio,
                      contentPadding: EdgeInsets.zero,
                      title: const Text(
                        'Nhận tại nhà thuốc',
                        style: TextStyle(
                          color: CustomerCheckoutColors.bodyText,
                        ),
                      ),
                      subtitle: const Text(
                        '126 Dương Văn An, Phường Vỹ Dạ, TP Huế',
                        style: TextStyle(
                          color: CustomerCheckoutColors.secondaryText,
                          fontSize: 12,
                        ),
                      ),
                    ),
                  ],
                ),
              ),
            ),
            if (controller.receipt == 'delivery')
              _CheckoutSection(
                title: 'Địa chỉ nhận hàng',
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.stretch,
                  children: [
                    Text(
                      '${widget.user.name}${widget.user.phone.isEmpty ? '' : ' · ${widget.user.phone}'}',
                      style: const TextStyle(
                        color: CustomerCheckoutColors.bodyText,
                        fontWeight: FontWeight.w600,
                      ),
                    ),
                    const SizedBox(height: 12),
                    if (controller.addresses.isEmpty)
                      const Text(
                        'Bạn chưa có địa chỉ nhận hàng.',
                        style: TextStyle(
                          color: CustomerCheckoutColors.secondaryText,
                        ),
                      )
                    else
                      DropdownButtonFormField<String>(
                        key: ValueKey(
                          'checkout-address-${controller.addressId}',
                        ),
                        initialValue: controller.addressId,
                        isExpanded: true,
                        isDense: false,
                        itemHeight: null,
                        decoration: const InputDecoration(
                          labelText: 'Địa chỉ đã lưu',
                        ),
                        style: Theme.of(context).textTheme.bodyMedium
                            ?.copyWith(color: CustomerCheckoutColors.fieldText),
                        onChanged: controller.submitting || controller.uncertain
                            ? null
                            : (id) {
                                if (id != null) controller.setAddress(id);
                              },
                        items: controller.addresses
                            .map(
                              (a) => DropdownMenuItem(
                                value: a.id,
                                child: Padding(
                                  padding: const EdgeInsets.symmetric(
                                    vertical: 8,
                                  ),
                                  child: Text(
                                    a.full,
                                    maxLines: 3,
                                    overflow: TextOverflow.ellipsis,
                                  ),
                                ),
                              ),
                            )
                            .toList(),
                        selectedItemBuilder: (context) => controller.addresses
                            .map(
                              (a) => Align(
                                alignment: Alignment.centerLeft,
                                child: Text(
                                  a.full,
                                  maxLines: 2,
                                  overflow: TextOverflow.ellipsis,
                                  style: const TextStyle(
                                    color: CustomerCheckoutColors.fieldText,
                                    fontSize: 13,
                                  ),
                                ),
                              ),
                            )
                            .toList(),
                      ),
                    Wrap(
                      spacing: 12,
                      children: [
                        TextButton(
                          key: const ValueKey('checkout-add-address'),
                          onPressed:
                              controller.submitting || controller.uncertain
                              ? null
                              : () => editAddress(),
                          style: TextButton.styleFrom(
                            foregroundColor:
                                CustomerCheckoutColors.addressAction,
                          ),
                          child: const Text('Thêm địa chỉ'),
                        ),
                        TextButton(
                          onPressed:
                              controller.addressId == null ||
                                  controller.submitting ||
                                  controller.uncertain
                              ? null
                              : () => editAddress(
                                  controller.addresses.firstWhere(
                                    (a) => a.id == controller.addressId,
                                  ),
                                ),
                          style: TextButton.styleFrom(
                            foregroundColor:
                                CustomerCheckoutColors.addressAction,
                          ),
                          child: const Text('Sửa địa chỉ'),
                        ),
                      ],
                    ),
                  ],
                ),
              ),
            _CheckoutSection(
              title: 'Ghi chú',
              child: TextField(
                key: const ValueKey('checkout-note'),
                maxLength: 2000,
                maxLines: 3,
                enabled: !controller.submitting && !controller.uncertain,
                onChanged: (value) => controller.note = value,
                style: const TextStyle(color: CustomerCheckoutColors.fieldText),
                decoration: const InputDecoration(
                  hintText: 'Ghi chú cho nhà thuốc',
                ),
              ),
            ),
            if (controller.receipt == 'delivery')
              Container(
                padding: const EdgeInsets.all(16),
                margin: const EdgeInsets.only(bottom: 16),
                decoration: BoxDecoration(
                  color: CustomerCheckoutColors.deliveryNoteBackground,
                  borderRadius: BorderRadius.circular(14),
                ),
                child: const Text(
                  'Lưu ý khi giao hàng\nĐược miễn phí giao trong Trung tâm thành phố Huế (dự kiến nhận hàng sau 2–3 giờ). Các phường/xã ngoài trung tâm hoặc tỉnh/thành khác có thể nhận hàng từ 3–4 ngày và phát sinh chi phí giao hàng do người đặt chi trả.',
                  style: TextStyle(
                    color: CustomerCheckoutColors.deliveryNoteText,
                    fontSize: 13,
                    height: 1.5,
                  ),
                ),
              ),
            if (quote != null)
              _CheckoutSection(
                title: 'Sản phẩm đã chọn (${quote.lines.length})',
                child: Column(
                  children: [
                    for (var i = 0; i < quote.lines.length; i++) ...[
                      _CheckoutProduct(line: quote.lines[i]),
                      if (i + 1 < quote.lines.length)
                        const Divider(
                          color: CustomerCheckoutColors.divider,
                          height: 24,
                        ),
                    ],
                  ],
                ),
              ),
            _CheckoutSection(
              title: 'Phương thức thanh toán',
              child: RadioGroup<int>(
                groupValue: controller.paymentMethod,
                onChanged: (value) {
                  if (value != null) controller.setPayment(value);
                },
                child: Column(
                  children: [
                    RadioListTile<int>(
                      value: 0,
                      enabled: !controller.submitting && !controller.uncertain,
                      activeColor: CustomerCheckoutColors.radio,
                      contentPadding: EdgeInsets.zero,
                      title: const Text(
                        'Khi nhận hàng',
                        style: TextStyle(
                          color: CustomerCheckoutColors.bodyText,
                        ),
                      ),
                    ),
                    RadioListTile<int>(
                      value: 1,
                      enabled: !controller.submitting && !controller.uncertain,
                      activeColor: CustomerCheckoutColors.radio,
                      contentPadding: EdgeInsets.zero,
                      title: const Text(
                        'Thanh toán QR',
                        style: TextStyle(
                          color: CustomerCheckoutColors.bodyText,
                        ),
                      ),
                      subtitle: const Text(
                        'Quét mã bằng ứng dụng ngân hàng để thanh toán',
                        style: TextStyle(
                          color: CustomerCheckoutColors.secondaryText,
                          fontSize: 12,
                        ),
                      ),
                    ),
                  ],
                ),
              ),
            ),
            _CheckoutSection(
              title: 'Sử dụng xu',
              child: SwitchListTile(
                contentPadding: EdgeInsets.zero,
                value: controller.usePoints,
                activeTrackColor: CustomerCheckoutColors.radio,
                onChanged:
                    controller.submitting ||
                        controller.uncertain ||
                        controller.quoting ||
                        (quote == null && !controller.usePoints) ||
                        (quote != null &&
                            quote.balance <= BigInt.zero &&
                            !controller.usePoints)
                    ? null
                    : controller.setPoints,
                title: Text(
                  quote == null
                      ? 'Đang tải số dư xu…'
                      : 'Hiện có ${quote.balance} xu',
                  style: const TextStyle(
                    color: CustomerCheckoutColors.bodyText,
                  ),
                ),
                subtitle: Text(
                  controller.usePoints && quote != null
                      ? 'Dùng ${quote.redeemed} xu · giảm ${formatVnd(quote.pointsDiscount)}'
                      : 'Chọn dùng xu để giảm tiền hàng',
                  style: const TextStyle(
                    color: CustomerCheckoutColors.secondaryText,
                    fontSize: 12,
                  ),
                ),
              ),
            ),
            if (quote != null)
              _CheckoutSection(
                title: 'Tổng tiền hàng',
                child: Column(
                  children: [
                    _TotalRow(
                      label: 'Trước khuyến mãi',
                      value: formatVnd(quote.original),
                    ),
                    _TotalRow(
                      label: 'Giảm khuyến mãi',
                      value: '−${formatVnd(quote.productDiscount)}',
                    ),
                    _TotalRow(
                      label: 'Sau khuyến mãi',
                      value: formatVnd(quote.subtotal),
                    ),
                    if (quote.pointsDiscount > BigInt.zero)
                      _TotalRow(
                        label: 'Giảm bằng xu',
                        value: '−${formatVnd(quote.pointsDiscount)}',
                      ),
                    const Divider(color: CustomerCheckoutColors.divider),
                    _TotalRow(
                      label: 'Tiền hàng cần trả',
                      value: formatVnd(quote.total),
                      strong: true,
                    ),
                    if (controller.receipt == 'delivery')
                      const Padding(
                        padding: EdgeInsets.only(top: 8),
                        child: Text(
                          'Chi phí giao ngoài khu vực miễn phí được xác nhận riêng theo địa chỉ, do người đặt chi trả.',
                          style: TextStyle(
                            color: CustomerCheckoutColors.secondaryText,
                            fontSize: 11,
                            height: 1.5,
                          ),
                        ),
                      ),
                  ],
                ),
              ),
          ],
        ),
      );
    },
  );
}

// Một phần biểu mẫu có tiêu đề, khoảng cách nhất quán.
class _CheckoutSection extends StatelessWidget {
  const _CheckoutSection({required this.title, required this.child});
  final String title;
  final Widget child;
  @override
  Widget build(BuildContext context) => Padding(
    padding: const EdgeInsets.only(bottom: 16),
    child: Material(
      color: CustomerCheckoutColors.sectionBackground,
      borderRadius: BorderRadius.circular(16),
      child: Padding(
        padding: const EdgeInsets.all(16),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.stretch,
          children: [
            Text(
              title,
              style: const TextStyle(
                color: CustomerCheckoutColors.sectionTitle,
                fontSize: 16,
                fontWeight: FontWeight.w600,
              ),
            ),
            const SizedBox(height: 12),
            child,
          ],
        ),
      ),
    ),
  );
}

// Sản phẩm đặt hàng hiển thị đơn giá, giá gốc, lượng mua và số lượng thật được ưu đãi.
class _CheckoutProduct extends StatelessWidget {
  const _CheckoutProduct({required this.line});
  final CartLine line;
  @override
  Widget build(BuildContext context) => Column(
    crossAxisAlignment: CrossAxisAlignment.stretch,
    children: [
      Text(
        line.packaging.isEmpty ? line.name : '${line.name} (${line.packaging})',
        style: const TextStyle(
          color: CustomerCheckoutColors.bodyText,
          fontSize: 13,
          fontWeight: FontWeight.w600,
        ),
      ),
      const SizedBox(height: 8),
      Wrap(
        spacing: 8,
        runSpacing: 4,
        crossAxisAlignment: WrapCrossAlignment.center,
        children: [
          Text(
            '${line.price == null ? '—' : formatVnd(line.price!)} × ${line.discounted ? line.promotionalQuantity : line.quantity} ${line.unit}',
            style: const TextStyle(
              color: CustomerCheckoutColors.productPrice,
              fontWeight: FontWeight.w600,
              fontSize: 14,
            ),
          ),
          if (line.discounted)
            Text(
              formatVnd(line.original!),
              style: const TextStyle(
                color: CustomerCheckoutColors.productOriginal,
                decorationColor: CustomerCheckoutColors.productOriginal,
                decoration: TextDecoration.lineThrough,
                fontSize: 11,
              ),
            ),
        ],
      ),
      if (line.discounted && line.promotionalQuantity < line.quantity)
        Padding(
          padding: const EdgeInsets.only(top: 4),
          child: Text(
            'Giá thường: ${formatVnd(line.original!)} × ${line.quantity - line.promotionalQuantity} ${line.unit}',
            style: const TextStyle(
              color: CustomerCheckoutColors.secondaryText,
              fontSize: 12,
            ),
          ),
        ),
      if (line.discounted)
        Padding(
          padding: const EdgeInsets.only(top: 8),
          child: Text(
            '${line.discountPercent == null ? 'Ưu đãi' : 'Giảm ${line.discountPercent}%'} · ${line.promotionName}: ${line.promotionalQuantity} ${line.unit} được ưu đãi.',
            style: const TextStyle(
              color: CustomerCheckoutColors.productPromotion,
              fontSize: 12,
              height: 1.5,
            ),
          ),
        ),
      const SizedBox(height: 6),
      Text(
        'Thành tiền: ${line.total == null ? '—' : formatVnd(line.total!)}',
        style: const TextStyle(
          color: CustomerCheckoutColors.secondaryText,
          fontSize: 12,
        ),
      ),
    ],
  );
}

// Một dòng đối chiếu tiền trước/sau khuyến mãi và xu.
class _TotalRow extends StatelessWidget {
  const _TotalRow({
    required this.label,
    required this.value,
    this.strong = false,
  });
  final String label, value;
  final bool strong;
  @override
  Widget build(BuildContext context) => Padding(
    padding: const EdgeInsets.symmetric(vertical: 6),
    child: Wrap(
      alignment: WrapAlignment.spaceBetween,
      spacing: 12,
      runSpacing: 4,
      children: [
        Text(
          label,
          style: const TextStyle(
            color: CustomerCheckoutColors.secondaryText,
            fontSize: 13,
          ),
        ),
        Text(
          value,
          style: TextStyle(
            color: strong
                ? CustomerCheckoutColors.total
                : CustomerCheckoutColors.bodyText,
            fontWeight: strong ? FontWeight.w600 : FontWeight.w400,
          ),
        ),
      ],
    ),
  );
}

// Số tiền hàng và nút xác nhận cố định, không gửi lại khi chưa biết kết quả yêu cầu cũ.
class _CheckoutBottom extends StatelessWidget {
  const _CheckoutBottom({required this.controller});
  final CustomerCheckoutController controller;
  @override
  Widget build(BuildContext context) => Container(
    padding: const EdgeInsets.all(16),
    decoration: const BoxDecoration(
      color: CustomerCheckoutColors.bottomBackground,
      border: Border(top: BorderSide(color: CustomerCheckoutColors.divider)),
    ),
    child: SafeArea(
      top: false,
      child: Wrap(
        alignment: WrapAlignment.spaceBetween,
        spacing: 12,
        runSpacing: 10,
        crossAxisAlignment: WrapCrossAlignment.center,
        children: [
          Text(
            controller.quote == null
                ? 'Chưa có báo giá'
                : formatVnd(controller.quote!.total),
            style: const TextStyle(
              color: CustomerCheckoutColors.total,
              fontWeight: FontWeight.w600,
              fontSize: 18,
            ),
          ),
          FilledButton(
            key: const ValueKey('checkout-submit'),
            onPressed: controller.canSubmit ? controller.submit : null,
            style: FilledButton.styleFrom(
              backgroundColor: CustomerCheckoutColors.submitBackground,
              foregroundColor: CustomerCheckoutColors.submitText,
              minimumSize: const Size(140, 48),
              shape: const StadiumBorder(),
            ),
            child: Text(controller.submitting ? 'Đang đặt hàng…' : 'Đặt hàng'),
          ),
        ],
      ),
    ),
  );
}

// Dialog thêm/sửa địa chỉ dùng cùng các trường và kiểm tra bắt buộc của Website.
class _AddressDialog extends StatefulWidget {
  const _AddressDialog({required this.controller, this.address});
  final CustomerCheckoutController controller;
  final DeliveryAddress? address;
  @override
  State<_AddressDialog> createState() => _AddressDialogState();
}

class _AddressDialogState extends State<_AddressDialog> {
  final form = GlobalKey<FormState>();
  late final city = TextEditingController(text: widget.address?.city ?? '');
  late final ward = TextEditingController(text: widget.address?.ward ?? '');
  late final street = TextEditingController(text: widget.address?.street ?? '');
  bool saving = false;
  String? error;
  @override
  void dispose() {
    city.dispose();
    ward.dispose();
    street.dispose();
    super.dispose();
  }

  Future<void> save() async {
    if (saving || !form.currentState!.validate()) return;
    setState(() {
      saving = true;
      error = null;
    });
    final ok = await widget.controller.saveAddress({
      'TinhThanh': city.text.trim(),
      'PhuongXa': ward.text.trim(),
      'DiaChiCuThe': street.text.trim(),
    }, id: widget.address?.id);
    if (!mounted) return;
    if (ok) {
      Navigator.pop(context);
    } else {
      setState(() {
        saving = false;
        error = widget.controller.error;
      });
    }
  }

  @override
  Widget build(BuildContext context) => AlertDialog(
    backgroundColor: CustomerCheckoutColors.addressDialogBackground,
    title: Text(
      widget.address == null ? 'Thêm địa chỉ' : 'Sửa địa chỉ',
      style: const TextStyle(color: CustomerCheckoutColors.addressDialogTitle),
    ),
    content: SizedBox(
      width: 420,
      child: SingleChildScrollView(
        child: Form(
          key: form,
          child: Column(
            mainAxisSize: MainAxisSize.min,
            children: [
              for (final item in [
                (city, 'Tỉnh / Thành phố'),
                (ward, 'Phường / Xã'),
                (street, 'Số nhà, tên đường'),
              ])
                Padding(
                  padding: const EdgeInsets.only(bottom: 12),
                  child: TextFormField(
                    controller: item.$1,
                    maxLength: 255,
                    enabled: !saving,
                    style: const TextStyle(
                      color: CustomerCheckoutColors.fieldText,
                    ),
                    decoration: InputDecoration(labelText: item.$2),
                    validator: (value) =>
                        value == null ||
                            value.trim().isEmpty ||
                            value.runes.any((v) => v < 32)
                        ? 'Vui lòng nhập ${item.$2.toLowerCase()}.'
                        : null,
                  ),
                ),
              if (error != null)
                Text(
                  error!,
                  style: const TextStyle(color: CustomerCheckoutColors.error),
                ),
            ],
          ),
        ),
      ),
    ),
    actions: [
      TextButton(
        onPressed: saving ? null : () => Navigator.pop(context),
        child: const Text('Hủy'),
      ),
      FilledButton(
        onPressed: saving ? null : save,
        child: Text(saving ? 'Đang lưu…' : 'Lưu địa chỉ'),
      ),
    ],
  );
}
