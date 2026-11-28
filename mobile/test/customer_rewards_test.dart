import 'dart:async';
import 'dart:io';
import 'dart:ui' as ui;

import 'package:flutter/material.dart';
import 'package:flutter/rendering.dart';
import 'package:flutter/services.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:lan_yen_pharmacy/core/network/api.dart';
import 'package:lan_yen_pharmacy/core/theme/app_theme.dart';
import 'package:lan_yen_pharmacy/features/customer/customer_rewards_controller.dart';
import 'package:lan_yen_pharmacy/features/customer/customer_rewards_screen.dart';

import 'auth_test_support.dart';

Map<String, dynamic> rewardsFixture({
  String today = '2026-11-28',
  Set<String> claimed = const {'2026-11-23'},
}) {
  final current = DateTime.parse('${today}T00:00:00Z');
  final monday = current.subtract(Duration(days: current.weekday - 1));
  String date(DateTime value) => value.toIso8601String().substring(0, 10);
  return {
    'code': 'REWARDS_LISTED',
    'balance': '100',
    'page': 1,
    'pages': 1,
    'total': 3,
    'week_start': date(monday),
    'today': today,
    'server_time': '${today}T14:00:00+07:00',
    'next_refresh_at':
        '${date(current.add(const Duration(days: 1)))}T00:00:00+07:00',
    'days': List.generate(7, (i) {
      final day = date(monday.add(Duration(days: i)));
      return {
        'date': day,
        'reward': i == 6 ? 10 : 5,
        'status': claimed.contains(day)
            ? 'claimed'
            : day.compareTo(today) < 0
            ? 'missed'
            : day == today
            ? 'today'
            : 'upcoming',
      };
    }),
    'items': <Map<String, dynamic>>[
      {
        'MaDiemThuong': 3,
        'SoDiem': '5',
        'LoaiGiaoDich': false,
        'LyDo': 'Đổi xu thanh toán đơn hàng #1',
        'ThoiGianTichDiem': '2026-11-26T10:30:00+07:00',
      },
      {
        'MaDiemThuong': 2,
        'SoDiem': '100',
        'LoaiGiaoDich': true,
        'LyDo': 'Tích xu đơn hàng #1',
        'ThoiGianTichDiem': '2026-11-25T12:00:00+07:00',
      },
      {
        'MaDiemThuong': 1,
        'SoDiem': '5',
        'LoaiGiaoDich': true,
        'LyDo': 'Điểm danh hằng ngày',
        'ThoiGianTichDiem': '2026-11-23T08:00:00+07:00',
      },
    ],
  };
}

