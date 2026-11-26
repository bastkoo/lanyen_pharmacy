import 'dart:async';

import 'package:flutter/foundation.dart';

import '../../core/network/api.dart';
import '../../core/network/api_exception.dart';
import '../../models/auth_session.dart';
import '../../models/session_user.dart';

enum AuthStage { checking, sessionError, phone, otp, profile, authenticated }

// State đăng nhập chỉ tin user đã được Backend xác thực, không chọn vai trò cục bộ.
class AuthController extends ChangeNotifier {
  AuthController({required this.api, DateTime Function()? now})
    : _now = now ?? DateTime.now;
  final AuthApi api;
  final DateTime Function() _now;
  AuthStage stage = AuthStage.checking;
  SessionUser? user;
  bool busy = false;
  String? error;
  String phone = '';
  String? _challenge;
  String? get challenge => _challenge;
  String? _registrationToken;
  DateTime? _expiresAt;
  DateTime? _retryAt;
  Timer? _timer;
  bool _disposed = false;

  int _remaining(DateTime? deadline) => deadline == null
      ? 0
      : ((deadline.difference(_now()).inMilliseconds / 1000).ceil()).clamp(
          0,
          86400,
        );
  int get otpRemaining => _remaining(_expiresAt);
  int get resendRemaining => _remaining(_retryAt);

  static String? validatePhone(String? value) {
    final phone = (value ?? '').trim().replaceAll(RegExp(r'[\s().-]'), '');
    return RegExp(r'^(0|\+84)[35789][0-9]{8}$').hasMatch(phone)
        ? null
        : 'Nhập số điện thoại Việt Nam hợp lệ, ví dụ 09xxxxxxxx.';
  }

  static String? validateOtp(String? value) =>
      RegExp(r'^[0-9]{6}$').hasMatch(value ?? '')
      ? null
      : 'Vui lòng nhập đủ 6 chữ số.';
  static String? validateName(String? value) {
    final name = (value ?? '').trim();
    return name.isEmpty || name.length > 255 || name.runes.any((v) => v < 32)
        ? 'Vui lòng nhập họ và tên hợp lệ, tối đa 255 ký tự.'
        : null;
  }

  void _notify() {
    if (!_disposed) notifyListeners();
  }

  Future<void> restoreSession() async {
    if (busy) return;
    stage = AuthStage.checking;
    await _perform(() async {
      try {
        final restored = await api.restoreSession();
        if (_disposed) return;
        user = restored;
        stage = restored == null ? AuthStage.phone : AuthStage.authenticated;
      } on ApiException catch (failure) {
        if (_disposed) return;
        stage = failure.status == 401 || failure.status == 403
            ? AuthStage.phone
            : AuthStage.sessionError;
        if (stage == AuthStage.phone) user = null;
        rethrow;
      }
    });
  }

  Future<void> requestOtp(String value) async {
    if (busy || (stage != AuthStage.phone && stage != AuthStage.otp)) return;
    final validation = validatePhone(value);
    if (validation != null) {
      error = validation;
      _notify();
      return;
    }
    if (stage == AuthStage.otp && resendRemaining > 0) return;
    await _perform(() async {
      final delivery = await api.requestOtp(value.trim());
      if (_disposed) return;
      phone = value.trim();
      _challenge = delivery.challengeToken;
      _registrationToken = null;
      _expiresAt = _now().add(Duration(seconds: delivery.expiresIn));
      _retryAt = _now().add(Duration(seconds: delivery.retryAfter));
      stage = AuthStage.otp;
      _startTimer();
    });
  }

  Future<void> verifyOtp(String otp) async {
    if (busy || stage != AuthStage.otp || _challenge == null) return;
    final validation = validateOtp(otp);
    if (validation != null) {
      error = validation;
      _notify();
      return;
    }
    if (otpRemaining == 0) {
      error = 'Mã đã hết hạn. Vui lòng gửi lại mã xác thực.';
      _notify();
      return;
    }
    await _perform(() async {
      final result = await api.verifyOtp(_challenge!, otp);
      if (_disposed) return;
      _apply(result);
    });
  }

