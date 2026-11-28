import 'dart:math';

import 'package:flutter/foundation.dart';

import '../../core/network/api.dart';
import '../../core/network/api_exception.dart';
import '../../core/storage/checkout_storage.dart';
import '../../models/checkout.dart';

// State đặt hàng: quote do Backend quyết định; một mã yêu cầu được giữ qua mọi lần gửi lại.
class CustomerCheckoutController extends ChangeNotifier {
  CustomerCheckoutController(this.api, this.units, this.storage);
  final CheckoutApi api;
  final List<int> units;
  final CheckoutStorage storage;
  List<DeliveryAddress> addresses = [];
  String? addressId, error;
  String receipt = 'delivery', note = '';
  int paymentMethod = 0;
  bool usePoints = false,
      initialized = false,
      loading = false,
      submitting = false,
      quoting = false,
      uncertain = false,
      _disposed = false;
  CheckoutQuote? quote;
  PlacedOrder? order;
  String requestId = _uuid();
  int _version = 0;
  void _emit() {
    if (!_disposed) notifyListeners();
  }

  bool get canSubmit =>
      !loading &&
      !submitting &&
      !quoting &&
      !uncertain &&
      initialized &&
      quote != null &&
      (!usePoints || quote!.redeemed > BigInt.zero) &&
      (receipt == 'pickup' || addressId != null) &&
      (paymentMethod == 0 || quote!.total > BigInt.zero);
  Future<void> initialize() async {
    if (_disposed || loading || submitting) return;
    loading = true;
    error = null;
    _emit();
    try {
      final previous = await storage.read();
      if (_disposed) return;
      if (previous != null) {
        requestId = previous;
        try {
          order = await api.recover(requestId);
          await storage.save(null);
          return;
        } on ApiException catch (failure) {
          if (failure.code != 'ORDER_NOT_FOUND') rethrow;
        }
      }
      addresses = await api.addresses();
      if (_disposed) return;
      addressId =
          addresses.where((a) => a.primary).firstOrNull?.id ??
          addresses.firstOrNull?.id;
      initialized = true;
      await refreshQuote();
    } on ApiException catch (failure) {
      error = checkoutError(failure);
    } on Exception {
      error = 'Chưa truy cập được nơi lưu yêu cầu đặt hàng trên thiết bị.';
    } finally {
      loading = false;
      _emit();
    }
  }

  Future<void> refreshQuote() async {
    if (_disposed || submitting || uncertain) return;
    final version = ++_version;
    quoting = true;
    error = null;
    quote = null;
    _emit();
    try {
      final value = await api.quote(units, usePoints);
      if (!_disposed && version == _version) quote = value;
    } on ApiException catch (failure) {
      if (version == _version) error = checkoutError(failure);
    } finally {
      if (version == _version) {
        quoting = false;
        _emit();
      }
    }
  }

  Future<void> retry() => initialized ? refreshQuote() : initialize();

  void setReceipt(String value) {
    if (!submitting && !uncertain) {
      receipt = value;
      _emit();
    }
  }

  void setAddress(String id) {
    if (!submitting && !uncertain) {
      addressId = id;
      _emit();
    }
  }

  void setPayment(int value) {
    if (!submitting && !uncertain) {
      paymentMethod = value;
      _emit();
    }
  }

  Future<void> setPoints(bool value) async {
    if (submitting || uncertain) return;
    usePoints = value;
    await refreshQuote();
  }

  Future<bool> saveAddress(Map<String, dynamic> values, {String? id}) async {
    try {
      final address = await api.saveAddress(values, id: id);
      if (_disposed) return false;
      addresses = await api.addresses();
      if (_disposed) return false;
      addressId = address.id;
      _emit();
      return true;
    } on ApiException catch (failure) {
      error = checkoutError(failure);
      _emit();
      return false;
    }
  }

