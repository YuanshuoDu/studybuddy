// Admin HTTP client — operator-only endpoints (issue #32 frontend).
//
// Mirrors the 6 endpoints exposed by the M3 backend admin module
// (server/src/modules/admin/index.ts — PR #62):
//
//   GET    /api/v1/admin/activities?status=&type=&page=&pageSize=
//   POST   /api/v1/admin/activities/:id/approve
//   POST   /api/v1/admin/activities/:id/reject           body: { reason }
//   GET    /api/v1/admin/users?search=&status=&role=&page=&pageSize=
//   PATCH  /api/v1/admin/users/:id/status               body: { status, note? }
//   GET    /api/v1/admin/dashboard/metrics
//
// Auth: the global JWT injection + 401 refresh + error-mapping
// interceptors are wired in `core/network/dio_client.dart`. The
// backend enforces `adminOnly` server-side; this client does NOT
// add any extra auth header. The two extra layers of defense (server
// 403 + client-side `isAdminProvider` short-circuit) keep the UI
// safe even if the user is signed in as a regular USER.
//
// Response envelope: Fastify returns `{ data: ... }` for these
// endpoints and `{ data, page }` for the list endpoints. We unwrap
// both shapes via the local `_unwrapData` helper.
//
// This client is intentionally read-only with respect to the rest of
// the app: it does NOT mutate `authStateProvider` and it does NOT
// write to secure storage. State ownership stays in
// `application/admin_providers.dart`.

import 'package:dio/dio.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../../core/network/dio_client.dart';

// ---------------------------------------------------------------------------
// Models
// ---------------------------------------------------------------------------

/// Admin activity-status filter (mirrors `adminActivityStatusSchema`
/// in the server). `pendingReview` is the default landing state for
/// the operator's review queue.
enum AdminActivityStatus {
  pendingReview('PENDING_REVIEW', '待审核'),
  recruiting('RECRUITING', '招募中'),
  full('FULL', '已满员'),
  started('STARTED', '进行中'),
  ended('ENDED', '已结束'),
  canceled('CANCELED', '已取消'),
  rejected('REJECTED', '已驳回');

  const AdminActivityStatus(this.wire, this.label);
  final String wire;
  final String label;

  static AdminActivityStatus fromWire(String? value) {
    for (final AdminActivityStatus s in AdminActivityStatus.values) {
      if (s.wire == value) return s;
    }
    return AdminActivityStatus.pendingReview;
  }
}

/// Admin activity-type filter (mirrors the optional `type` query
/// param on the server).
enum AdminActivityType {
  study('STUDY', '自习'),
  sports('SPORTS', '运动'),
  boardGame('BOARD_GAME', '桌游'),
  onlineGame('ONLINE_GAME', '开黑'),
  other('OTHER', '其他');

  const AdminActivityType(this.wire, this.label);
  final String wire;
  final String label;

  static AdminActivityType fromWire(String? value) {
    for (final AdminActivityType t in AdminActivityType.values) {
      if (t.wire == value) return t;
    }
    return AdminActivityType.other;
  }
}

/// One row of the admin review queue (GET /admin/activities).
class AdminActivitySummary {
  const AdminActivitySummary({
    required this.id,
    required this.type,
    required this.title,
    required this.description,
    required this.coverUrl,
    required this.locationName,
    required this.locationAddr,
    required this.locationLat,
    required this.locationLng,
    required this.startTime,
    required this.endTime,
    required this.maxParticipants,
    required this.currentCount,
    required this.tags,
    required this.status,
    required this.moderationNote,
    required this.creatorId,
    required this.creatorNickname,
    required this.creatorAvatar,
    required this.creatorSchool,
    required this.createdAt,
  });

  final String id;
  final AdminActivityType type;
  final String title;
  final String description;
  final String? coverUrl;
  final String locationName;
  final String locationAddr;
  final double locationLat;
  final double locationLng;
  final String startTime;
  final String endTime;
  final int maxParticipants;
  final int currentCount;
  final List<String> tags;
  final AdminActivityStatus status;
  final String? moderationNote;
  final String creatorId;
  final String? creatorNickname;
  final String? creatorAvatar;
  final String? creatorSchool;
  final String createdAt;

