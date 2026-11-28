import 'package:flutter/foundation.dart';

import '../../core/network/api_exception.dart';
import '../../models/customer_cart.dart';
import 'customer_home_controller.dart';

// State của trang giỏ: chọn dòng và báo giá theo lựa chọn, không tin giá lưu trên máy.
class CustomerCartController extends ChangeNotifier {
  CustomerCartController(this.home) {
    home.addListener(_changed);
    _changed();
  }
  final CustomerHomeController home;
  final Set<int> selected = {};
  CustomerCart? displayed, summary;
  CustomerCart? _previous;
  String? error;
  bool loading = false, _disposed = false;
  int _version = 0;
  bool get busy =>
      home.adding || home.cartLoading || home.cartError != null || loading;
  bool get allSelected =>
      (home.cart?.items.isNotEmpty ?? false) &&
      selected.length == home.cart!.items.length;
  bool get canBuy =>
      home.cartError == null &&
      !busy &&
      !loading &&
      error == null &&
      selected.isNotEmpty &&
      summary?.total != null &&
      summary!.items.isNotEmpty &&
      summary!.items.length == selected.length &&
      summary!.items.every(
        (i) => i.available && !i.consultation && i.total != null,
      );
  List<CartLine> get lines => displayed?.items ?? home.cart?.items ?? const [];
  void _emit() {
    if (!_disposed) notifyListeners();
  }

  void _changed() {
    if (!identical(_previous, home.cart)) {
      final old = _previous?.items.map((i) => i.unitId).toSet() ?? <int>{};
      _previous = home.cart;
      final current = home.cart?.items.map((i) => i.unitId).toSet() ?? <int>{};
      selected.removeWhere((id) => !current.contains(id));
      selected.addAll(current.difference(old));
      refresh();
    }
    _emit();
  }

  void toggle(int id) {
    if (busy) return;
    if (!selected.add(id)) selected.remove(id);
    refresh();
  }

  void selectAll() {
    if (busy) return;
    if (allSelected) {
      selected.clear();
    } else {
      selected.addAll(home.cart?.items.map((i) => i.unitId) ?? const <int>[]);
    }
    refresh();
  }

  Future<void> refresh() async {
    if (_disposed) return;
    final version = ++_version;
    loading = true;
    error = null;
    summary = null;
    _emit();
    final items = home.cart?.items ?? const <CartLine>[];
    if (items.isEmpty) {
      displayed = const CustomerCart([]);
      summary = CustomerCart(
        const [],
        total: BigInt.zero,
        estimatedPoints: BigInt.zero,
      );
      loading = false;
      _emit();
      return;
    }
    try {
      final api = home.cartApi;
      if (api == null) throw const ApiException(ApiFailure.configuration);
      final full = await api.quote(items, authorized: home.customerId != null);
      if (_disposed || version != _version) return;
      displayed = full;
      final chosen = items.where((i) => selected.contains(i.unitId)).toList();
      final value = chosen.isEmpty
          ? CustomerCart(
              const [],
              total: BigInt.zero,
              estimatedPoints: BigInt.zero,
            )
          : chosen.length == items.length
          ? full
          : await api.quote(chosen, authorized: home.customerId != null);
      if (version == _version && !_disposed) {
        summary = value;
        final chosenPrices = {
          for (final item in value.items) item.unitId: item,
        };
        displayed = CustomerCart(
          full.items.map((item) => chosenPrices[item.unitId] ?? item).toList(),
        );
      }
    } on ApiException catch (failure) {
      if (version == _version) {
        error = 'Chưa tính được giá hiện tại. ${failure.message}';
      }
    } finally {
      if (version == _version) {
        loading = false;
        _emit();
      }
    }
  }

  @override
  void dispose() {
    _disposed = true;
    _version++;
    home.removeListener(_changed);
    super.dispose();
  }
}
