import 'package:flutter/material.dart';
import 'package:flutter/services.dart';

import '../../core/theme/app_colors.dart';
import '../../core/theme/app_spacing.dart';
import 'auth_controller.dart';

// BẢNG MÀU ĐĂNG NHẬP — chỉnh màu riêng của trang tại đây.
abstract final class LoginColors {
  // Màu nhấn thương hiệu và liên kết.
  static const brand = AppColors.primaryDark;
  // Màu chữ thông báo lỗi xác thực.
  static const error = AppColors.error;
}

// Một biểu mẫu theo từng bước, OTP cho phép dán và autofill.
class LoginScreen extends StatefulWidget {
  const LoginScreen({super.key, required this.controller});
  final AuthController controller;
  @override
  State<LoginScreen> createState() => _LoginScreenState();
}

class _LoginScreenState extends State<LoginScreen> {
  final _formKey = GlobalKey<FormState>();
  final _phone = TextEditingController();
  final _otp = TextEditingController();
  final _name = TextEditingController();
  final _otpFocus = FocusNode();
  final _nameFocus = FocusNode();
  String? _lastChallenge;
  AuthStage? _lastStage;

  @override
  void initState() {
    super.initState();
    widget.controller.addListener(_onState);
  }

  void _onState() {
    final auth = widget.controller;
    if (auth.challenge != _lastChallenge) {
      _lastChallenge = auth.challenge;
      _otp.clear();
    }
    if (auth.stage != _lastStage) {
      _lastStage = auth.stage;
      if (auth.stage == AuthStage.phone) {
        _otp.clear();
        _name.clear();
      }
      WidgetsBinding.instance.addPostFrameCallback((_) {
        if (!mounted) return;
        if (auth.stage == AuthStage.otp) _otpFocus.requestFocus();
        if (auth.stage == AuthStage.profile) _nameFocus.requestFocus();
      });
    }
  }

  void _submit() {
    if (widget.controller.busy ||
        !(_formKey.currentState?.validate() ?? false)) {
      return;
    }
    final auth = widget.controller;
    switch (auth.stage) {
      case AuthStage.phone:
        auth.requestOtp(_phone.text);
      case AuthStage.otp:
        auth.verifyOtp(_otp.text);
      case AuthStage.profile:
        auth.register(_name.text);
      default:
        break;
    }
  }

  @override
  void dispose() {
    widget.controller.removeListener(_onState);
    _phone.dispose();
    _otp.dispose();
    _name.dispose();
    _otpFocus.dispose();
    _nameFocus.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    final auth = widget.controller;
    final isForm = [
      AuthStage.phone,
      AuthStage.otp,
      AuthStage.profile,
    ].contains(auth.stage);
    return Scaffold(
      body: SafeArea(
        child: Center(
          child: SingleChildScrollView(
            keyboardDismissBehavior: ScrollViewKeyboardDismissBehavior.onDrag,
            padding: const EdgeInsets.symmetric(
              horizontal: AppSpacing.lg,
              vertical: AppSpacing.xl,
            ),
            child: ConstrainedBox(
              constraints: const BoxConstraints(maxWidth: 460),
              child: AutofillGroup(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.stretch,
                  children: [
                    const _BrandHeader(),
                    const SizedBox(height: AppSpacing.xl),
                    if (auth.stage == AuthStage.checking)
                      const _SessionChecking()
                    else if (auth.stage == AuthStage.sessionError)
                      _SessionRetry(
                        error: auth.error,
                        onRetry: auth.restoreSession,
                      )
                    else if (isForm) ...[
                      _StepHeading(stage: auth.stage, phone: auth.phone),
                      const SizedBox(height: AppSpacing.lg),
                      Form(
                        key: _formKey,
                        child: Column(
                          crossAxisAlignment: CrossAxisAlignment.stretch,
                          children: [
                            if (auth.stage == AuthStage.phone)
                              _PhoneStep(
                                controller: _phone,
                                enabled: !auth.busy,
                                onSubmit: _submit,
                              )
                            else if (auth.stage == AuthStage.otp)
                              _OtpStep(
                                controller: _otp,
                                focusNode: _otpFocus,
                                enabled: !auth.busy,
                                seconds: auth.otpRemaining,
                                onSubmit: _submit,
                              )
                            else
                              _NameStep(
                                controller: _name,
                                focusNode: _nameFocus,
                                enabled: !auth.busy,
                                onSubmit: _submit,
                              ),
                            const SizedBox(height: AppSpacing.md),
                            if (auth.error != null) ...[
                              Semantics(
                                liveRegion: true,
                                child: Text(
                                  auth.error!,
                                  key: const ValueKey('auth-error'),
                                  style: const TextStyle(
                                    color: LoginColors.error,
                                  ),
                                ),
                              ),
                              const SizedBox(height: AppSpacing.md),
                            ],
                            FilledButton(
                              key: const ValueKey('auth-submit'),
                              onPressed:
                                  auth.busy ||
                                      (auth.stage == AuthStage.otp &&
                                          auth.otpRemaining == 0)
                                  ? null
                                  : _submit,
                              child: Text(
                                auth.busy
                                    ? 'Đang xử lý…'
                                    : switch (auth.stage) {
                                        AuthStage.phone => 'Nhận mã xác thực',
                                        AuthStage.otp => 'Xác nhận mã',
                                        _ => 'Hoàn tất đăng nhập',
                                      },
                              ),
                            ),
                            if (auth.busy)
                              const Padding(
                                padding: EdgeInsets.only(top: AppSpacing.md),
                                child: LinearProgressIndicator(
                                  semanticsLabel: 'Đang xác thực',
                                ),
                              ),
                            if (auth.stage == AuthStage.otp) ...[
                              const SizedBox(height: AppSpacing.sm),
                              TextButton(
                                onPressed: auth.busy || auth.resendRemaining > 0
                                    ? null
                                    : () => auth.requestOtp(auth.phone),
                                child: Text(
                                  auth.resendRemaining > 0
                                      ? 'Gửi lại mã sau ${auth.resendRemaining}s'
                                      : 'Gửi lại mã',
                                ),
                              ),
                            ],
                            if (auth.stage != AuthStage.phone)
                              TextButton(
                                onPressed: auth.busy ? null : auth.changePhone,
                                child: const Text('Đổi số điện thoại'),
                              ),
                          ],
                        ),
                      ),
                    ],
                  ],
                ),
              ),
            ),
          ),
        ),
      ),
    );
  }
}

