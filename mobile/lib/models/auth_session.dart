import 'session_user.dart';

// Token là thông tin nhạy cảm, không đưa vào toString hoặc log.
class TokenPair {
  const TokenPair(this.accessToken, this.refreshToken);
  final String accessToken;
  final String refreshToken;

  factory TokenPair.fromJson(Map<String, dynamic> json) {
    final access = json['access_token'];
    final refresh = json['refresh_token'];
    if (access is! String ||
        access.isEmpty ||
        refresh is! String ||
        refresh.isEmpty) {
      throw const FormatException('Token không hợp lệ.');
    }
    return TokenPair(access, refresh);
  }

  Map<String, String> toJson() => {
    'access_token': accessToken,
    'refresh_token': refreshToken,
  };
}

class OtpDelivery {
  const OtpDelivery(this.challengeToken, this.expiresIn, this.retryAfter);
  final String challengeToken;
  final int expiresIn;
  final int retryAfter;

  factory OtpDelivery.fromJson(Map<String, dynamic> json) {
    if (json['code'] != 'OTP_SENT' ||
        json['challenge_token'] is! String ||
        (json['challenge_token'] as String).isEmpty ||
        json['expires_in'] is! int ||
        (json['expires_in'] as int) < 1 ||
        json['retry_after'] is! int ||
        (json['retry_after'] as int) < 0) {
      throw const FormatException('Phản hồi OTP không hợp lệ.');
    }
    return OtpDelivery(
      json['challenge_token'] as String,
      json['expires_in'] as int,
      json['retry_after'] as int,
    );
  }
}

class AuthResult {
  const AuthResult({this.user, this.tokens, this.registrationToken});
  final SessionUser? user;
  final TokenPair? tokens;
  final String? registrationToken;

  factory AuthResult.fromJson(Map<String, dynamic> json) {
    if (json['code'] == 'PROFILE_REQUIRED' &&
        json['registration_token'] is String &&
        (json['registration_token'] as String).isNotEmpty) {
      return AuthResult(
        registrationToken: json['registration_token'] as String,
      );
    }
    if (json['code'] != 'AUTHENTICATED' ||
        json['token_type'] != 'Bearer' ||
        json['user'] is! Map<String, dynamic>) {
      throw const FormatException('Kết quả xác thực không hợp lệ.');
    }
    return AuthResult(
      user: SessionUser.fromJson(json['user'] as Map<String, dynamic>),
      tokens: TokenPair.fromJson(json),
    );
  }
}
