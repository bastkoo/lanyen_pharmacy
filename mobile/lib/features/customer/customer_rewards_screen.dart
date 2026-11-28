import 'package:flutter/material.dart';

import '../../core/network/api.dart';
import '../../core/theme/app_colors.dart';
import '../../models/rewards.dart';
import 'customer_components.dart';
import 'customer_rewards_controller.dart';

class CustomerRewardsColors {
  CustomerRewardsColors._();
  // Nền toàn trang Điểm thưởng.
  static const background = AppColors.background;
  // Nền Appbar Điểm thưởng.
  static const headerBackground = AppColors.background;
  // Tên trang trên Appbar.
  static const headerTitle = AppColors.textPrimary;
  // Nền thẻ tổng xu hiện có.
  static const balanceBackground = AppColors.primaryDark;
  // Nhãn Xu hiện có trên thẻ tổng xu.
  static const balanceLabel = AppColors.surface;
  // Số xu lớn trên thẻ tổng xu.
  static const balanceAmount = AppColors.surface;
  // Nền khối bảng điểm danh tuần.
  static const checkInBackground = AppColors.surface;
  // Chữ Điểm danh mỗi ngày.
  static const checkInTitle = AppColors.textPrimary;
  // Khoảng ngày của tuần và giải thích quy tắc.
  static const checkInDescription = AppColors.textSecondary;
  // Nền ô ngày đã điểm danh.
  static const claimedBackground = AppColors.primaryLight;
  // Viền ô ngày đã điểm danh.
  static const claimedBorder = AppColors.primary;
  // Dấu tích và chữ ô đã điểm danh.
  static const claimedText = AppColors.primaryDark;
  // Nền ô ngày đã qua nhưng chưa điểm danh.
  static const missedBackground = AppColors.background;
  // Viền ô ngày đã qua nhưng chưa nhận.
  static const missedBorder = AppColors.border;
  // Chữ và dấu trừ trong ngày đã qua.
  static const missedText = AppColors.textSecondary;
  // Nền ô hôm nay chưa nhận xu.
  static const todayBackground = AppColors.warningBackground;
  // Viền nhấn ô hôm nay.
  static const todayBorder = AppColors.primaryDark;
  // Chữ hôm nay và số xu được nhận hôm nay.
  static const todayText = AppColors.primaryDark;
  // Nền các ngày sắp tới.
  static const futureBackground = AppColors.surface;
  // Viền các ngày sắp tới.
  static const futureBorder = AppColors.border;
  // Chữ các ngày sắp tới.
  static const futureText = AppColors.textSecondary;
  // Nền nút Điểm danh.
  static const claimBackground = AppColors.primaryDark;
  // Chữ trên nút Điểm danh.
  static const claimText = AppColors.surface;
  // Chữ thông báo kết quả nhận xu.
  static const claimMessage = AppColors.primaryDark;
  // Chữ thông báo chưa xác nhận được kết quả điểm danh.
  static const claimError = AppColors.error;
  // Tiêu đề Lịch sử xu.
  static const historyTitle = AppColors.textPrimary;
  // Nền danh sách lịch sử xu.
  static const historyBackground = AppColors.surface;
  // Lý do cộng/trừ xu trong lịch sử.
  static const historyReason = AppColors.textPrimary;
  // Ngày giờ phát sinh giao dịch xu.
  static const historyTime = AppColors.textSecondary;
  // Số xu được cộng và icon cộng.
  static const historyCredit = AppColors.primaryDark;
  // Số xu bị trừ và icon trừ.
  static const historyDebit = Color.fromARGB(255, 211, 57, 57);
  // Viền giữa các giao dịch xu.
  static const historyDivider = AppColors.border;
  // Nền vàng của đồng xu, giống Website.
  static const coinBackground = Color(0xFFFFC107);
  // Hai viền và ký hiệu ₫ của đồng xu, giống Website.
  static const coinEdge = Color(0xFF9B6800);
  // Vòng tải lại số dư/tuần/lịch sử.
  static const refresh = AppColors.primaryDark;
}

// Trang Điểm thưởng: xu hiện có, điểm danh tuần rồi đến lịch sử xu.
class CustomerRewardsScreen extends StatefulWidget {
  const CustomerRewardsScreen({super.key, required this.api});
  final RewardsApi api;
  @override
  State<CustomerRewardsScreen> createState() => _CustomerRewardsScreenState();
}