  factory AdminActivitySummary.fromJson(Map<String, dynamic> json) {
    final dynamic loc = json['location'];
    final Map<String, dynamic> location = loc is Map<String, dynamic>
        ? loc
        : const <String, dynamic>{};
    final dynamic creator = json['creator'];
    final Map<String, dynamic> creatorJson = creator is Map<String, dynamic>
        ? creator
        : const <String, dynamic>{};
    return AdminActivitySummary(
      id: (json['id'] as String?) ?? '',
      type: AdminActivityType.fromWire(json['type'] as String?),
      title: (json['title'] as String?) ?? '',
      description: (json['description'] as String?) ?? '',
      coverUrl: json['coverUrl'] as String?,
      locationName: (location['name'] as String?) ?? '',
      locationAddr: (location['addr'] as String?) ?? '',
      locationLat: (location['lat'] as num?)?.toDouble() ?? 0.0,
      locationLng: (location['lng'] as num?)?.toDouble() ?? 0.0,
      startTime: (json['startTime'] as String?) ?? '',
      endTime: (json['endTime'] as String?) ?? '',
      maxParticipants: (json['maxParticipants'] as num?)?.toInt() ?? 0,
      currentCount: (json['currentCount'] as num?)?.toInt() ?? 0,
      tags: (json['tags'] as List<dynamic>?)?.cast<String>() ?? const <String>[],
      status: AdminActivityStatus.fromWire(json['status'] as String?),
      moderationNote: json['moderationNote'] as String?,
      creatorId: (creatorJson['id'] as String?) ?? '',
      creatorNickname: creatorJson['nickname'] as String?,
      creatorAvatar: creatorJson['avatar'] as String?,
      creatorSchool: creatorJson['school'] as String?,
      createdAt: (json['createdAt'] as String?) ?? '',
    );
  }
}

/// Paginated response envelope used by both list endpoints
/// (admin/activities and admin/users).
class AdminPage<T> {
  const AdminPage({
    required this.data,
    required this.page,
    required this.pageSize,
    required this.total,
    required this.hasMore,
  });

  final List<T> data;
  final int page;
  final int pageSize;
  final int total;
  final bool hasMore;

  factory AdminPage.fromJson(
    Map<String, dynamic> json,
    T Function(Map<String, dynamic>) parseItem,
  ) {
    final List<dynamic> raw = (json['data'] as List<dynamic>?) ?? const <dynamic>[];
    final dynamic pageJson = json['page'];
    final Map<String, dynamic> pageMap = pageJson is Map<String, dynamic>
        ? pageJson
        : const <String, dynamic>{};
    return AdminPage<T>(
      data: raw
          .whereType<Map<String, dynamic>>()
          .map(parseItem)
          .toList(growable: false),
      page: (pageMap['page'] as num?)?.toInt() ?? 1,
      pageSize: (pageMap['pageSize'] as num?)?.toInt() ?? 20,
      total: (pageMap['total'] as num?)?.toInt() ?? 0,
      hasMore: pageMap['hasMore'] as bool? ?? false,
    );
  }
}

/// User lifecycle status (mirrors `UserStatus` enum on the server).
enum AdminUserStatus {
  active('ACTIVE', '正常'),
  banned('BANNED', '已封禁');

  const AdminUserStatus(this.wire, this.label);
  final String wire;
  final String label;

  static AdminUserStatus fromWire(String? value) {
    for (final AdminUserStatus s in AdminUserStatus.values) {
      if (s.wire == value) return s;
    }
    return AdminUserStatus.active;
  }
}

/// User role (mirrors `UserRole` enum on the server — see PR #62).
enum AdminUserRole {
  user('USER', '用户'),
  admin('ADMIN', '管理员');