// Logo và tên nhà thuốc tạo nhận diện, không thêm trang trí không phục vụ đăng nhập.
class _BrandHeader extends StatelessWidget {
  const _BrandHeader();
  @override
  Widget build(BuildContext context) => Wrap(
    spacing: AppSpacing.md,
    runSpacing: AppSpacing.sm,
    crossAxisAlignment: WrapCrossAlignment.center,
    children: [
      ExcludeSemantics(
        child: Image.asset('assets/images/logo.png', width: 60, height: 60),
      ),
      Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Text(
            'Lan Yến',
            style: Theme.of(context).textTheme.titleLarge
                ?.copyWith(color: LoginColors.brand),
          ),
          Text(
            'Chăm sóc từ điều giản dị',
            style: Theme.of(context).textTheme.bodySmall,
          ),
        ],
      ),
    ],
  );
}

// Thứ tự thông tin theo bước; vai trò không được nhập hoặc tự chọn.
class _StepHeading extends StatelessWidget {
  const _StepHeading({required this.stage, required this.phone});
  final AuthStage stage;
  final String phone;
  @override
  Widget build(BuildContext context) => Column(
    crossAxisAlignment: CrossAxisAlignment.start,
    children: [
      Text(
        switch (stage) {
          AuthStage.phone => 'BẮT ĐẦU / ĐĂNG NHẬP',
          AuthStage.otp => 'XÁC THỰC / 6 CHỮ SỐ',
          _ => 'HOÀN THIỆN / TÀI KHOẢN',
        },
        style: Theme.of(context).textTheme.bodySmall
            ?.copyWith(color: LoginColors.brand),
      ),
      const SizedBox(height: AppSpacing.sm),
      Semantics(
        header: true,
        child: Text(switch (stage) {
          AuthStage.phone => 'Chào bạn,\nLan Yến ở đây.',
          AuthStage.otp => 'Nhập mã xác thực',
          _ => 'Cho Lan Yến biết\ntên của bạn',
        }, style: Theme.of(context).textTheme.headlineLarge),
      ),
      const SizedBox(height: AppSpacing.md),
      Text(switch (stage) {
        AuthStage.phone => 'Nhập số điện thoại để đăng nhập hoặc tạo tài khoản. Không cần mật khẩu.',
        AuthStage.otp => 'Nhập mã gồm 6 chữ số dành cho $phone.',
        _ => 'Số điện thoại đã được xác thực. Hãy bổ sung họ tên để hoàn tất tài khoản mới.',
      }),
    ],
  );
}