// Tải lại khi trở về ứng dụng; controller tự cập nhật qua ngày mới theo giờ Backend.
class _CustomerRewardsScreenState extends State<CustomerRewardsScreen>
    with WidgetsBindingObserver {
  late final CustomerRewardsController controller;
  @override
  void initState() {
    super.initState();
    WidgetsBinding.instance.addObserver(this);
    controller = CustomerRewardsController(widget.api)..load();
  }

  @override
  void didChangeAppLifecycleState(AppLifecycleState state) {
    if (state == AppLifecycleState.resumed) controller.load();
  }

  @override
  void dispose() {
    WidgetsBinding.instance.removeObserver(this);
    controller.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) => ListenableBuilder(
    listenable: controller,
    builder: (context, _) => Scaffold(
      backgroundColor: CustomerRewardsColors.background,
      appBar: AppBar(
        backgroundColor: CustomerRewardsColors.headerBackground,
        title: const Text(
          'Điểm thưởng',
          style: TextStyle(color: CustomerRewardsColors.headerTitle),
        ),
      ),
      body: RefreshIndicator(
        color: CustomerRewardsColors.refresh,
        onRefresh: () => controller.load(),
        child: ListView(
          key: const ValueKey('customer-rewards'),
          padding: const EdgeInsets.fromLTRB(16, 8, 16, 24),
          physics: const AlwaysScrollableScrollPhysics(),
          children: [
            if (controller.data == null && controller.loading)
              const CustomerStatus(loading: true),
            if (controller.error != null)
              CustomerStatus(
                message: controller.error!,
                onRetry: () => controller.load(),
              ),
            if (controller.data case final data?) ...[
              _RewardsBalance(data: data),
              const SizedBox(height: 16),
              _WeeklyCheckIn(data: data, controller: controller),
              const SizedBox(height: 24),
              _RewardsHistory(data: data, controller: controller),
            ],
          ],
        ),
      ),
    ),
  );
}

// Thẻ số dư xu thật từ Backend, không cộng trước trên giao diện.
class _RewardsBalance extends StatelessWidget {
  const _RewardsBalance({required this.data});
  final RewardsData data;
  @override
  Widget build(BuildContext context) => Container(
    padding: const EdgeInsets.all(20),
    decoration: BoxDecoration(
      color: CustomerRewardsColors.balanceBackground,
      borderRadius: BorderRadius.circular(20),
    ),
    child: Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        const Text(
          'Xu hiện có',
          style: TextStyle(
            color: CustomerRewardsColors.balanceLabel,
            fontSize: 14,
          ),
        ),
        const SizedBox(height: 12),
        Row(
          children: [
            const _RewardCoin(size: 36),
            const SizedBox(width: 12),
            Expanded(
              child: Text(
                _coins(data.balance),
                key: const ValueKey('rewards-balance'),
                style: const TextStyle(
                  color: CustomerRewardsColors.balanceAmount,
                  fontSize: 32,
                  fontWeight: FontWeight.w600,
                ),
              ),
            ),
          ],
        ),
      ],
    ),
  );
}

// Bảng tuần bắt đầu thứ Hai; các trạng thái và số xu đều do Backend xác định.
class _WeeklyCheckIn extends StatelessWidget {
  const _WeeklyCheckIn({required this.data, required this.controller});
  final RewardsData data;
  final CustomerRewardsController controller;
  @override
  Widget build(BuildContext context) => Container(
    padding: const EdgeInsets.all(16),
    decoration: BoxDecoration(
      color: CustomerRewardsColors.checkInBackground,
      borderRadius: BorderRadius.circular(18),
    ),
    child: Column(
      crossAxisAlignment: CrossAxisAlignment.stretch,
      children: [
        const Text(
          'Điểm danh mỗi ngày',
          style: TextStyle(
            color: CustomerRewardsColors.checkInTitle,
            fontWeight: FontWeight.w600,
            fontSize: 18,
          ),
        ),
        const SizedBox(height: 6),
        Text(
          'Tuần ${_day(data.weekStart)} – ${_day(data.days.last.date)}',
          key: const ValueKey('check-in-week'),
          style: const TextStyle(
            color: CustomerRewardsColors.checkInDescription,
            fontSize: 12,
          ),
        ),

        const SizedBox(height: 16),
        LayoutBuilder(
          builder: (context, constraints) {
            final columns =
                constraints.maxWidth < 294 ||
                    MediaQuery.textScalerOf(context).scale(12) > 18
                ? 4
                : 7;
            return Column(
              children: [
                for (var start = 0; start < 7; start += columns)
                  Padding(
                    padding: const EdgeInsets.only(bottom: 8),
                    child: IntrinsicHeight(
                      child: Row(
                        crossAxisAlignment: CrossAxisAlignment.stretch,
                        children: [
                          for (var slot = 0; slot < columns; slot++) ...[
                            if (slot > 0) const SizedBox(width: 5),
                            Expanded(
                              child: start + slot < 7
                                  ? _CheckInDay(
                                      day: data.days[start + slot],
                                      index: start + slot,
                                    )
                                  : const SizedBox(),
                            ),
                          ],
                        ],
                      ),
                    ),
                  ),
              ],
            );
          },
        ),
        const SizedBox(height: 8),
        FilledButton(
          key: const ValueKey('daily-check-in'),
          onPressed: controller.canClaim ? controller.claim : null,
          style: FilledButton.styleFrom(
            backgroundColor: CustomerRewardsColors.claimBackground,
            foregroundColor: CustomerRewardsColors.claimText,
            minimumSize: const Size(0, 48),
            shape: const StadiumBorder(),
          ),
          child: Text(
            controller.claiming
                ? 'Đang ghi nhận…'
                : data.todayDay.claimed
                ? 'Đã điểm danh hôm nay'
                : 'Điểm danh nhận ${data.todayDay.reward} xu',
            textAlign: TextAlign.center,
          ),
        ),
        if (controller.message != null)
          Padding(
            padding: const EdgeInsets.only(top: 10),
            child: Semantics(
              liveRegion: true,
              child: Text(
                controller.message!,
                style: TextStyle(
                  color: controller.messageConfirmed
                      ? CustomerRewardsColors.claimMessage
                      : CustomerRewardsColors.claimError,
                  fontSize: 13,
                ),
              ),
            ),
          ),
        const SizedBox(height: 10),
        const Text(
          'Nhận xu một lần mỗi ngày. Bảng tuần làm mới vào thứ Hai, theo giờ Việt Nam.',
          style: TextStyle(
            color: CustomerRewardsColors.checkInDescription,
            fontSize: 11,
            height: 1.5,
          ),
        ),
      ],
    ),
  );
}