  Future<void> register(String name) async {
    if (busy || stage != AuthStage.profile || _registrationToken == null) {
      return;
    }
    final validation = validateName(name);
    if (validation != null) {
      error = validation;
      _notify();
      return;
    }
    await _perform(() async {
      final result = await api.register(_registrationToken!, name.trim());
      if (_disposed) return;
      _apply(result);
    });
  }

  void _apply(AuthResult result) {
    _timer?.cancel();
    if (result.user != null && result.tokens != null) {
      user = result.user;
      stage = AuthStage.authenticated;
      _challenge = null;
      _registrationToken = null;
      phone = '';
    } else if (result.registrationToken != null) {
      _registrationToken = result.registrationToken;
      _challenge = null;
      stage = AuthStage.profile;
    }
  }

  Future<void> logout() async {
    if (busy || user == null) return;
    await _perform(() async {
      await api.logout();
      if (_disposed) return;
      user = null;
      _reset();
    });
  }

  void changePhone() {
    if (busy) return;
    _reset();
    _notify();
  }

  void _reset() {
    _timer?.cancel();
    _challenge = null;
    _registrationToken = null;
    _expiresAt = null;
    _retryAt = null;
    stage = AuthStage.phone;
    error = null;
  }

  void _startTimer() {
    _timer?.cancel();
    _timer = Timer.periodic(const Duration(seconds: 1), (timer) {
      if (_disposed ||
          stage != AuthStage.otp ||
          (otpRemaining == 0 && resendRemaining == 0)) {
        timer.cancel();
      }
      _notify();
    });
  }

  Future<void> _perform(Future<void> Function() work) async {
    if (_disposed || busy) return;
    busy = true;
    error = null;
    _notify();
    try {
      await work();
    } on ApiException catch (failure) {
      if (_disposed) return;
      if (failure.code == 'OTP_EXPIRED' ||
          failure.code == 'OTP_ATTEMPTS_EXCEEDED') {
        _expiresAt = _now();
        _retryAt = _now();
      }
      if (failure.code == 'VERIFICATION_EXPIRED' ||
          (failure.code == 'TOKEN_EXPIRED' &&
              (stage == AuthStage.profile || stage == AuthStage.otp))) {
        _reset();
      }
      error = errorMessage(failure);
    } on Exception {
      if (!_disposed) error = 'Không thể hoàn tất đăng nhập. Vui lòng thử lại.';
    } finally {
      if (!_disposed) {
        busy = false;
        _notify();
      }
    }
  }

  static String errorMessage(ApiException failure) => switch (failure.code) {
    'INVALID_PHONE' => 'Số điện thoại chưa hợp lệ. Vui lòng kiểm tra lại.',
    'OTP_INVALID' => 'Mã xác thực chưa đúng. Vui lòng kiểm tra và nhập lại.',
    'OTP_EXPIRED' => 'Mã đã hết hạn. Vui lòng gửi lại mã xác thực.',
    'OTP_ATTEMPTS_EXCEEDED' =>
      'Bạn đã nhập sai quá số lần cho phép. Vui lòng gửi lại mã.',
    'RATE_LIMITED' => 'Bạn thao tác quá nhiều lần. Vui lòng thử lại sau.',
    'VERIFICATION_EXPIRED' ||
    'TOKEN_EXPIRED' => 'Phiên xác thực đã hết hạn. Vui lòng xác thực lại.',
    'ACCOUNT_LOCKED' => 'Tài khoản đã bị khóa. Vui lòng liên hệ nhà thuốc.',
    'FORBIDDEN' => 'Tài khoản chưa có quyền truy cập ứng dụng.',
    'AUTH_UNAVAILABLE' =>
      'Dịch vụ xác thực chưa sẵn sàng. Vui lòng thử lại sau.',
    'DATABASE_UNAVAILABLE' =>
      'Chưa thể kiểm tra tài khoản. Vui lòng thử lại sau.',
    'UNAUTHENTICATED' || 'INVALID_TOKEN' =>
      'Phiên đăng nhập không còn hợp lệ. Vui lòng đăng nhập lại.',
    _ => failure.message,
  };

  @override
  void dispose() {
    _disposed = true;
    _timer?.cancel();
    super.dispose();
  }
}
