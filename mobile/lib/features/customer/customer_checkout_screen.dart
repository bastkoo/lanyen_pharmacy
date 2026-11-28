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
  // Nền khung ảnh sản phẩm tại bước xác nhận.
  static const productImageBackground = AppColors.background;
  // Biểu tượng dự phòng khi sản phẩm chưa có ảnh.
  static const productImagePlaceholder = AppColors.textSecondary;
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
  // Chữ nhập ghi chú.
  static const fieldText = AppColors.textPrimary;
  // Nền thanh chọn hình thức nhận hàng.
  static const receiptTrack = AppColors.background;
  // Nền lựa chọn đang được chọn và nhãn phương thức thanh toán.
  static const selectedBackground = AppColors.primaryLight;
  // Chữ và biểu tượng lựa chọn đang chọn.
  static const selectedForeground = AppColors.primaryDark;
  // Viền của lựa chọn đang chọn.
  static const selectedBorder = AppColors.primaryDark;
  // Biểu tượng địa chỉ, người nhận và phương thức thanh toán.
  static const detailIcon = AppColors.textSecondary;
  // Nền bảng chọn địa chỉ và trang quản lý địa chỉ.
  static const addressSheetBackground = AppColors.surface;
  // Thanh kéo của bảng chọn địa chỉ.
  static const sheetHandle = AppColors.textSecondary;
  // Nền vàng của biểu tượng xu, đồng nhất giỏ hàng.
  static const coinBackground = Color(0xFFFFC107);
  // Hai viền và ký hiệu trên đồng xu.
  static const coinEdge = Color(0xFF9B6800);
  // Giá trị xu dự kiến được nhận.
  static const rewardText = AppColors.warning;
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

  Future<void> manageAddresses() => Navigator.of(context).push<void>(
    MaterialPageRoute(builder: (_) => const _AddressManagementScreen()),
  );

  Future<void> chooseAddress() async {
    final result = await showModalBottomSheet<String>(
      context: context,
      isScrollControlled: true,
      useSafeArea: true,
      showDragHandle: false,
      backgroundColor: CustomerCheckoutColors.addressSheetBackground,
      shape: const RoundedRectangleBorder(
        borderRadius: BorderRadius.vertical(top: Radius.circular(24)),
      ),
      builder: (_) => _AddressSheet(
        addresses: controller.addresses,
        selectedId: controller.addressId,
      ),
    );
    if (!mounted || controller.submitting || controller.uncertain) return;
    if (result == 'manage') {
      await manageAddresses();
    } else if (result != null) {
      controller.setAddress(result);
    }
  }

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
          title: const Text('Xác nhận đơn hàng'),
        ),
        bottomNavigationBar: _CheckoutBottom(controller: controller),
        body: ListView(
          key: const ValueKey('checkout-scroll'),
          padding: const EdgeInsets.only(top: 12, bottom: 16),
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
              child: _ReceiptSelector(controller: controller),
            ),
            if (controller.receipt == 'delivery')
              _CheckoutSection(
                title: 'Địa chỉ nhận hàng',
                action: TextButton(
                  key: const ValueKey('checkout-choose-address'),
                  onPressed: controller.submitting || controller.uncertain
                      ? null
                      : chooseAddress,
                  child: const Text('Thay đổi'),
                ),
                child: _DeliveryDetails(
                  user: widget.user,
                  address: controller.addresses
                      .where((a) => a.id == controller.addressId)
                      .firstOrNull,
                  onAdd: controller.submitting || controller.uncertain
                      ? null
                      : manageAddresses,
                ),
              )
            else
              const _CheckoutSection(
                title: 'Nhận tại nhà thuốc',
                child: ListTile(
                  contentPadding: EdgeInsets.zero,
                  leading: Icon(
                    Icons.storefront_outlined,
                    color: CustomerCheckoutColors.selectedForeground,
                  ),
                  title: Text(
                    'Nhà thuốc Lan Yến',
                    style: TextStyle(
                      color: CustomerCheckoutColors.bodyText,
                      fontWeight: FontWeight.w600,
                    ),
                  ),
                  subtitle: Text(
                    '126 Dương Văn An, Phường Vỹ Dạ, TP Huế',
                    style: TextStyle(
                      color: CustomerCheckoutColors.secondaryText,
                    ),
                  ),
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
                margin: const EdgeInsets.fromLTRB(20, 0, 20, 16),
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
              child: _PaymentChoices(controller: controller),
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
                secondary: const _CheckoutCoin(),
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
                title: 'Thông tin thanh toán',
                child: Column(
                  children: [
                    _TotalRow(
                      label: 'Tổng tiền',
                      value: formatVnd(quote.original),
                    ),
                    _TotalRow(
                      label: 'Giảm giá trực tiếp',
                      value:
                          '${quote.productDiscount > BigInt.zero ? '−' : ''}${formatVnd(quote.productDiscount)}',
                    ),
                    _TotalRow(
                      label: 'Giảm giá điểm thưởng',
                      value:
                          '${quote.pointsDiscount > BigInt.zero ? '−' : ''}${formatVnd(quote.pointsDiscount)}',
                    ),
                    const Divider(
                      color: CustomerCheckoutColors.divider,
                      height: 24,
                    ),
                    _TotalRow(
                      label: 'Thành tiền',
                      value: formatVnd(quote.total),
                      strong: true,
                    ),
                    if (quote.productDiscount + quote.pointsDiscount >
                        BigInt.zero)
                      _TotalRow(
                        label: 'Tiết kiệm được',
                        value: formatVnd(
                          quote.productDiscount + quote.pointsDiscount,
                        ),
                      ),
                    _TotalRow(
                      label: 'Điểm thưởng',
                      value: '+${quote.earned}',
                      reward: true,
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

// Hai cách nhận hàng cùng một thanh; nhãn xuống dòng khi phóng lớn chữ.
class _ReceiptSelector extends StatelessWidget {
  const _ReceiptSelector({required this.controller});
  final CustomerCheckoutController controller;
  @override
  Widget build(BuildContext context) => Container(
    padding: const EdgeInsets.all(4),
    decoration: BoxDecoration(
      color: CustomerCheckoutColors.receiptTrack,
      borderRadius: BorderRadius.circular(12),
    ),
    child: Row(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        for (final option in [
          ('delivery', 'Giao hàng tận nơi', Icons.local_shipping_outlined),
          ('pickup', 'Nhận tại nhà thuốc', Icons.storefront_outlined),
        ])
          Expanded(
            child: Semantics(
              selected: controller.receipt == option.$1,
              child: Padding(
                padding: const EdgeInsets.all(2),
                child: Material(
                  color: controller.receipt == option.$1
                      ? CustomerCheckoutColors.selectedBackground
                      : CustomerCheckoutColors.receiptTrack,
                  shape: RoundedRectangleBorder(
                    borderRadius: BorderRadius.circular(10),
                    side: BorderSide(
                      color: controller.receipt == option.$1
                          ? CustomerCheckoutColors.selectedBorder
                          : CustomerCheckoutColors.receiptTrack,
                    ),
                  ),
                  child: InkWell(
                    key: ValueKey('checkout-receipt-${option.$1}'),
                    borderRadius: BorderRadius.circular(10),
                    onTap: controller.submitting || controller.uncertain
                        ? null
                        : () => controller.setReceipt(option.$1),
                    child: Padding(
                      padding: const EdgeInsets.symmetric(
                        horizontal: 8,
                        vertical: 12,
                      ),
                      child: Column(
                        children: [
                          Icon(
                            option.$3,
                            size: 22,
                            color: controller.receipt == option.$1
                                ? CustomerCheckoutColors.selectedForeground
                                : CustomerCheckoutColors.detailIcon,
                          ),
                          const SizedBox(height: 8),
                          Text(
                            option.$2,
                            textAlign: TextAlign.center,
                            style: TextStyle(
                              color: controller.receipt == option.$1
                                  ? CustomerCheckoutColors.selectedForeground
                                  : CustomerCheckoutColors.secondaryText,
                              fontSize: 13,
                              fontWeight: FontWeight.w600,
                            ),
                          ),
                        ],
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

class _DeliveryDetails extends StatelessWidget {
  const _DeliveryDetails({
    required this.user,
    required this.address,
    required this.onAdd,
  });
  final SessionUser user;
  final DeliveryAddress? address;
  final VoidCallback? onAdd;
  @override
  Widget build(BuildContext context) => Column(
    crossAxisAlignment: CrossAxisAlignment.stretch,
    children: [
      Row(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          const Icon(
            Icons.location_on_outlined,
            color: CustomerCheckoutColors.selectedForeground,
          ),
          const SizedBox(width: 10),
          Expanded(
            child: Text(
              address?.full ?? 'Bạn chưa có địa chỉ nhận hàng.',
              style: const TextStyle(
                color: CustomerCheckoutColors.bodyText,
                fontWeight: FontWeight.w600,
                fontSize: 16,
                height: 1.5,
              ),
            ),
          ),
        ],
      ),
      const SizedBox(height: 12),
      Row(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          const Icon(
            Icons.person_outline,
            color: CustomerCheckoutColors.detailIcon,
            size: 20,
          ),
          const SizedBox(width: 10),
          Expanded(
            child: Text(
              '${user.name}${user.phone.isEmpty ? '' : ' · ${user.phone}'}',
              style: const TextStyle(
                color: CustomerCheckoutColors.secondaryText,
                fontSize: 13,
              ),
            ),
          ),
        ],
      ),
      Align(
        alignment: Alignment.centerLeft,
        child: TextButton.icon(
          key: const ValueKey('checkout-add-address'),
          onPressed: onAdd,
          icon: const Icon(Icons.add_location_alt_outlined, size: 20),
          label: const Text('Thêm địa chỉ'),
        ),
      ),
    ],
  );
}

// Bảng chọn ngắn từ dưới, đóng bảng trước khi mở trang quản lý địa chỉ.
class _AddressSheet extends StatelessWidget {
  const _AddressSheet({required this.addresses, required this.selectedId});
  final List<DeliveryAddress> addresses;
  final String? selectedId;
  @override
  Widget build(BuildContext context) => ConstrainedBox(
    constraints: BoxConstraints(
      maxHeight:
          MediaQuery.sizeOf(context).height *
          (MediaQuery.textScalerOf(context).scale(14) > 21 ? .95 : .8),
    ),
    child: SafeArea(
      top: false,
      child: Column(
        key: const ValueKey('checkout-address-sheet'),
        mainAxisSize: MainAxisSize.min,
        children: [
          const SizedBox(height: 10),
          Container(
            width: 36,
            height: 4,
            decoration: BoxDecoration(
              color: CustomerCheckoutColors.sheetHandle,
              borderRadius: BorderRadius.circular(4),
            ),
          ),
          Padding(
            padding: const EdgeInsets.fromLTRB(20, 12, 8, 12),
            child: Row(
              children: [
                Expanded(
                  child: Semantics(
                    header: true,
                    child: const Text(
                      'Chọn địa chỉ giao hàng',
                      style: TextStyle(
                        color: CustomerCheckoutColors.sectionTitle,
                        fontSize: 18,
                        fontWeight: FontWeight.w600,
                      ),
                    ),
                  ),
                ),
                IconButton(
                  tooltip: 'Đóng',
                  color: CustomerCheckoutColors.detailIcon,
                  onPressed: () => Navigator.pop(context),
                  icon: const Icon(Icons.close),
                ),
              ],
            ),
          ),
          const Divider(height: 1, color: CustomerCheckoutColors.divider),
          Flexible(
            child: addresses.isEmpty
                ? const Center(
                    heightFactor: 1,
                    child: Padding(
                      padding: EdgeInsets.all(24),
                      child: Text(
                        'Bạn chưa có địa chỉ đã lưu.',
                        textAlign: TextAlign.center,
                        style: TextStyle(
                          color: CustomerCheckoutColors.secondaryText,
                        ),
                      ),
                    ),
                  )
                : RadioGroup<String>(
                    groupValue: selectedId,
                    onChanged: (id) {
                      if (id != null) Navigator.pop(context, id);
                    },
                    child: ListView.separated(
                      shrinkWrap: true,
                      padding: const EdgeInsets.symmetric(vertical: 8),
                      itemCount: addresses.length,
                      separatorBuilder: (_, index) => const Divider(
                        color: CustomerCheckoutColors.divider,
                        indent: 20,
                        endIndent: 20,
                      ),
                      itemBuilder: (_, index) {
                        final address = addresses[index];
                        return RadioListTile<String>(
                          key: ValueKey(
                            'checkout-address-option-${address.id}',
                          ),
                          value: address.id,
                          selected: address.id == selectedId,
                          activeColor: CustomerCheckoutColors.radio,
                          selectedTileColor:
                              CustomerCheckoutColors.selectedBackground,
                          contentPadding: const EdgeInsets.symmetric(
                            horizontal: 16,
                            vertical: 8,
                          ),
                          title: Text(
                            address.full,
                            style: const TextStyle(
                              color: CustomerCheckoutColors.bodyText,
                              fontSize: 14,
                              height: 1.5,
                            ),
                          ),
                          subtitle: address.primary
                              ? const Text(
                                  'Địa chỉ mặc định',
                                  style: TextStyle(
                                    color: CustomerCheckoutColors
                                        .selectedForeground,
                                    fontSize: 12,
                                  ),
                                )
                              : null,
                        );
                      },
                    ),
                  ),
          ),
          Padding(
            padding: const EdgeInsets.all(20),
            child: SizedBox(
              width: double.infinity,
              child: OutlinedButton.icon(
                key: const ValueKey('checkout-sheet-add-address'),
                onPressed: () => Navigator.pop(context, 'manage'),
                icon: const Icon(Icons.add_location_alt_outlined),
                label: const Text('Thêm địa chỉ'),
              ),
            ),
          ),
        ],
      ),
    ),
  );
}

// Trang đích được yêu cầu; chưa cung cấp chức năng tạo/sửa địa chỉ.
class _AddressManagementScreen extends StatelessWidget {
  const _AddressManagementScreen();
  @override
  Widget build(BuildContext context) => Scaffold(
    key: const ValueKey('customer-address-management'),
    backgroundColor: CustomerCheckoutColors.addressSheetBackground,
    appBar: AppBar(
      title: const Text('Quản lý địa chỉ'),
      backgroundColor: CustomerCheckoutColors.headerBackground,
      foregroundColor: CustomerCheckoutColors.headerForeground,
    ),
    body: const Center(
      child: SingleChildScrollView(
        padding: EdgeInsets.all(32),
        child: Column(
          mainAxisSize: MainAxisSize.min,
          children: [
            Icon(
              Icons.location_on_outlined,
              size: 48,
              color: CustomerCheckoutColors.selectedForeground,
            ),
            SizedBox(height: 16),
            Text(
              'Quản lý địa chỉ',
              textAlign: TextAlign.center,
              style: TextStyle(
                color: CustomerCheckoutColors.sectionTitle,
                fontSize: 20,
                fontWeight: FontWeight.w600,
              ),
            ),
            SizedBox(height: 8),
            Text(
              'Tính năng quản lý địa chỉ đang được hoàn thiện.',
              textAlign: TextAlign.center,
              style: TextStyle(
                color: CustomerCheckoutColors.secondaryText,
                height: 1.6,
              ),
            ),
          ],
        ),
      ),
    ),
  );
}

class _PaymentChoices extends StatelessWidget {
  const _PaymentChoices({required this.controller});
  final CustomerCheckoutController controller;
  @override
  Widget build(BuildContext context) => RadioGroup<int>(
    groupValue: controller.paymentMethod,
    onChanged: (value) {
      if (value != null) controller.setPayment(value);
    },
    child: Column(
      children: [
        for (final option in [
          (
            0,
            'Khi nhận hàng',
            'Thanh toán trực tiếp khi nhận hàng',
            Icons.payments_outlined,
          ),
          (
            1,
            'Thanh toán QR',
            'Quét mã bằng ứng dụng ngân hàng',
            Icons.qr_code_scanner_outlined,
          ),
        ])
          Padding(
            padding: const EdgeInsets.only(bottom: 8),
            child: Material(
              color: controller.paymentMethod == option.$1
                  ? CustomerCheckoutColors.selectedBackground
                  : CustomerCheckoutColors.sectionBackground,
              shape: RoundedRectangleBorder(
                borderRadius: BorderRadius.circular(12),
                side: BorderSide(
                  color: controller.paymentMethod == option.$1
                      ? CustomerCheckoutColors.selectedBorder
                      : CustomerCheckoutColors.divider,
                ),
              ),
              child: RadioListTile<int>(
                value: option.$1,
                enabled: !controller.submitting && !controller.uncertain,
                activeColor: CustomerCheckoutColors.radio,
                contentPadding: const EdgeInsets.symmetric(
                  horizontal: 8,
                  vertical: 8,
                ),
                secondary: Icon(
                  option.$4,
                  color: CustomerCheckoutColors.selectedForeground,
                  size: 26,
                ),
                title: Text(
                  option.$2,
                  style: const TextStyle(
                    color: CustomerCheckoutColors.bodyText,
                    fontSize: 14,
                    fontWeight: FontWeight.w600,
                  ),
                ),
                subtitle: Text(
                  option.$3,
                  style: const TextStyle(
                    color: CustomerCheckoutColors.secondaryText,
                    fontSize: 12,
                    height: 1.5,
                  ),
                ),
              ),
            ),
          ),
      ],
    ),
  );
}

// Đồng xu cùng kiểu giỏ hàng, không dùng cỡ chữ hệ thống cho ký hiệu trang trí.
class _CheckoutCoin extends StatelessWidget {
  const _CheckoutCoin();
  @override
  Widget build(BuildContext context) => Semantics(
    label: 'Xu',
    image: true,
    child: ExcludeSemantics(
      child: Container(
        width: 24,
        height: 24,
        padding: const EdgeInsets.all(2),
        decoration: BoxDecoration(
          shape: BoxShape.circle,
          color: CustomerCheckoutColors.coinBackground,
          border: Border.all(
            color: CustomerCheckoutColors.coinEdge,
            width: 1.4,
          ),
        ),
        child: Container(
          alignment: Alignment.center,
          decoration: BoxDecoration(
            shape: BoxShape.circle,
            border: Border.all(
              color: CustomerCheckoutColors.coinEdge,
              width: .8,
            ),
          ),
          child: const Text(
            '₫',
            textScaler: TextScaler.noScaling,
            style: TextStyle(
              color: CustomerCheckoutColors.coinEdge,
              fontSize: 13,
              height: 1,
              fontWeight: FontWeight.w700,
            ),
          ),
        ),
      ),
    ),
  );
}

// Một phần biểu mẫu có tiêu đề, khoảng cách nhất quán.
class _CheckoutSection extends StatelessWidget {
  const _CheckoutSection({
    required this.title,
    required this.child,
    this.action,
  });
  final String title;
  final Widget child;
  final Widget? action;
  @override
  Widget build(BuildContext context) => Padding(
    padding: const EdgeInsets.only(bottom: 8),
    child: Material(
      color: CustomerCheckoutColors.sectionBackground,
      child: Padding(
        padding: const EdgeInsets.symmetric(horizontal: 20, vertical: 20),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.stretch,
          children: [
            Row(
              children: [
                Expanded(
                  child: Semantics(
                    header: true,
                    child: Text(
                      title,
                      style: const TextStyle(
                        color: CustomerCheckoutColors.sectionTitle,
                        fontSize: 16,
                        fontWeight: FontWeight.w600,
                      ),
                    ),
                  ),
                ),
                ?action,
              ],
            ),
            const SizedBox(height: 12),
            child,
          ],
        ),
      ),
    ),
  );
}

// Sản phẩm: ảnh, tên, quy cách và giá theo lượng ưu đãi; không lặp thành tiền từng dòng.
class _CheckoutProduct extends StatelessWidget {
  const _CheckoutProduct({required this.line});
  final CartLine line;
  @override
  Widget build(BuildContext context) {
    final details = Column(
      crossAxisAlignment: CrossAxisAlignment.stretch,
      children: [
        Text(
          line.name,
          style: const TextStyle(
            color: CustomerCheckoutColors.bodyText,
            fontSize: 14,
            fontWeight: FontWeight.w600,
            height: 1.5,
          ),
        ),
        if (line.packaging.isNotEmpty) ...[
          const SizedBox(height: 4),
          Text(
            line.packaging,
            style: const TextStyle(
              color: CustomerCheckoutColors.secondaryText,
              fontSize: 12,
              height: 1.5,
            ),
          ),
        ],
        const SizedBox(height: 8),
        Wrap(
          spacing: 8,
          runSpacing: 4,
          crossAxisAlignment: WrapCrossAlignment.center,
          children: [
            Text(
              '${line.price == null ? '—' : formatVnd(line.price!)} / ${line.unit}',
              style: const TextStyle(
                color: CustomerCheckoutColors.productPrice,
                fontSize: 14,
                fontWeight: FontWeight.w600,
              ),
            ),
            if (line.discounted)
              Text(
                formatVnd(line.original!),
                style: const TextStyle(
                  color: CustomerCheckoutColors.productOriginal,
                  fontSize: 11,
                  decoration: TextDecoration.lineThrough,
                  decorationColor: CustomerCheckoutColors.productOriginal,
                ),
              ),
          ],
        ),
        const SizedBox(height: 6),
        Text(
          'Số lượng: ${line.quantity} ${line.unit}',
          style: const TextStyle(
            color: CustomerCheckoutColors.bodyText,
            fontSize: 12,
          ),
        ),
      ],
    );
    return Column(
      crossAxisAlignment: CrossAxisAlignment.stretch,
      children: [
        LayoutBuilder(
          builder: (context, constraints) {
            final image = _CheckoutProductImage(line: line);
            if (constraints.maxWidth < 340 &&
                MediaQuery.textScalerOf(context).scale(14) > 21) {
              return Column(
                crossAxisAlignment: CrossAxisAlignment.stretch,
                children: [
                  Align(alignment: Alignment.centerLeft, child: image),
                  const SizedBox(height: 12),
                  details,
                ],
              );
            }
            return Row(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                image,
                const SizedBox(width: 12),
                Expanded(child: details),
              ],
            );
          },
        ),
        if (line.discounted && line.promotionalQuantity < line.quantity)
          Padding(
            padding: const EdgeInsets.only(top: 10),
            child: Text(
              'Giá thường: ${formatVnd(line.original!)} × ${line.quantity - line.promotionalQuantity} ${line.unit}',
              style: const TextStyle(
                color: CustomerCheckoutColors.secondaryText,
                fontSize: 12,
              ),
            ),
          ),
        if (line.discounted)
          Container(
            margin: const EdgeInsets.only(top: 12),
            padding: const EdgeInsets.all(10),
            decoration: BoxDecoration(
              color: CustomerCheckoutColors.selectedBackground,
              borderRadius: BorderRadius.circular(8),
            ),
            child: Row(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                const Icon(
                  Icons.local_offer_outlined,
                  size: 16,
                  color: CustomerCheckoutColors.productPromotion,
                ),
                const SizedBox(width: 8),
                Expanded(
                  child: Text(
                    '${line.discountPercent == null ? 'Ưu đãi' : 'Giảm ${line.discountPercent}%'} · ${line.promotionName}: ${line.promotionalQuantity} ${line.unit} được ưu đãi.',
                    style: const TextStyle(
                      color: CustomerCheckoutColors.productPromotion,
                      fontSize: 12,
                      height: 1.5,
                    ),
                  ),
                ),
              ],
            ),
          ),
      ],
    );
  }
}

// Ảnh từ dữ liệu giỏ; dự phòng khi thiếu ảnh hoặc tải ảnh thất bại.
class _CheckoutProductImage extends StatelessWidget {
  const _CheckoutProductImage({required this.line});
  final CartLine line;
  @override
  Widget build(BuildContext context) {
    const placeholder = Icon(
      Icons.medication_outlined,
      color: CustomerCheckoutColors.productImagePlaceholder,
      size: 32,
    );
    final uri = Uri.tryParse(line.image);
    return Semantics(
      image: true,
      label: 'Ảnh ${line.name}',
      child: ExcludeSemantics(
        child: Container(
          key: ValueKey('checkout-product-image-${line.unitId}'),
          width: 72,
          height: 84,
          padding: const EdgeInsets.all(8),
          decoration: BoxDecoration(
            color: CustomerCheckoutColors.productImageBackground,
            borderRadius: BorderRadius.circular(12),
            border: Border.all(color: CustomerCheckoutColors.divider),
          ),
          child: uri?.scheme == 'https' && uri!.host.isNotEmpty
              ? Image.network(
                  line.image,
                  fit: BoxFit.contain,
                  errorBuilder: (_, _, _) => placeholder,
                )
              : placeholder,
        ),
      ),
    );
  }
}

// Hai cột: nhãn trái, giá trị phải; nhãn tự xuống dòng với cỡ chữ lớn.
class _TotalRow extends StatelessWidget {
  const _TotalRow({
    required this.label,
    required this.value,
    this.strong = false,
    this.reward = false,
  });
  final String label, value;
  final bool strong, reward;
  @override
  Widget build(BuildContext context) => Padding(
    key: ValueKey('checkout-total-$label'),
    padding: const EdgeInsets.symmetric(vertical: 8),
    child: Row(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Expanded(
          flex: 3,
          child: Text(
            label,
            style: TextStyle(
              color: strong
                  ? CustomerCheckoutColors.bodyText
                  : CustomerCheckoutColors.secondaryText,
              fontSize: strong ? 15 : 13,
              fontWeight: strong ? FontWeight.w600 : FontWeight.w400,
            ),
          ),
        ),
        const SizedBox(width: 12),
        Expanded(
          flex: 2,
          child: Wrap(
            alignment: WrapAlignment.end,
            crossAxisAlignment: WrapCrossAlignment.center,
            spacing: 6,
            runSpacing: 4,
            children: [
              if (reward) const _CheckoutCoin(),
              Text(
                value,
                textAlign: TextAlign.right,
                style: TextStyle(
                  color: reward
                      ? CustomerCheckoutColors.rewardText
                      : strong
                      ? CustomerCheckoutColors.total
                      : CustomerCheckoutColors.bodyText,
                  fontSize: strong ? 18 : 14,
                  fontWeight: strong || reward
                      ? FontWeight.w600
                      : FontWeight.w500,
                ),
              ),
            ],
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
      child: Column(
        mainAxisSize: MainAxisSize.min,
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: [
          Wrap(
            alignment: WrapAlignment.spaceBetween,
            spacing: 12,
            runSpacing: 4,
            children: [
              const Text(
                'Thành tiền',
                style: TextStyle(color: CustomerCheckoutColors.bodyText),
              ),
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
            ],
          ),
          const SizedBox(height: 12),
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
