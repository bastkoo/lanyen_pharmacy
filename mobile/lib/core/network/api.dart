import '../../models/session_user.dart';
import 'api_client.dart';
import 'api_exception.dart';

// ============================================================
// API XÁC THỰC — chỉ chuẩn bị đọc phiên, không đăng nhập thật.
// ============================================================
class AuthApi {
  const AuthApi(this.client);
  final ApiClient client;

  Future<SessionUser> readSession() async {
    final data = await client.get('auth/me');
    if (data['code'] != 'AUTHENTICATED' ||
        data['user'] is! Map<String, dynamic>) {
      throw const ApiException(ApiFailure.response);
    }
    try {
      return SessionUser.fromJson(data['user'] as Map<String, dynamic>);
    } on FormatException {
      throw const ApiException(ApiFailure.response);
    }
  }
}