// Một ô ngày: nền riêng cho đã nhận, đã qua, hôm nay và sắp tới; có nhãn và dấu tích.
class _CheckInDay extends StatelessWidget {
  const _CheckInDay({required this.day, required this.index});
  final RewardDay day;
  final int index;
  @override
  Widget build(BuildContext context) {
    final (background, border, text, caption) = switch (day.status) {
      'claimed' => (
        CustomerRewardsColors.claimedBackground,
        CustomerRewardsColors.claimedBorder,
        CustomerRewardsColors.claimedText,
        'Đã nhận',
      ),
      'missed' => (
        CustomerRewardsColors.missedBackground,
        CustomerRewardsColors.missedBorder,
        CustomerRewardsColors.missedText,
        'Chưa nhận',
      ),
      'today' => (
        CustomerRewardsColors.todayBackground,
        CustomerRewardsColors.todayBorder,
        CustomerRewardsColors.todayText,
        'Hôm nay',
      ),
      _ => (
        CustomerRewardsColors.futureBackground,
        CustomerRewardsColors.futureBorder,
        CustomerRewardsColors.futureText,
        'Sắp tới',
      ),
    };
    return Semantics(
      label:
          '${index == 6 ? 'Chủ nhật' : 'Thứ ${index + 2}'}, ngày ${_day(day.date)}, ${day.reward} xu, $caption',
      excludeSemantics: true,
      child: Container(
        key: ValueKey('check-in-day-${day.date}'),
        padding: const EdgeInsets.symmetric(horizontal: 3, vertical: 10),
        decoration: BoxDecoration(
          color: background,
          border: Border.all(color: border),
          borderRadius: BorderRadius.circular(12),
        ),
        child: Column(
          mainAxisSize: MainAxisSize.min,
          children: [
            Text(
              index == 6 ? 'CN' : 'T${index + 2}',
              style: TextStyle(
                color: text,
                fontSize: 11,
                fontWeight: FontWeight.w600,
              ),
            ),
            const SizedBox(height: 2),
            Text(
              day.date.substring(8),
              style: TextStyle(color: text, fontSize: 10),
            ),
            const SizedBox(height: 8),
            if (day.claimed)
              Icon(
                Icons.check_circle,
                key: ValueKey('check-in-tick-${day.date}'),
                color: text,
                size: 20,
              )
            else if (day.status == 'missed')
              Icon(Icons.remove_circle_outline, color: text, size: 20)
            else
              const _RewardCoin(size: 20),
            const SizedBox(height: 6),
            Text(
              '${day.reward} xu',
              textAlign: TextAlign.center,
              style: TextStyle(
                color: text,
                fontSize: 11,
                fontWeight: FontWeight.w600,
              ),
            ),
            const SizedBox(height: 4),
            Text(
              caption,
              textAlign: TextAlign.center,
              style: TextStyle(color: text, fontSize: 9),
            ),
          ],
        ),
      ),
    );
  }
}

