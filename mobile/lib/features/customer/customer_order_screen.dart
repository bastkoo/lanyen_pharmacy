import 'dart:async';

import 'package:flutter/foundation.dart';
import 'package:flutter/material.dart';
import 'package:url_launcher/url_launcher.dart';
import 'package:url_launcher/link.dart';

import '../../core/network/api.dart';
import '../../core/network/api_exception.dart';
import '../../core/theme/app_colors.dart';
import '../../models/catalog.dart';
import '../../models/checkout.dart';
import 'customer_checkout_controller.dart';

class CustomerOrderColors {
  CustomerOrderColors._();
  // Nền toàn trang kết quả đặt hàng và danh sách đơn đã đặt.
  static const background = AppColors.background;
  // Nền Appbar cố định trên trang đơn hàng.
  static const headerBackground = AppColors.appBarBackground;
  // Chữ và mũi tên quay lại trên Appbar.
  static const headerForeground = AppColors.appBarForeground;
  // Biểu tượng đơn đã được lưu.
  static const savedIcon = AppColors.primaryDark;
  // Mã đơn và nhãn trạng thái.
  static const title = AppColors.textPrimary;
  // Chú thích trạng thái thanh toán, không phải xác nhận từ trình duyệt.
  static const description = AppColors.textSecondary;
  // Tổng số tiền cần thanh toán của đơn.
  static const total = AppColors.primaryDark;
  // Chữ báo lỗi đọc trạng thái hoặc mở SePay.
  static const error = AppColors.error;
  // Nền nút mở thanh toán QR.
  static const paymentButton = AppColors.primaryDark;
  // Chữ trên nút mở thanh toán QR.
  static const paymentButtonText = AppColors.surface;
  // Chữ nút kiểm tra lại đơn.
  static const refreshButton = AppColors.primaryDark;
  // Đường ngăn cách các đơn đã đặt.
  static const divider = AppColors.border;
}

// Kết quả đặt hàng và thanh toán: chỉ trạng thái từ Backend mới xác nhận đã trả tiền.
class CustomerOrderScreen extends StatefulWidget {
  const CustomerOrderScreen({
    super.key,
    required this.api,
    required this.initial,
    this.openPayment,
  });
  final CheckoutApi api;
  final PlacedOrder initial;
  final Future<bool> Function(Uri)? openPayment;
  @override
  State<CustomerOrderScreen> createState() => _CustomerOrderScreenState();
}