  const AdminUserRole(this.wire, this.label);
  final String wire;
  final String label;

  static AdminUserRole fromWire(String? value) {
    for (final AdminUserRole r in AdminUserRole.values) {
      if (r.wire == value) return r;
    }
    return AdminUserRole.user;
  }
}

/// One row of GET /api/v1/admin/users.
class AdminUserRow {
  const AdminUserRow({
    required this.id,
    required this.nickname,
    required this.avatar,
    required this.school,
    required this.phone,
    required this.status,
    required this.role,
    required this.createdAt,
    required this.updatedAt,
  });

  final String id;
  final String? nickname;
  final String? avatar;
  final String? school;
  final String? phone;
  final AdminUserStatus status;
  final AdminUserRole role;
  final String createdAt;
  final String updatedAt;

  factory AdminUserRow.fromJson(Map<String, dynamic> json) {
    return AdminUserRow(
      id: (json['id'] as String?) ?? '',
      nickname: json['nickname'] as String?,
      avatar: json['avatar'] as String?,
      school: json['school'] as String?,
      phone: json['phone'] as String?,
      status: AdminUserStatus.fromWire(json['status'] as String?),
      role: AdminUserRole.fromWire(json['role'] as String?),
      createdAt: (json['createdAt'] as String?) ?? '',
      updatedAt: (json['updatedAt'] as String?) ?? '',
    );
  }
}

/// Result of POST /approve and POST /reject.
class AdminActivityDecision {
  const AdminActivityDecision({
    required this.id,
    required this.status,
    required this.moderationNote,
  });

  final String id;
  final AdminActivityStatus status;
  final String? moderationNote;

  factory AdminActivityDecision.fromJson(Map<String, dynamic> json) {
    return AdminActivityDecision(
      id: (json['id'] as String?) ?? '',
      status: AdminActivityStatus.fromWire(json['status'] as String?),
      moderationNote: json['moderationNote'] as String?,
    );
  }
}

/// Result of PATCH /admin/users/:id/status.
class AdminUserStatusUpdate {
  const AdminUserStatusUpdate({
    required this.id,
    required this.status,
    required this.role,
    this.note,
  });

  final String id;
  final AdminUserStatus status;
  final AdminUserRole role;
  final String? note;

  factory AdminUserStatusUpdate.fromJson(Map<String, dynamic> json) {
    return AdminUserStatusUpdate(
      id: (json['id'] as String?) ?? '',
      status: AdminUserStatus.fromWire(json['status'] as String?),
      role: AdminUserRole.fromWire(json['role'] as String?),
      note: (json['note'] as String?) ??
          (json['meta'] is Map<String, dynamic>
              ? (json['meta'] as Map<String, dynamic>)['note'] as String?
              : null),
    );
  }
}

/// Top-level counts returned by GET /admin/dashboard/metrics.
class AdminDashboardMetrics {
  const AdminDashboardMetrics({
    required this.usersTotal,
    required this.usersBanned,
    required this.usersNewToday,
    required this.usersNewThisWeek,
    required this.activitiesTotal,
    required this.activitiesPending,
    required this.activitiesRecruiting,
    required this.signupsTotal,
    required this.signupsToday,
    required this.pushTokensTotal,
    required this.generatedAt,
  });

  final int usersTotal;
  final int usersBanned;
  final int usersNewToday;
  final int usersNewThisWeek;
  final int activitiesTotal;
  final int activitiesPending;
  final int activitiesRecruiting;
  final int signupsTotal;
  final int signupsToday;
  final int pushTokensTotal;
  final String generatedAt;

