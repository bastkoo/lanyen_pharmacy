import 'package:flutter/material.dart';
import 'package:flutter/services.dart';

import '../../core/theme/app_colors.dart';
import '../../core/theme/app_radius.dart';
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
      WidgetsBinding.instance.addPostFrameCallback((_) {
        if (mounted && auth.stage == AuthStage.otp) _otpFocus.requestFocus();
      });
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
              constraints: const BoxConstraints(maxWidth: 420),
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
  Widget build(BuildContext context) => Column(
    children: [
      ExcludeSemantics(
        child: Image.asset('assets/images/logo.png', width: 80, height: 80),
      ),
      const SizedBox(height: AppSpacing.md),
      Text(
        'Lan Yến Pharmacy',
        textAlign: TextAlign.center,
        style: Theme.of(context).textTheme.headlineSmall
            ?.copyWith(color: LoginColors.brand),
      ),
      const SizedBox(height: AppSpacing.xs),
      Text(
        'Chăm sóc từ điều giản dị',
        textAlign: TextAlign.center,
        style: Theme.of(context).textTheme.bodySmall,
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
    crossAxisAlignment: CrossAxisAlignment.center,
    children: [
      Semantics(
        header: true,
        child: Text(
          switch (stage) {
            AuthStage.phone => 'Đăng nhập',
            AuthStage.otp => 'Xác thực số điện thoại',
            _ => 'Hoàn tất tài khoản',
          },
          textAlign: TextAlign.center,
          style: Theme.of(context).textTheme.headlineSmall,
        ),
      ),
      const SizedBox(height: AppSpacing.md),
      Text(switch (stage) {
        AuthStage.phone => 'Nhập số điện thoại để đăng nhập hoặc tạo tài khoản. Không cần mật khẩu.',
        AuthStage.otp => 'Nhập mã gồm 6 chữ số dành cho $phone.',
        _ => 'Số điện thoại đã được xác thực. Hãy bổ sung họ tên để hoàn tất tài khoản mới.',
      }, textAlign: TextAlign.center),
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
    crossAxisAlignment: CrossAxisAlignment.center,
    children: [
      _OtpCodeInput(
        key: const ValueKey('otp-input'),
        controller: controller,
        firstFocus: focusNode,
        enabled: enabled,
        onSubmit: onSubmit,
      ),
      const SizedBox(height: AppSpacing.sm),
      Text(
        seconds > 0
            ? 'Mã còn hiệu lực trong ${seconds ~/ 60}:${(seconds % 60).toString().padLeft(2, '0')}.'
            : 'Mã đã hết hạn. Vui lòng gửi lại mã.',
        style: Theme.of(context).textTheme.bodySmall,
        textAlign: TextAlign.center,
      ),
    ],
  );
}

// Sáu ô OTP giữ một giá trị tổng hợp duy nhất để gửi tới Backend.
class _OtpCodeInput extends StatefulWidget {
  const _OtpCodeInput({
    super.key,
    required this.controller,
    required this.firstFocus,
    required this.enabled,
    required this.onSubmit,
  });
  final TextEditingController controller;
  final FocusNode firstFocus;
  final bool enabled;
  final VoidCallback onSubmit;

  @override
  State<_OtpCodeInput> createState() => _OtpCodeInputState();
}

class _OtpCodeInputState extends State<_OtpCodeInput> {
  final _fieldKey = GlobalKey<FormFieldState<String>>();
  final _digits = List.generate(6, (_) => TextEditingController());
  late final List<FocusNode> _nodes;
  late final List<VoidCallback> _focusListeners;
  bool _publishing = false;

  @override
  void initState() {
    super.initState();
    _nodes = [widget.firstFocus, ...List.generate(5, (_) => FocusNode())];
    _focusListeners = List.generate(
      6,
      (index) => () {
        if (_nodes[index].hasFocus) _selectDigit(index);
      },
    );
    for (var index = 0; index < 6; index++) {
      _nodes[index].addListener(_focusListeners[index]);
    }
    widget.controller.addListener(_syncFromController);
    _syncFromController();
  }

  @override
  void didUpdateWidget(covariant _OtpCodeInput oldWidget) {
    super.didUpdateWidget(oldWidget);
    if (oldWidget.controller != widget.controller) {
      oldWidget.controller.removeListener(_syncFromController);
      widget.controller.addListener(_syncFromController);
      _syncFromController();
    }
  }

  // Mã mới hoặc đổi số điện thoại phải xóa đồng thời cả sáu ô.
  void _syncFromController() {
    if (_publishing) return;
    final code = widget.controller.text;
    for (var index = 0; index < 6; index++) {
      final value = index < code.length ? code[index] : '';
      if (_digits[index].text != value) _digits[index].text = value;
    }
    _fieldKey.currentState?.didChange(code);
  }

  void _selectDigit(int index) {
    _digits[index].selection = TextSelection(
      baseOffset: 0,
      extentOffset: _digits[index].text.length,
    );
  }

  void _focus(int index) {
    _nodes[index].requestFocus();
    _selectDigit(index);
  }

  void _publish() {
    final code = _digits.map((digit) => digit.text).join();
    _publishing = true;
    widget.controller.value = TextEditingValue(
      text: code,
      selection: TextSelection.collapsed(offset: code.length),
    );
    _publishing = false;
    final field = _fieldKey.currentState;
    field?.didChange(code);
    if (field?.hasError ?? false) field!.validate();
  }

  // Dán đủ sáu số sẽ thay toàn bộ mã, kể cả khi đang đứng ở ô giữa.
  void _changed(int index, String value) {
    if (value.isEmpty) {
      _digits[index].clear();
      _publish();
      if (index > 0) _focus(index - 1);
      return;
    }
    final start = value.length == 6 ? 0 : index;
    if (value.length > 1) {
      for (var i = start; i < 6; i++) {
        _digits[i].clear();
      }
    }
    final length = value.length.clamp(0, 6 - start);
    for (var i = 0; i < length; i++) {
      _digits[start + i].text = value[i];
    }
    _publish();
    _focus((start + length).clamp(0, 5));
  }

  KeyEventResult _key(int index, KeyEvent event) {
    if (!widget.enabled ||
        (event is! KeyDownEvent && event is! KeyRepeatEvent)) {
      return KeyEventResult.ignored;
    }
    if (event.logicalKey == LogicalKeyboardKey.backspace &&
        _digits[index].text.isEmpty &&
        index > 0) {
      _digits[index - 1].clear();
      _publish();
      _focus(index - 1);
      return KeyEventResult.handled;
    }
    if (event.logicalKey == LogicalKeyboardKey.arrowLeft && index > 0) {
      _focus(index - 1);
      return KeyEventResult.handled;
    }
    if (event.logicalKey == LogicalKeyboardKey.arrowRight && index < 5) {
      _focus(index + 1);
      return KeyEventResult.handled;
    }
    return KeyEventResult.ignored;
  }

  @override
  void dispose() {
    widget.controller.removeListener(_syncFromController);
    for (var index = 0; index < 6; index++) {
      _nodes[index].removeListener(_focusListeners[index]);
      if (index > 0) _nodes[index].dispose();
      _digits[index].dispose();
    }
    super.dispose();
  }

  @override
  Widget build(BuildContext context) => FormField<String>(
    key: _fieldKey,
    initialValue: widget.controller.text,
    enabled: widget.enabled,
    validator: AuthController.validateOtp,
    builder: (field) => Column(
      crossAxisAlignment: CrossAxisAlignment.stretch,
      children: [
        const Text('Mã xác thực gồm 6 số', textAlign: TextAlign.center),
        const SizedBox(height: AppSpacing.md),
        LayoutBuilder(
          builder: (context, constraints) {
            final largeText = MediaQuery.textScalerOf(context).scale(22) > 32;
            final columns = constraints.maxWidth >= 328 && !largeText ? 6 : 3;
            final width =
                ((constraints.maxWidth - (columns - 1) * AppSpacing.sm) /
                        columns)
                    .clamp(AppSpacing.touchTarget, columns == 6 ? 56.0 : 72.0)
                    .floorToDouble();
            return Center(
              child: SizedBox(
                width: columns * width + (columns - 1) * AppSpacing.sm,
                child: FocusTraversalGroup(
                  child: Wrap(
                    alignment: WrapAlignment.center,
                    spacing: AppSpacing.sm,
                    runSpacing: AppSpacing.md,
                    children: [
                      for (var index = 0; index < 6; index++)
                        SizedBox(
                          width: width,
                          child: Focus(
                            canRequestFocus: false,
                            skipTraversal: true,
                            onKeyEvent: (_, event) => _key(index, event),
                            child: Semantics(
                              label:
                                  'Chữ số ${index + 1} của mã xác thực, tổng cộng 6 số',
                              child: TextField(
                                key: ValueKey('otp-digit-$index'),
                                controller: _digits[index],
                                focusNode: _nodes[index],
                                enabled: widget.enabled,
                                textAlign: TextAlign.center,
                                keyboardType: TextInputType.number,
                                textInputAction: index == 5
                                    ? TextInputAction.done
                                    : TextInputAction.next,
                                autofillHints: index == 0
                                    ? const [AutofillHints.oneTimeCode]
                                    : null,
                                inputFormatters: [
                                  FilteringTextInputFormatter.digitsOnly,
                                  LengthLimitingTextInputFormatter(6),
                                ],
                                decoration: InputDecoration(
                                  contentPadding: const EdgeInsets.symmetric(
                                    vertical: AppSpacing.md,
                                  ),
                                  border: OutlineInputBorder(
                                    borderRadius: BorderRadius.circular(
                                      AppRadius.md,
                                    ),
                                  ),
                                ),
                                style: Theme.of(context).textTheme.titleLarge
                                    ?.copyWith(fontSize: 22, height: 1.2),
                                onTap: () => _selectDigit(index),
                                onChanged: (value) => _changed(index, value),
                                onSubmitted: (_) {
                                  if (index == 5) {
                                    widget.onSubmit();
                                  } else {
                                    _focus(index + 1);
                                  }
                                },
                              ),
                            ),
                          ),
                        ),
                    ],
                  ),
                ),
              ),
            );
          },
        ),
        if (field.errorText != null) ...[
          const SizedBox(height: AppSpacing.sm),
          Semantics(
            liveRegion: true,
            child: Text(
              field.errorText!,
              textAlign: TextAlign.center,
              style: const TextStyle(color: LoginColors.error),
            ),
          ),
        ],
      ],
    ),
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