// Lịch sử cộng/trừ xu theo tài khoản, giữ phân trang và thời gian Việt Nam.
class _RewardsHistory extends StatelessWidget {
  const _RewardsHistory({required this.data, required this.controller});
  final RewardsData data;
  final CustomerRewardsController controller;
  @override
  Widget build(BuildContext context) => Column(
    crossAxisAlignment: CrossAxisAlignment.stretch,
    children: [
      const Text(
        'Lịch sử xu',
        style: TextStyle(
          color: CustomerRewardsColors.historyTitle,
          fontWeight: FontWeight.w600,
          fontSize: 18,
        ),
      ),
      const SizedBox(height: 12),
      if (data.entries.isEmpty)
        const Text(
          'Chưa có giao dịch xu.',
          style: TextStyle(color: CustomerRewardsColors.historyTime),
        )
      else
        Container(
          padding: const EdgeInsets.symmetric(horizontal: 16),
          decoration: BoxDecoration(
            color: CustomerRewardsColors.historyBackground,
            borderRadius: BorderRadius.circular(16),
          ),
          child: Column(
            children: [
              for (var i = 0; i < data.entries.length; i++) ...[
                _RewardHistoryRow(entry: data.entries[i]),
                if (i < data.entries.length - 1)
                  const Divider(
                    height: 1,
                    color: CustomerRewardsColors.historyDivider,
                  ),
              ],
            ],
          ),
        ),
      if (data.pages > 1)
        Padding(
          padding: const EdgeInsets.only(top: 12),
          child: CustomerPagination(
            page: data.page,
            pages: data.pages,
            onPage: controller.loading || controller.claiming
                ? (_) {}
                : (page) => controller.load(page: page),
          ),
        ),
    ],
  );
}

// Một giao dịch xu có lý do, ngày giờ và dấu cộng/trừ rõ ràng.
class _RewardHistoryRow extends StatelessWidget {
  const _RewardHistoryRow({required this.entry});
  final RewardEntry entry;
  @override
  Widget build(BuildContext context) {
    final vn = entry.timestamp.toUtc().add(const Duration(hours: 7));
    final time =
        '${vn.day.toString().padLeft(2, '0')}/${vn.month.toString().padLeft(2, '0')}/${vn.year} ${vn.hour.toString().padLeft(2, '0')}:${vn.minute.toString().padLeft(2, '0')}';
    final delta = Text(
      '${entry.credit ? '+' : '−'}${_coins(entry.amount)} xu',
      style: TextStyle(
        color: entry.credit
            ? CustomerRewardsColors.historyCredit
            : CustomerRewardsColors.historyDebit,
        fontWeight: FontWeight.w600,
      ),
    );
    final detail = Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Text(
          entry.reason,
          style: const TextStyle(
            color: CustomerRewardsColors.historyReason,
            fontSize: 13,
            height: 1.5,
          ),
        ),
        const SizedBox(height: 4),
        Text(
          time,
          style: const TextStyle(
            color: CustomerRewardsColors.historyTime,
            fontSize: 11,
          ),
        ),
      ],
    );
    return Padding(
      padding: const EdgeInsets.symmetric(vertical: 14),
      child: LayoutBuilder(
        builder: (context, constraints) {
          if (constraints.maxWidth < 280 ||
              MediaQuery.textScalerOf(context).scale(14) > 21) {
            return Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [detail, const SizedBox(height: 6), delta],
            );
          }
          return Row(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Expanded(child: detail),
              const SizedBox(width: 12),
              delta,
            ],
          );
        },
      ),
    );
  }
}

// Đồng xu cùng hình thức Website: nền vàng, hai vòng viền nâu và ký hiệu ₫.
class _RewardCoin extends StatelessWidget {
  const _RewardCoin({required this.size});
  final double size;
  @override
  Widget build(BuildContext context) => Semantics(
    label: 'Xu',
    image: true,
    child: Container(
      width: size,
      height: size,
      padding: EdgeInsets.all(size * .08),
      decoration: BoxDecoration(
        shape: BoxShape.circle,
        color: CustomerRewardsColors.coinBackground,
        border: Border.all(
          color: CustomerRewardsColors.coinEdge,
          width: size * .06,
        ),
      ),
      child: Container(
        alignment: Alignment.center,
        decoration: BoxDecoration(
          shape: BoxShape.circle,
          border: Border.all(
            color: CustomerRewardsColors.coinEdge,
            width: size * .035,
          ),
        ),
        child: Text(
          '₫',
          textScaler: TextScaler.noScaling,
          style: TextStyle(
            color: CustomerRewardsColors.coinEdge,
            fontSize: size * .62,
            fontWeight: FontWeight.w700,
            height: 1,
          ),
        ),
      ),
    ),
  );
}

String _day(String value) => '${value.substring(8)}/${value.substring(5, 7)}';
String _coins(BigInt value) => value.toString().replaceAllMapped(
  RegExp(r'(\d)(?=(\d{3})+(?!\d))'),
  (m) => '${m[1]}.',
);