  factory AdminDashboardMetrics.fromJson(Map<String, dynamic> json) {
    final Map<String, dynamic> users = (json['users'] as Map<String, dynamic>?) ??
        const <String, dynamic>{};
    final Map<String, dynamic> activities =
        (json['activities'] as Map<String, dynamic>?) ??
            const <String, dynamic>{};
    final Map<String, dynamic> signups =
        (json['signups'] as Map<String, dynamic>?) ??
            const <String, dynamic>{};
    final Map<String, dynamic> push = (json['pushTokens'] as Map<String, dynamic>?) ??
        const <String, dynamic>{};
    return AdminDashboardMetrics(
      usersTotal: (users['total'] as num?)?.toInt() ?? 0,
      usersBanned: (users['banned'] as num?)?.toInt() ?? 0,
      usersNewToday: (users['newToday'] as num?)?.toInt() ?? 0,
      usersNewThisWeek: (users['newThisWeek'] as num?)?.toInt() ?? 0,
      activitiesTotal: (activities['total'] as num?)?.toInt() ?? 0,
      activitiesPending: (activities['pending'] as num?)?.toInt() ?? 0,
      activitiesRecruiting: (activities['recruiting'] as num?)?.toInt() ?? 0,
      signupsTotal: (signups['total'] as num?)?.toInt() ?? 0,
      signupsToday: (signups['today'] as num?)?.toInt() ?? 0,
      pushTokensTotal: (push['total'] as num?)?.toInt() ?? 0,
      generatedAt: (json['generatedAt'] as String?) ?? '',
    );
  }
}

// ---------------------------------------------------------------------------
// Query classes
// ---------------------------------------------------------------------------

/// Filter for the review queue (GET /admin/activities).
class AdminActivityListQuery {
  const AdminActivityListQuery({
    this.status = AdminActivityStatus.pendingReview,
    this.type,
    this.page = 1,
    this.pageSize = 20,
  });

  final AdminActivityStatus status;
  final AdminActivityType? type;
  final int page;
  final int pageSize;

  AdminActivityListQuery copyWith({
    AdminActivityStatus? status,
    AdminActivityType? type,
    int? page,
    int? pageSize,
  }) {
    return AdminActivityListQuery(
      status: status ?? this.status,
      type: type ?? this.type,
      page: page ?? this.page,
      pageSize: pageSize ?? this.pageSize,
    );
  }

  Map<String, dynamic> toQueryMap() {
    final Map<String, dynamic> m = <String, dynamic>{
      'status': status.wire,
      'page': page,
      'pageSize': pageSize,
    };
    if (type != null) m['type'] = type!.wire;
    return m;
  }
}

/// Filter for the user search (GET /admin/users).
///
/// Note: the server requires AT LEAST ONE of `search` / `status` /
/// `role` (see `adminListUsersQuerySchema`). We mirror that with a
/// runtime guard in the provider so the UI never has to remember.
class AdminUserListQuery {
  const AdminUserListQuery({
    this.search,
    this.status,
    this.role,
    this.page = 1,
    this.pageSize = 20,
  });

  final String? search;
  final AdminUserStatus? status;
  final AdminUserRole? role;
  final int page;
  final int pageSize;

  bool get isEmpty =>
      (search == null || search!.isEmpty) && status == null && role == null;

  AdminUserListQuery copyWith({
    String? search,
    AdminUserStatus? status,
    AdminUserRole? role,
    int? page,
    int? pageSize,
  }) {
    return AdminUserListQuery(
      search: search ?? this.search,
      status: status ?? this.status,
      role: role ?? this.role,
      page: page ?? this.page,
      pageSize: pageSize ?? this.pageSize,
    );
  }

  Map<String, dynamic> toQueryMap() {
    final Map<String, dynamic> m = <String, dynamic>{
      'page': page,
      'pageSize': pageSize,
    };
    if (search != null && search!.isNotEmpty) m['search'] = search;
    if (status != null) m['status'] = status!.wire;
    if (role != null) m['role'] = role!.wire;
    return m;
  }
}

// ---------------------------------------------------------------------------
// API client
// ---------------------------------------------------------------------------

class AdminApi {
  const AdminApi(this._dio);

  final Dio _dio;

