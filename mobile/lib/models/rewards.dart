import 'catalog.dart';

BigInt _rewardNumber(dynamic value) {
  if (value is int && value.abs() > 9007199254740991) {
    throw const FormatException();
  }
  if (value is! String && value is! int) throw const FormatException();
  if (!RegExp(r'^-?\d+$').hasMatch('$value')) throw const FormatException();
  return BigInt.parse('$value');
}

String _date(dynamic value) {
  if (value is! String ||
      !RegExp(r'^\d{4}-\d{2}-\d{2}$').hasMatch(value) ||
      DateTime.parse(value).toIso8601String().substring(0, 10) != value) {
    throw const FormatException();
  }
  return value;
}

class RewardDay {
  RewardDay.fromJson(Map<String, dynamic> data)
    : date = _date(data['date']),
      reward = catalogId(data['reward']),
      status = catalogText(data['status']) {
    if (!{'claimed', 'missed', 'today', 'upcoming'}.contains(status)) {
      throw const FormatException();
    }
  }
  final String date, status;
  final int reward;
  bool get claimed => status == 'claimed';
}

class RewardEntry {
  RewardEntry.fromJson(Map<String, dynamic> data)
    : id = catalogId(data['MaDiemThuong']),
      amount = _rewardNumber(data['SoDiem']),
      credit = data['LoaiGiaoDich'] == true,
      reason = catalogText(data['LyDo']),
      timestamp = DateTime.parse(catalogText(data['ThoiGianTichDiem'])) {
    if (data['LoaiGiaoDich'] is! bool || amount.isNegative) {
      throw const FormatException();
    }
  }
  final int id;
  final BigInt amount;
  final bool credit;
  final String reason;
  final DateTime timestamp;
}

class RewardsData {
  RewardsData.fromJson(Map<String, dynamic> data)
    : balance = _rewardNumber(data['balance']),
      weekStart = _date(data['week_start']),
      today = _date(data['today']),
      serverTime = DateTime.parse(catalogText(data['server_time'])),
      nextRefresh = DateTime.parse(catalogText(data['next_refresh_at'])),
      page = catalogId(data['page']),
      pages = data['pages'] is int ? data['pages'] as int : -1,
      entries = _list(data['items'], RewardEntry.fromJson),
      days = _list(data['days'], RewardDay.fromJson) {
    if (data['code'] != 'REWARDS_LISTED' ||
        pages < 0 ||
        days.length != 7 ||
        !nextRefresh.isAfter(serverTime)) {
      throw const FormatException();
    }
    final monday = DateTime.parse('${weekStart}T00:00:00Z');
    if (monday.weekday != DateTime.monday ||
        !days.any((d) => d.date == today)) {
      throw const FormatException();
    }
    for (var i = 0; i < days.length; i++) {
      if (days[i].date !=
          monday.add(Duration(days: i)).toIso8601String().substring(0, 10)) {
        throw const FormatException();
      }
    }
  }
  final BigInt balance;
  final String weekStart, today;
  final DateTime serverTime, nextRefresh;
  final int page, pages;
  final List<RewardEntry> entries;
  final List<RewardDay> days;
  RewardDay get todayDay => days.firstWhere((d) => d.date == today);
  static List<T> _list<T>(
    dynamic values,
    T Function(Map<String, dynamic>) parse,
  ) {
    if (values is! List) throw const FormatException();
    return List.unmodifiable(
      values.map((value) {
        if (value is! Map<String, dynamic>) throw const FormatException();
        return parse(value);
      }),
    );
  }
}

class CheckInResult {
  CheckInResult.fromJson(Map<String, dynamic> data)
    : awarded = _rewardNumber(data['awarded']),
      date = _date(data['date']) {
    if (!{
          'CHECK_IN_RECORDED',
          'CHECK_IN_ALREADY_RECORDED',
        }.contains(data['code']) ||
        awarded.isNegative) {
      throw const FormatException();
    }
  }
  final BigInt awarded;
  final String date;
}