// Theo dõi đơn còn chờ thanh toán, làm mới khi quay về ứng dụng và hủy timer khi rời trang.
class _CustomerOrderScreenState extends State<CustomerOrderScreen>
    with WidgetsBindingObserver {
  late PlacedOrder order;
  Timer? timer;
  Uri? payment;
  DateTime? preparedAt;
  bool reading = false, preparing = false, opening = false, foreground = true;
  String? error, linkError;
  @override
  void initState() {
    super.initState();
    order = widget.initial;
    WidgetsBinding.instance.addObserver(this);
    prepare();
    timer = Timer.periodic(const Duration(seconds: 5), (_) {
      if (foreground && order.pendingPayment) refresh();
    });
  }

  Future<void> prepare() async {
    if (!order.pendingPayment || preparing || !mounted) return;
    setState(() {
      preparing = true;
      payment = null;
      preparedAt = null;
    });
    try {
      final uri = await widget.api.payment(order.id);
      if (mounted && order.pendingPayment) {
        setState(() {
          payment = uri;
          preparedAt = DateTime.now();
          linkError = null;
        });
      }
    } on ApiException catch (failure) {
      if (mounted) setState(() => linkError = checkoutError(failure));
    } finally {
      if (mounted) setState(() => preparing = false);
    }
  }

  Future<void> refresh() async {
    if (reading || !mounted) return;
    reading = true;
    try {
      final value = await widget.api.order(order.id);
      if (!mounted) return;
      setState(() {
        order = value;
        error = null;
        if (!order.pendingPayment) payment = null;
      });
      if (order.pendingPayment &&
          preparedAt != null &&
          DateTime.now().difference(preparedAt!) > const Duration(minutes: 4)) {
        await prepare();
      }
    } on ApiException catch (failure) {
      if (mounted) setState(() => error = checkoutError(failure));
    } finally {
      reading = false;
    }
  }

  Future<void> open() async {
    final uri = payment;
    if (uri == null || opening) return;
    // URI đã chuẩn bị sẵn: gọi launcher ngay trong thao tác người dùng để Web cho mở tab.
    final launch =
        widget.openPayment?.call(uri) ??
        launchUrl(
          uri,
          mode: LaunchMode.externalApplication,
          webOnlyWindowName: '_blank',
        );
    setState(() {
      opening = true;
      error = null;
    });
    try {
      if (!await launch && mounted) {
        setState(
          () => error =
              'Chưa mở được trang thanh toán. Hãy thử lại từ đơn hàng này.',
        );
      }
    } on Exception {
      if (mounted) {
        setState(
          () =>
              error = 'Chưa mở được trình duyệt thanh toán. Vui lòng thử lại.',
        );
      }
    } finally {
      if (mounted) setState(() => opening = false);
    }
  }

  @override
  void didChangeAppLifecycleState(AppLifecycleState state) {
    foreground = state == AppLifecycleState.resumed;
    if (state == AppLifecycleState.resumed) refresh();
  }

  @override
  void dispose() {
    timer?.cancel();
    WidgetsBinding.instance.removeObserver(this);
    super.dispose();
  }

  // Web dùng liên kết thật để trình duyệt mở trực tiếp, thay vì window.open có thể bị chặn.
  Widget paymentButton() {
    Widget button(VoidCallback? follow) => FilledButton.icon(
      key: const ValueKey('order-open-payment'),
      onPressed: payment == null || preparing || opening ? null : follow,
      style: FilledButton.styleFrom(
        backgroundColor: CustomerOrderColors.paymentButton,
        foregroundColor: CustomerOrderColors.paymentButtonText,
      ),
      icon: const Icon(Icons.qr_code_rounded),
      label: Text(preparing ? 'Đang chuẩn bị thanh toán…' : 'Thanh toán QR'),
    );
    if (kIsWeb && widget.openPayment == null) {
      return Link(
        uri: payment,
        target: LinkTarget.blank,
        builder: (context, followLink) => button(followLink),
      );
    }
    return button(open);
  }

  @override
  Widget build(BuildContext context) => Scaffold(
    key: const ValueKey('customer-order'),
    backgroundColor: CustomerOrderColors.background,
    appBar: AppBar(
      backgroundColor: CustomerOrderColors.headerBackground,
      foregroundColor: CustomerOrderColors.headerForeground,
      title: Text('Đơn hàng #${order.id}'),
    ),
    body: ListView(
      padding: const EdgeInsets.all(24),
      children: [
        const Icon(
          Icons.receipt_long_rounded,
          size: 64,
          color: CustomerOrderColors.savedIcon,
        ),
        const SizedBox(height: 20),
        const Text(
          'Đơn hàng đã được ghi nhận',
          textAlign: TextAlign.center,
          style: TextStyle(
            color: CustomerOrderColors.title,
            fontSize: 22,
            fontWeight: FontWeight.w700,
          ),
        ),
        const SizedBox(height: 12),
        Text(
          order.statusLabel,
          textAlign: TextAlign.center,
          style: const TextStyle(color: CustomerOrderColors.description),
        ),
        const SizedBox(height: 20),
        Text(
          formatVnd(order.total),
          textAlign: TextAlign.center,
          style: const TextStyle(
            color: CustomerOrderColors.total,
            fontSize: 24,
            fontWeight: FontWeight.w800,
          ),
        ),
        const SizedBox(height: 16),
        Text(
          order.paymentMethod == 0
              ? 'Thanh toán khi nhận hàng.'
              : order.paymentStatus == 1
              ? 'Nhà thuốc đã xác nhận thanh toán.'
              : 'Trạng thái sẽ cập nhật sau khi ngân hàng xác nhận thanh toán. Nếu đã trả tiền, vui lòng kiểm tra trạng thái trước khi thanh toán lại.',
          textAlign: TextAlign.center,
          style: const TextStyle(color: CustomerOrderColors.description),
        ),
        if (order.environment == 'sandbox')
          const Padding(
            padding: EdgeInsets.only(top: 12),
            child: Text(
              'Đơn này được tạo trước khi bật thanh toán thật. Vui lòng đặt đơn mới để thanh toán.',
              style: TextStyle(color: CustomerOrderColors.error),
            ),
          ),
        if (error != null || linkError != null)
          Padding(
            padding: const EdgeInsets.symmetric(vertical: 16),
            child: Text(
              error ?? linkError!,
              style: const TextStyle(color: CustomerOrderColors.error),
            ),
          ),
        if (order.pendingPayment) ...[
          const SizedBox(height: 20),
          paymentButton(),
          if (payment == null && !preparing)
            TextButton(
              onPressed: prepare,
              child: const Text(
                'Tải lại liên kết thanh toán',
                style: TextStyle(color: CustomerOrderColors.refreshButton),
              ),
            ),
        ],
        TextButton.icon(
          onPressed: refresh,
          icon: const Icon(
            Icons.refresh,
            color: CustomerOrderColors.refreshButton,
          ),
          label: const Text(
            'Kiểm tra trạng thái',
            style: TextStyle(color: CustomerOrderColors.refreshButton),
          ),
        ),
      ],
    ),
  );
}