  /// GET /api/v1/admin/activities
  Future<AdminPage<AdminActivitySummary>> listActivities(
    AdminActivityListQuery query,
  ) async {
    final Response<dynamic> res = await _dio.get<dynamic>(
      '/api/v1/admin/activities',
      queryParameters: query.toQueryMap(),
    );
    return _unwrapPage<AdminActivitySummary>(
      res,
      AdminActivitySummary.fromJson,
    );
  }

  /// POST /api/v1/admin/activities/:id/approve
  Future<AdminActivityDecision> approveActivity(String id) async {
    final Response<dynamic> res =
        await _dio.post<dynamic>('/api/v1/admin/activities/$id/approve');
    return _unwrap<AdminActivityDecision>(
      res,
      AdminActivityDecision.fromJson,
    );
  }

  /// POST /api/v1/admin/activities/:id/reject
  Future<AdminActivityDecision> rejectActivity(String id, String reason) async {
    final Response<dynamic> res = await _dio.post<dynamic>(
      '/api/v1/admin/activities/$id/reject',
      data: <String, dynamic>{'reason': reason},
    );
    return _unwrap<AdminActivityDecision>(
      res,
      AdminActivityDecision.fromJson,
    );
  }

  /// GET /api/v1/admin/users
  Future<AdminPage<AdminUserRow>> listUsers(AdminUserListQuery query) async {
    final Response<dynamic> res = await _dio.get<dynamic>(
      '/api/v1/admin/users',
      queryParameters: query.toQueryMap(),
    );
    return _unwrapPage<AdminUserRow>(res, AdminUserRow.fromJson);
  }

  /// PATCH /api/v1/admin/users/:id/status
  Future<AdminUserStatusUpdate> setUserStatus(
    String id, {
    required AdminUserStatus status,
    String? note,
  }) async {
    final Map<String, dynamic> body = <String, dynamic>{'status': status.wire};
    if (note != null && note.isNotEmpty) body['note'] = note;
    final Response<dynamic> res = await _dio.patch<dynamic>(
      '/api/v1/admin/users/$id/status',
      data: body,
    );
    return _unwrap<AdminUserStatusUpdate>(
      res,
      AdminUserStatusUpdate.fromJson,
    );
  }

  /// GET /api/v1/admin/dashboard/metrics
  Future<AdminDashboardMetrics> dashboardMetrics() async {
    final Response<dynamic> res =
        await _dio.get<dynamic>('/api/v1/admin/dashboard/metrics');
    return _unwrap<AdminDashboardMetrics>(
      res,
      AdminDashboardMetrics.fromJson,
    );
  }

  // ---------------------------------------------------------------------------
  // Helpers
  // ---------------------------------------------------------------------------

  T _unwrap<T>(
    Response<dynamic> res,
    T Function(Map<String, dynamic>) parse,
  ) {
    final dynamic body = res.data;
    if (body is Map<String, dynamic> && body.containsKey('data')) {
      final dynamic inner = body['data'];
      if (inner is Map<String, dynamic>) return parse(inner);
      if (inner is List<dynamic>) {
        // Some endpoints return `{ data: [...] }`; treat as empty page.
        return parse(const <String, dynamic>{});
      }
      return parse(const <String, dynamic>{});
    }
    if (body is Map<String, dynamic>) return parse(body);
    return parse(const <String, dynamic>{});
  }

  AdminPage<T> _unwrapPage<T>(
    Response<dynamic> res,
    T Function(Map<String, dynamic>) parseItem,
  ) {
    final dynamic body = res.data;
    final Map<String, dynamic> map = body is Map<String, dynamic>
        ? body
        : const <String, dynamic>{};
    // Server returns `{ data: [...], page: { ... } }`. If we got the
    // page-shaped object already (no `data` envelope), pass through.
    return AdminPage<T>.fromJson(map, parseItem);
  }
}

/// Riverpod entry point. Override in tests with a fake.
final Provider<AdminApi> adminApiProvider = Provider<AdminApi>(
  (Ref ref) => AdminApi(ref.watch(dioProvider)),
);