  Future<void> submit() async {
    if (!canSubmit || _disposed) return;
    final values = <String, dynamic>{
      'request_id': requestId,
      'MaDonGia': List<int>.of(units),
      'DoiDiem': usePoints,
      'PhuongThucThanhToan': paymentMethod,
      'HinhThucNhanHang': receipt,
      'MaDiaChi': receipt == 'delivery' ? addressId : null,
      'GhiChu': note.trim(),
      'TongThanhToan': '${quote!.total}',
    };
    submitting = true;
    error = null;
    _emit();
    try {
      await storage.save(requestId);
      if (_disposed) return;
      final value = await api.create(values);
      if (_disposed) return;
      order = value;
      await storage.save(null);
    } on ApiException catch (failure) {
      if (_disposed) return;
      // Đối chiếu cùng request_id trước khi cho đặt lại; không tự POST khi mất phản hồi.
      try {
        order = await api.recover(requestId);
        await storage.save(null);
      } on ApiException catch (_) {
        uncertain =
            failure.status == null ||
            (failure.status ?? 0) >= 500 ||
            failure.code == 'CHECKOUT_REQUEST_CONFLICT';
        error = uncertain
            ? 'Chưa xác định được kết quả. Hãy kiểm tra yêu cầu đã gửi, không tạo yêu cầu mới.'
            : checkoutError(failure);
        if (failure.code == 'QUOTE_CHANGED' ||
            failure.code == 'POINTS_UNAVAILABLE') {
          quote = null;
        }
      } on Exception {
        uncertain = order == null;
        error = order == null
            ? 'Chưa kiểm tra được yêu cầu đã gửi. Vui lòng thử kiểm tra lại.'
            : null;
      }
    } on Exception {
      uncertain = order == null;
      error = order == null
          ? 'Chưa lưu được yêu cầu trên thiết bị. Vui lòng kiểm tra lại.'
          : null;
    } finally {
      submitting = false;
      _emit();
    }
  }

  Future<void> recover() async {
    if (submitting || _disposed) return;
    submitting = true;
    _emit();
    try {
      order = await api.recover(requestId);
      if (_disposed) return;
      await storage.save(null);
      uncertain = false;
      error = null;
    } on ApiException catch (failure) {
      if (failure.code == 'ORDER_NOT_FOUND') {
        uncertain = false;
        error = 'Chưa tìm thấy đơn của yêu cầu này. Bạn có thể gửi lại cùng mã yêu cầu.';
      } else {
        error = checkoutError(failure);
      }
    } on Exception {
      uncertain = order == null;
      error = order == null
          ? 'Chưa truy cập được nơi lưu yêu cầu. Vui lòng thử lại.'
          : null;
    } finally {
      submitting = false;
      _emit();
    }
  }

  @override
  void dispose() {
    _disposed = true;
    _version++;
    super.dispose();
  }
}

String checkoutError(ApiException failure) => switch (failure.code) {
  'OUT_OF_STOCK' =>
    'Không đủ tồn kho. Vui lòng trở lại giỏ hàng để điều chỉnh.',
  'CART_CHANGED' =>
    'Giỏ hàng đã thay đổi. Vui lòng kiểm tra lại sản phẩm đã chọn.',
  'QUOTE_CHANGED' =>
    'Giá hoặc ưu đãi đã thay đổi. Hãy tải lại trước khi đặt hàng.',
  'POINTS_UNAVAILABLE' => 'Số dư xu đã thay đổi. Vui lòng tải lại báo giá.',
  'ADDRESS_NOT_FOUND' =>
    'Địa chỉ không còn tồn tại. Vui lòng chọn lại địa chỉ.',
  'CONSULTATION_REQUIRED' => 'Sản phẩm cần dược sĩ tư vấn trước khi đặt hàng.',
  'QR_AMOUNT_INVALID' =>
    'Tổng tiền bằng 0. Vui lòng chọn thanh toán khi nhận hàng.',
  'GATEWAY_NOT_CONFIGURED' ||
  'GATEWAY_CONFIG_INVALID' ||
  'GATEWAY_PRODUCTION_DISABLED' =>
    'Thanh toán QR chưa được cấu hình đầy đủ trên máy chủ.',
  'ORDER_PAYMENT_ENVIRONMENT_MISMATCH' || 'ORDER_PAYMENT_ENVIRONMENT_UNKNOWN' => 'Đơn này không thuộc cấu hình thanh toán hiện tại. Vui lòng đặt đơn mới để thanh toán.',
  'ORDER_EXPIRED' =>
    'Đơn QR đã quá hạn thanh toán. Vui lòng kiểm tra lại đơn hàng.',
  'ORDER_ALREADY_PAID' => 'Đơn này đã được thanh toán. Hãy tải lại trạng thái.',
  'PAYMENT_LINK_EXPIRED' =>
    'Liên kết thanh toán đã hết hạn. Vui lòng mở lại từ đơn hàng.',
  _ => failure.message,
};

String _uuid() {
  final random = Random.secure();
  final bytes = List.generate(16, (_) => random.nextInt(256));
  bytes[6] = (bytes[6] & 15) | 64;
  bytes[8] = (bytes[8] & 63) | 128;
  final hex = bytes.map((b) => b.toRadixString(16).padLeft(2, '0')).join();
  return '${hex.substring(0, 8)}-${hex.substring(8, 12)}-${hex.substring(12, 16)}-${hex.substring(16, 20)}-${hex.substring(20)}';
}
