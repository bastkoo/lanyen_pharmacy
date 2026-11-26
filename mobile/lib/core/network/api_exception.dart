enum ApiFailure {
  configuration,
  connection,
  timeout,
  response,
  authentication,
  forbidden,
  server,
  storage,
}

// Không đưa raw body, cookie hoặc lỗi nội bộ lên UI.
class ApiException implements Exception {
  const ApiException(this.failure, {this.status, this.code});
  final ApiFailure failure;
  final int? status;
  final String? code;
  String get message => switch (failure) {
    ApiFailure.storage =>
      'Không thể truy cập nơi lưu phiên an toàn. Vui lòng thử lại.',
    ApiFailure.configuration => 'Chưa thể kết nối dịch vụ đăng nhập. Vui lòng kiểm tra cấu hình khi chạy ứng dụng.',
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