void main() {
  test(
    'JWT tải xu, phân trang; Thứ 7 nhận 5 xu và bấm trùng không gửi thêm',
    () async {
      final transport = AuthStubTransport()..rewardsData = rewardsFixture();
      final auth = testController(transport);
      addTearDown(auth.dispose);
      await loginFixture(auth);
      final controller = CustomerRewardsController(RewardsApi(auth.api));
      addTearDown(controller.dispose);
      await controller.load();
      expect(controller.data!.balance, BigInt.from(100));
      expect(controller.canClaim, isTrue);
      final hold = Completer<void>();
      transport.hold = hold;
      final first = controller.claim();
      final second = controller.claim();
      expect(controller.claiming, isTrue);
      hold.complete();
      transport.hold = null;
      await Future.wait([first, second]);
      expect(transport.checkInRequests, 1);
      expect(controller.data!.balance, BigInt.from(105));
      expect(controller.data!.todayDay.claimed, isTrue);
      expect(controller.data!.entries.first.reason, 'Điểm danh hằng ngày');
      expect(controller.canClaim, isFalse);
      transport.rewardsData!['pages'] = 2;
      await controller.load(page: 2);
      expect(controller.data!.page, 2);
      final request = transport.requests.last;
      expect(request.uri.queryParameters['page'], '2');
      expect(request.headers['Authorization'], startsWith('Bearer '));
    },
  );

  test(
    'Chủ nhật nhận 10; mất phản hồi đọc đối chiếu, không phát lại POST',
    () async {
      final transport = AuthStubTransport()
        ..rewardsData = rewardsFixture(today: '2026-11-29')
        ..loseCheckInResponse = true;
      final auth = testController(transport);
      addTearDown(auth.dispose);
      await loginFixture(auth);
      final controller = CustomerRewardsController(RewardsApi(auth.api));
      addTearDown(controller.dispose);
      await controller.load();
      await controller.claim();
      expect(transport.checkInRequests, 1);
      expect(controller.data!.balance, BigInt.from(110));
      expect(controller.canClaim, isFalse);
      expect(controller.messageConfirmed, isTrue);
      expect(controller.message, contains('được ghi nhận'));
    },
  );

  test(
    'GET lỗi khóa điểm danh; refresh token chỉ khi từ chối trước xử lý',
    () async {
      final transport = AuthStubTransport()..rewardsData = rewardsFixture();
      final auth = testController(transport);
      addTearDown(auth.dispose);
      await loginFixture(auth);
      final controller = CustomerRewardsController(RewardsApi(auth.api));
      addTearDown(controller.dispose);
      transport.expiredAccess = true;
      await controller.load();
      expect(transport.refreshCount, 1);
      expect(controller.error, isNull);
      transport.rewardsFails = true;
      await controller.load();
      expect(controller.error, isNotNull);
      expect(controller.canClaim, isFalse);
      await controller.claim();
      expect(transport.checkInRequests, 0);
    },
  );

  testWidgets('Qua nửa đêm thứ Hai tự đổi bảng tuần, không xóa lịch sử', (
    tester,
  ) async {
    final fixture = rewardsFixture(
      today: '2026-11-29',
      claimed: {'2026-11-29'},
    );
    fixture['server_time'] = '2026-11-29T23:59:59+07:00';
    final transport = AuthStubTransport()..rewardsData = fixture;
    final auth = testController(transport);
    addTearDown(auth.dispose);
    await loginFixture(auth);
    await tester.pumpWidget(
      MaterialApp(
        theme: AppTheme.light,
        home: CustomerRewardsScreen(api: RewardsApi(auth.api)),
      ),
    );
    await tester.pumpAndSettle();
    expect(
      find.byKey(const ValueKey('check-in-tick-2026-11-29')),
      findsOneWidget,
    );
    transport.rewardsData = rewardsFixture(today: '2026-11-30', claimed: {});
    await tester.pump(const Duration(seconds: 3));
    await tester.pumpAndSettle();
    expect(find.text('Tuần 30/11 – 06/12'), findsOneWidget);
    expect(
      find.byKey(const ValueKey('check-in-tick-2026-11-29')),
      findsNothing,
    );
    expect(
      find.byKey(const ValueKey('check-in-day-2026-11-30')),
      findsOneWidget,
    );
    expect(transport.rewardsData!['items'].length, 3);
  });

  for (final size in [const Size(390, 1000), const Size(320, 800)]) {
    testWidgets(
      'Điểm thưởng $size: đúng thứ tự, màu ngày, dấu tích và nhận xu',
      (tester) async {
        tester.view.devicePixelRatio = 1;
        tester.view.physicalSize = size;
        addTearDown(tester.view.resetPhysicalSize);
        addTearDown(tester.view.resetDevicePixelRatio);
        final transport = AuthStubTransport()..rewardsData = rewardsFixture();
        final auth = testController(transport);
        addTearDown(auth.dispose);
        await loginFixture(auth);
        await tester.pumpWidget(
          MaterialApp(
            theme: AppTheme.light,
            home: MediaQuery(
              data: MediaQueryData(
                textScaler: TextScaler.linear(size.width == 320 ? 2 : 1),
              ),
              child: CustomerRewardsScreen(api: RewardsApi(auth.api)),
            ),
          ),
        );
        await tester.pumpAndSettle();
        expect(find.byKey(const ValueKey('rewards-balance')), findsOneWidget);
        final claimed =
            tester
                    .widget<Container>(
                      find.byKey(const ValueKey('check-in-day-2026-11-23')),
                    )
                    .decoration!
                as BoxDecoration;
        final missed =
            tester
                    .widget<Container>(
                      find.byKey(const ValueKey('check-in-day-2026-11-24')),
                    )
                    .decoration!
                as BoxDecoration;
        expect(claimed.color, isNot(missed.color));
        expect(
          find.byKey(const ValueKey('check-in-tick-2026-11-23')),
          findsOneWidget,
        );
        expect(
          find.byKey(const ValueKey('check-in-tick-2026-11-24')),
          findsNothing,
        );
        final button = find.byKey(const ValueKey('daily-check-in'));
        await Scrollable.ensureVisible(tester.element(button), alignment: .5);
        await tester.pumpAndSettle();
        await tester.tap(button);
        await tester.pumpAndSettle();
        expect(
          find.byKey(const ValueKey('check-in-tick-2026-11-28')),
          findsOneWidget,
        );
        expect(tester.widget<FilledButton>(button).onPressed, isNull);
        await tester.scrollUntilVisible(
          find.byKey(const ValueKey('rewards-balance')),
          -250,
          scrollable: find
              .descendant(
                of: find.byKey(const ValueKey('customer-rewards')),
                matching: find.byType(Scrollable),
              )
              .first,
        );
        await tester.pumpAndSettle();
        expect(
          tester
              .widget<Text>(find.byKey(const ValueKey('rewards-balance')))
              .data,
          '105',
        );
        final history = find.text('Lịch sử xu');
        await tester.scrollUntilVisible(
          history,
          250,
          scrollable: find
              .descendant(
                of: find.byKey(const ValueKey('customer-rewards')),
                matching: find.byType(Scrollable),
              )
              .first,
        );
        await tester.pumpAndSettle();
        expect(find.text('Đổi xu thanh toán đơn hàng #1'), findsOneWidget);
        expect(find.text('+100 xu'), findsOneWidget);
        expect(find.text('−5 xu'), findsOneWidget);
        expect(transport.checkInRequests, 1);
        expect(tester.takeException(), isNull);
      },
    );
  }

  testWidgets('Ảnh trang Điểm thưởng với font thật', (tester) async {
    tester.view.devicePixelRatio = 1;
    tester.view.physicalSize = const Size(390, 1000);
    addTearDown(tester.view.resetPhysicalSize);
    addTearDown(tester.view.resetDevicePixelRatio);
    final font = FontLoader('BeVietnamPro');
    for (final w in [400, 500, 600]) {
      font.addFont(rootBundle.load('assets/fonts/be-vietnam-pro-$w.ttf'));
    }
    await font.load();
    await (FontLoader(
      'MaterialIcons',
    )..addFont(rootBundle.load('fonts/MaterialIcons-Regular.otf'))).load();
    final transport = AuthStubTransport()..rewardsData = rewardsFixture();
    final auth = testController(transport);
    addTearDown(auth.dispose);
    await loginFixture(auth);
    final key = GlobalKey();
    await tester.pumpWidget(
      RepaintBoundary(
        key: key,
        child: MaterialApp(
          debugShowCheckedModeBanner: false,
          theme: AppTheme.light,
          home: CustomerRewardsScreen(api: RewardsApi(auth.api)),
        ),
      ),
    );
    await tester.pumpAndSettle();
    final boundary =
        key.currentContext!.findRenderObject()! as RenderRepaintBoundary;
    await tester.runAsync(() async {
      final image = await boundary.toImage();
      final data = await image.toByteData(format: ui.ImageByteFormat.png);
      final file = File('build/home-preview/rewards.png');
      await file.parent.create(recursive: true);
      await file.writeAsBytes(data!.buffer.asUint8List());
      image.dispose();
    });
    expect(tester.takeException(), isNull);
  });
}