class _PhoneStep extends StatelessWidget {
  const _PhoneStep({
    required this.controller,
    required this.enabled,
    required this.onSubmit,
  });
  final TextEditingController controller;
  final bool enabled;
  final VoidCallback onSubmit;
  @override
  Widget build(BuildContext context) => TextFormField(
    key: const ValueKey('phone-input'),
    controller: controller,
    enabled: enabled,
    keyboardType: TextInputType.phone,
    textInputAction: TextInputAction.done,
    autofillHints: const [AutofillHints.telephoneNumberNational],
    maxLength: 24,
    inputFormatters: [
      FilteringTextInputFormatter.allow(RegExp(r'[0-9+\s().-]')),
    ],
    decoration: const InputDecoration(
      labelText: 'Số điện thoại',
      hintText: '09xxxxxxxx',
      counterText: '',
    ),
    validator: AuthController.validatePhone,
    onFieldSubmitted: (_) => onSubmit(),
  );
}

class _OtpStep extends StatelessWidget {
  const _OtpStep({
    required this.controller,
    required this.focusNode,
    required this.enabled,
    required this.seconds,
    required this.onSubmit,
  });
  final TextEditingController controller;
  final FocusNode focusNode;
  final bool enabled;
  final int seconds;
  final VoidCallback onSubmit;
  @override
  Widget build(BuildContext context) => Column(
    crossAxisAlignment: CrossAxisAlignment.start,
    children: [
      TextFormField(
        key: const ValueKey('otp-input'),
        controller: controller,
        focusNode: focusNode,
        enabled: enabled,
        keyboardType: TextInputType.number,
        textInputAction: TextInputAction.done,
        autofillHints: const [AutofillHints.oneTimeCode],
        inputFormatters: [
          FilteringTextInputFormatter.digitsOnly,
          LengthLimitingTextInputFormatter(6),
        ],
        decoration: const InputDecoration(
          labelText: 'Mã xác thực 6 số',
          hintText: '000000',
        ),
        style: Theme.of(context).textTheme.titleLarge
            ?.copyWith(letterSpacing: 5),
        validator: AuthController.validateOtp,
        onFieldSubmitted: (_) => onSubmit(),
      ),
      const SizedBox(height: AppSpacing.sm),
      Text(
        seconds > 0
            ? 'Mã còn hiệu lực trong ${seconds ~/ 60}:${(seconds % 60).toString().padLeft(2, '0')}.'
            : 'Mã đã hết hạn. Vui lòng gửi lại mã.',
        style: Theme.of(context).textTheme.bodySmall,
      ),
    ],
  );
}

class _NameStep extends StatelessWidget {
  const _NameStep({
    required this.controller,
    required this.focusNode,
    required this.enabled,
    required this.onSubmit,
  });
  final TextEditingController controller;
  final FocusNode focusNode;
  final bool enabled;
  final VoidCallback onSubmit;
  @override
  Widget build(BuildContext context) => TextFormField(
    key: const ValueKey('name-input'),
    controller: controller,
    focusNode: focusNode,
    enabled: enabled,
    textCapitalization: TextCapitalization.words,
    autofillHints: const [AutofillHints.name],
    textInputAction: TextInputAction.done,
    maxLength: 255,
    decoration: const InputDecoration(
      labelText: 'Họ và tên',
      hintText: 'Nhập họ tên của bạn',
      counterText: '',
    ),
    validator: AuthController.validateName,
    onFieldSubmitted: (_) => onSubmit(),
  );
}

class _SessionChecking extends StatelessWidget {
  const _SessionChecking();
  @override
  Widget build(BuildContext context) => const Column(
    children: [
      CircularProgressIndicator(
        semanticsLabel: 'Đang kiểm tra phiên đăng nhập',
      ),
      SizedBox(height: AppSpacing.lg),
      Text('Đang kiểm tra phiên đăng nhập…'),
    ],
  );
}

class _SessionRetry extends StatelessWidget {
  const _SessionRetry({required this.error, required this.onRetry});
  final String? error;
  final VoidCallback onRetry;
  @override
  Widget build(BuildContext context) => Column(
    children: [
      Semantics(
        liveRegion: true,
        child: Text(error ?? 'Chưa thể kiểm tra phiên đăng nhập.'),
      ),
      const SizedBox(height: AppSpacing.lg),
      FilledButton(onPressed: onRetry, child: const Text('Kiểm tra lại')),
    ],
  );
}
