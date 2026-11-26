import '../../models/auth_session.dart';
import '../../models/session_user.dart';
import 'api_client.dart';
import 'api_exception.dart';

// ============================================================
// API XÁC THỰC MOBILE JWT — không sử dụng /api/auth của Website.
// ============================================================
class AuthApi {
  const AuthApi(this.client);
  final ApiClient client;

  Future<void> _clearSession() async {
    try {
      await client.session.clear();
    } on Exception {
      throw const ApiException(ApiFailure.storage);
    }
  }

  T _parse<T>(T Function() parser) {
    try {
      return parser();
    } on FormatException {
      throw const ApiException(ApiFailure.response);
    }
  }

  Future<OtpDelivery> requestOtp(String phone) async {
    final data = await client.post('mobile/auth/otp/request', {'phone': phone});
    return _parse(() => OtpDelivery.fromJson(data));
  }

  Future<AuthResult> verifyOtp(String challenge, String otp) async {
    final data = await client.post('mobile/auth/otp/verify', {
      'challenge_token': challenge,
      'otp': otp,
    });
    return _accept(data);
  }

  Future<AuthResult> register(String registrationToken, String name) async {
    final data = await client.post('mobile/auth/register', {
      'registration_token': registrationToken,
      'ho_ten': name,
    });
    return _accept(data);
  }

  Future<AuthResult> _accept(Map<String, dynamic> data) async {
    final result = _parse(() => AuthResult.fromJson(data));
    if (result.tokens != null) {
      try {
        await client.session.save(result.tokens!);
      } on Exception {
        throw const ApiException(ApiFailure.storage);
      }
    }
    return result;
  }

  Future<SessionUser> readSession() async {
    final data = await client.get('mobile/auth/me', authorized: true);
    return _parse(() {
      if (data['code'] != 'AUTHENTICATED' ||
          data['user'] is! Map<String, dynamic>) {
        throw const FormatException();
      }
      return SessionUser.fromJson(data['user'] as Map<String, dynamic>);
    });
  }

  Future<SessionUser?> restoreSession() async {
    try {
      await client.session.load();
    } on Exception {
      throw const ApiException(ApiFailure.storage);
    }
    if (client.session.tokens == null) return null;
    try {
      return await readSession();
    } on ApiException catch (error) {
      if (error.code == 'TOKEN_EXPIRED') {
        try {
          await refresh();
          return await readSession();
        } on ApiException catch (refreshError) {
          if (refreshError.status == 401 || refreshError.status == 403) {
            await _clearSession();
          }
          rethrow;
        }
      }
      if (error.status == 401 || error.status == 403) {
        await _clearSession();
      }
      rethrow;
    }
  }

  Future<void> refresh() async {
    final refresh = client.session.tokens?.refreshToken;
    if (refresh == null) throw const ApiException(ApiFailure.authentication);
    final data = await client.post('mobile/auth/refresh', {
      'refresh_token': refresh,
    });
    await _accept(data);
  }

  Future<void> logout() async {
    final token = client.session.tokens?.refreshToken;
    if (token == null) {
      await _clearSession();
      return;
    }
    try {
      final result = await client.post('mobile/auth/logout', {
        'refresh_token': token,
      });
      if (result['code'] != 'LOGGED_OUT') {
        throw const ApiException(ApiFailure.response);
      }
    } on ApiException catch (error) {
      if (error.status != 401) rethrow;
    }
    await _clearSession();
  }
}
