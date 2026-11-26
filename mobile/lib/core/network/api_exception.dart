enum ApiFailure {
  configuration,
  transportUnavailable,
  connection,
  timeout,
  response,
  authentication,
  forbidden,
  server,
}

// Không đưa raw body, cookie hoặc lỗi nội bộ lên UI.
class ApiException implements Exception {
  const ApiException(this.failure, {this.status, this.code});
  final ApiFailure failure;
  final int? status;
  final String? code;
  String get message => switch (failure) {
    ApiFailure.configuration => 'Chưa có cấu hình kết nối hợp lệ.',
    ApiFailure.transportUnavailable =>
      'Kết nối Backend chưa được bật trong nền tảng demo.',
    ApiFailure.connection => 'Không thể kết nối đến máy chủ.',
    ApiFailure.timeout => 'Kết nối quá thời gian chờ.',
    ApiFailure.authentication => 'Vui lòng xác thực lại phiên đăng nhập.',
    ApiFailure.forbidden => 'Không thể thực hiện yêu cầu với quyền hiện tại.',
    ApiFailure.server => 'Máy chủ đang gặp sự cố.',
    ApiFailure.response => 'Phản hồi không hợp lệ.',
  };
  @override
  String toString() => 'ApiException(${failure.name}, status: $status)';
}