// Danh sách đơn của chính khách hàng để mở lại đơn QR khi rời ứng dụng giữa chừng.
class CustomerOrdersScreen extends StatefulWidget {
  const CustomerOrdersScreen({
    super.key,
    required this.api,
    required this.onOrder,
  });
  final CheckoutApi api;
  final ValueChanged<PlacedOrder> onOrder;
  @override
  State<CustomerOrdersScreen> createState() => _CustomerOrdersScreenState();
}

// Phân trang danh sách đơn, giữ dữ liệu hiện có khi tải trang tiếp theo thất bại.
class _CustomerOrdersScreenState extends State<CustomerOrdersScreen> {
  final List<PlacedOrder> items = [];
  bool loading = false, more = true;
  int page = 1;
  String? error;
  @override
  void initState() {
    super.initState();
    load();
  }

  Future<void> load() async {
    if (loading) return;
    setState(() {
      loading = true;
      error = null;
    });
    try {
      final result = await widget.api.orders(page: page);
      if (!mounted) return;
      setState(() {
        items.addAll(result);
        more = result.length == 10;
        page++;
      });
    } on ApiException catch (failure) {
      if (mounted) setState(() => error = checkoutError(failure));
    } finally {
      if (mounted) setState(() => loading = false);
    }
  }

  @override
  Widget build(BuildContext context) => Scaffold(
    backgroundColor: CustomerOrderColors.background,
    appBar: AppBar(
      backgroundColor: CustomerOrderColors.headerBackground,
      foregroundColor: CustomerOrderColors.headerForeground,
      title: const Text('Đơn của tôi'),
    ),
    body: ListView(
      padding: const EdgeInsets.all(16),
      children: [
        for (final order in items) ...[
          ListTile(
            contentPadding: EdgeInsets.zero,
            title: Text(
              'Đơn #${order.id}',
              style: const TextStyle(
                color: CustomerOrderColors.title,
                fontWeight: FontWeight.w700,
              ),
            ),
            subtitle: Text(
              order.statusLabel,
              style: const TextStyle(color: CustomerOrderColors.description),
            ),
            trailing: Text(
              formatVnd(order.total),
              style: const TextStyle(
                color: CustomerOrderColors.total,
                fontWeight: FontWeight.w700,
              ),
            ),
            onTap: () => widget.onOrder(order),
          ),
          const Divider(color: CustomerOrderColors.divider),
        ],
        if (!loading && items.isEmpty && error == null)
          const Text(
            'Bạn chưa có đơn hàng.',
            style: TextStyle(color: CustomerOrderColors.description),
          ),
        if (error != null)
          Text(
            error!,
            style: const TextStyle(color: CustomerOrderColors.error),
          ),
        if (loading)
          const Center(
            child: CircularProgressIndicator(
              color: CustomerOrderColors.savedIcon,
            ),
          ),
        if (!loading && more)
          TextButton(
            onPressed: load,
            child: Text(
              error == null ? 'Xem thêm' : 'Thử lại',
              style: const TextStyle(color: CustomerOrderColors.refreshButton),
            ),
          ),
      ],
    ),
  );
}
