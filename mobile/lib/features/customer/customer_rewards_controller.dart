import 'dart:async';

import 'package:flutter/foundation.dart';

import '../../core/network/api.dart';
import '../../core/network/api_exception.dart';
import '../../models/rewards.dart';

// Số dư, tuần điểm danh và lịch sử lấy từ Backend; không tự cộng xu trên máy.
class CustomerRewardsController extends ChangeNotifier {
  CustomerRewardsController(this.api);
  final RewardsApi api;
  RewardsData? data;
  bool loading = false, claiming = false, _disposed = false;
  String? error, message;
  bool messageConfirmed = false;
  int _version = 0;
  Timer? _rollover;
  void _emit() {
    if (!_disposed) notifyListeners();
  }

  bool get canClaim =>
      !loading &&
      !claiming &&
      error == null &&
      data?.todayDay.status == 'today';
  Future<void> load({int? page}) async {
    if (_disposed) return;
    final version = ++_version;
    loading = true;
    error = null;
    _emit();
    try {
      final value = await api.read(page: page ?? data?.page ?? 1);
      if (_disposed || version != _version) return;
      data = value;
      _rollover?.cancel();
      // Dựa trên chênh lệch giờ Backend, không tin ngày/giờ cài trên điện thoại.
      _rollover = Timer(
        value.nextRefresh.difference(value.serverTime) +
            const Duration(seconds: 1),
        () => load(),
      );
    } on ApiException catch (failure) {
      if (version == _version) error = failure.message;
    } finally {
      if (version == _version) {
        loading = false;
        _emit();
      }
    }
  }

  Future<void> claim() async {
    if (!canClaim || _disposed) return;
    claiming = true;
    message = null;
    messageConfirmed = false;
    _emit();
    try {
      final value = await api.checkIn();
      if (_disposed) return;
      message = value.awarded == BigInt.zero
          ? 'Bạn đã điểm danh hôm nay.'
          : 'Đã nhận ${value.awarded} xu điểm danh.';
      messageConfirmed = true;
      await load(page: 1);
    } on ApiException catch (_) {
      if (_disposed) return;
      // Không tự phát lại POST khi mất mạng; đọc lại để đối chiếu ngày đã nhận.
      await load(page: 1);
      message = data?.todayDay.claimed == true && error == null
          ? 'Hôm nay đã được ghi nhận điểm danh.'
          : 'Chưa xác nhận được điểm danh. Vui lòng tải lại trước khi thử lại.';
      messageConfirmed = data?.todayDay.claimed == true && error == null;
    } finally {
      claiming = false;
      _emit();
    }
  }

  @override
  void dispose() {
    _disposed = true;
    _version++;
    _rollover?.cancel();
    super.dispose();
  }
}
