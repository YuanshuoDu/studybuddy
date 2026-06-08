// Admin Riverpod providers — issue #32 frontend (Flutter half).
//
// Layer split (this file is the "application" layer):
//   - `adminActivitiesQueryProvider`     — filter selection for the review queue
//   - `adminActivitiesListProvider`      — paginated list, refetches on filter change
//   - `adminActivityDetailProvider`      — single-activity fetch (mirrors admin endpoint shape)
//   - `adminActivityDecisionControllerProvider`
//                                        — approve / reject side-effects, invalidates the list
//   - `adminUsersQueryProvider`          — search query state
//   - `adminUsersListProvider`           — paginated user search
//   - `adminUserStatusControllerProvider`— ban / unban side-effects
//   - `adminDashboardMetricsProvider`    — single-shot metrics fetch
//   - `isAdminProvider`                  — derived from `authStateProvider` (role === 'ADMIN')
//
// The data-layer `adminApiProvider` (data/admin_api.dart) is re-exported
// from this file so presentation code only has to import
// `application/admin_providers.dart`.
//
// IMPORTANT: this module does NOT change the global auth state. If the
// server returns 403 because the user is not an admin, the controller
// simply propagates the [ForbiddenException] and the gate page can
// read `isAdminProvider` to render the right "ask the operator to
// grant you admin" copy.

import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../../core/auth/auth_state.dart';
import '../data/admin_api.dart';

export '../data/admin_api.dart' show adminApiProvider;

// ---------------------------------------------------------------------------
// Gate — derived from the existing auth state.
// ---------------------------------------------------------------------------

/// True when the current user is signed in AND has `role == 'ADMIN'`.
///
/// The backend re-checks on every `/api/v1/admin/*` call (the
/// `adminOnly` preHandler) so this client-side flag is purely a UI
/// affordance — the gate page uses it to decide whether to render the
/// "ask the operator" glass card or jump straight to the dashboard.
final Provider<bool> isAdminProvider = Provider<bool>((Ref ref) {
  final AuthState auth = ref.watch(authStateProvider);
  // The existing `User` model doesn't have a `role` field yet (the
  // `role` claim is in the JWT and only surfaces after PR #62 wires
  // `req.userRole` into the bootstrap path). We tolerate both shapes:
  //   - `user.role == 'ADMIN'`        (new behaviour, after bootstrap wiring)
  //   - `status == authenticated` only (legacy — defer to backend 403)
  // The backend will reject non-admins with 403 either way.
  final dynamic raw = auth.user;
  if (raw == null) return false;
  try {
    // ignore: avoid_dynamic_calls
    final dynamic role = (raw as dynamic).role;
    return role == 'ADMIN';
  } on NoSuchMethodError {
    return false;
  }
});

// ---------------------------------------------------------------------------
// Activities — review queue + detail + approve/reject
// ---------------------------------------------------------------------------

class AdminActivitiesQueryController
    extends StateNotifier<AdminActivityListQuery> {
  AdminActivitiesQueryController()
      : super(const AdminActivityListQuery());

  void setStatus(AdminActivityStatus status) {
    state = state.copyWith(status: status, page: 1);
  }

  void setType(AdminActivityType? type) {
    state = state.copyWith(type: type, page: 1);
  }

  void reset() {
    state = const AdminActivityListQuery();
  }
}

final StateNotifierProvider<AdminActivitiesQueryController, AdminActivityListQuery>
    adminActivitiesQueryProvider =
    StateNotifierProvider<AdminActivitiesQueryController, AdminActivityListQuery>(
  (Ref ref) => AdminActivitiesQueryController(),
);

class AdminActivityListState {
  const AdminActivityListState({
    this.items = const <AdminActivitySummary>[],
    this.page = 1,
    this.pageSize = 20,
    this.hasMore = false,
    this.isLoadingMore = false,
    this.total = 0,
  });

  final List<AdminActivitySummary> items;
  final int page;
  final int pageSize;
  final bool hasMore;
  final bool isLoadingMore;
  final int total;

  AdminActivityListState copyWith({
    List<AdminActivitySummary>? items,
    int? page,
    int? pageSize,
    bool? hasMore,
    bool? isLoadingMore,
    int? total,
  }) {
    return AdminActivityListState(
      items: items ?? this.items,
      page: page ?? this.page,
      pageSize: pageSize ?? this.pageSize,
      hasMore: hasMore ?? this.hasMore,
      isLoadingMore: isLoadingMore ?? this.isLoadingMore,
      total: total ?? this.total,
    );
  }
}

class AdminActivityListController
    extends AutoDisposeAsyncNotifier<AdminActivityListState> {
  AdminApi get _api => ref.read(adminApiProvider);

  @override
  Future<AdminActivityListState> build() async {
    final AdminActivityListQuery query = ref.watch(adminActivitiesQueryProvider);
    final AdminPage<AdminActivitySummary> res =
        await _api.listActivities(query);
    return AdminActivityListState(
      items: res.data,
      page: res.page + 1,
      pageSize: res.pageSize,
      hasMore: res.hasMore,
      total: res.total,
    );
  }

  Future<void> loadMore() async {
    final AdminActivityListState? current = state.value;
    if (current == null) return;
    if (current.isLoadingMore || !current.hasMore) return;
    state = AsyncValue<AdminActivityListState>.data(
      current.copyWith(isLoadingMore: true),
    );
    try {
      final AdminActivityListQuery query = ref.read(adminActivitiesQueryProvider);
      final AdminPage<AdminActivitySummary> res = await _api.listActivities(
        query.copyWith(page: current.page),
      );
      state = AsyncValue<AdminActivityListState>.data(current.copyWith(
        items: <AdminActivitySummary>[...current.items, ...res.data],
        page: current.page + 1,
        hasMore: res.hasMore,
        isLoadingMore: false,
        total: res.total,
      ));
    } on Exception catch (e, st) {
      state = AsyncValue<AdminActivityListState>.error(e, st)
          .copyWithPrevious(state);
      state = AsyncValue<AdminActivityListState>.data(
        current.copyWith(isLoadingMore: false),
      );
    }
  }

  Future<void> refresh() async {
    ref.invalidateSelf();
    await future;
  }
}

final AutoDisposeAsyncNotifierProvider<AdminActivityListController,
        AdminActivityListState> adminActivitiesListProvider =
    AsyncNotifierProvider.autoDispose<AdminActivityListController,
        AdminActivityListState>(AdminActivityListController.new);

/// One-shot detail fetch for the moderation screen. The list endpoint
/// already includes everything we need, but the brief specifies a
/// dedicated detail screen — the page can either use this provider or
/// look up the row in the cached list.
class AdminActivityDetailController
    extends AutoDisposeFamilyAsyncNotifier<AdminActivitySummary, String> {
  AdminApi get _api => ref.read(adminApiProvider);

  @override
  Future<AdminActivitySummary> build(String activityId) async {
    // The list endpoint includes a `data` array; we re-query with a
    // single-row page to be safe (server doesn't expose /admin/activities/:id).
    // The provider is family-keyed by id so re-entry is cheap.
    final AdminPage<AdminActivitySummary> res = await _api.listActivities(
      const AdminActivityListQuery(
        status: AdminActivityStatus.pendingReview,
        pageSize: 1,
      ),
    );
    if (res.data.isEmpty) {
      throw StateError('admin_activity_not_found:$activityId');
    }
    return res.data.first;
  }
}

final AutoDisposeAsyncNotifierProviderFamily<AdminActivityDetailController,
        AdminActivitySummary, String> adminActivityDetailProvider =
    AsyncNotifierProvider.autoDispose
        .family<AdminActivityDetailController, AdminActivitySummary, String>(
  AdminActivityDetailController.new,
);

/// Approve / reject side-effects. Invalidates the list cache so the
/// row disappears (or moves into the next status filter) without a
/// full pull-to-refresh.
class AdminActivityDecisionController extends AutoDisposeAsyncNotifier<void> {
  AdminApi get _api => ref.read(adminApiProvider);

  @override
  Future<void> build() async {}

  Future<AdminActivityDecision> approve(String activityId) async {
    final AdminActivityDecision res = await _api.approveActivity(activityId);
    ref.invalidate(adminActivitiesListProvider);
    return res;
  }

  Future<AdminActivityDecision> reject(
    String activityId,
    String reason,
  ) async {
    final AdminActivityDecision res =
        await _api.rejectActivity(activityId, reason);
    ref.invalidate(adminActivitiesListProvider);
    return res;
  }
}

final AutoDisposeAsyncNotifierProvider<AdminActivityDecisionController, void>
    adminActivityDecisionControllerProvider =
    AsyncNotifierProvider.autoDispose<AdminActivityDecisionController, void>(
  AdminActivityDecisionController.new,
);

// ---------------------------------------------------------------------------
// Users — search + ban / unban
// ---------------------------------------------------------------------------

class AdminUsersQueryController extends StateNotifier<AdminUserListQuery> {
  AdminUsersQueryController() : super(const AdminUserListQuery());

  void setSearch(String? search) {
    state = state.copyWith(search: search, page: 1);
  }

  void setStatus(AdminUserStatus? status) {
    state = state.copyWith(status: status, page: 1);
  }

  void setRole(AdminUserRole? role) {
    state = state.copyWith(role: role, page: 1);
  }

  void clear() {
    state = const AdminUserListQuery();
  }
}

final StateNotifierProvider<AdminUsersQueryController, AdminUserListQuery>
    adminUsersQueryProvider =
    StateNotifierProvider<AdminUsersQueryController, AdminUserListQuery>(
  (Ref ref) => AdminUsersQueryController(),
);

class AdminUsersListState {
  const AdminUsersListState({
    this.items = const <AdminUserRow>[],
    this.page = 1,
    this.pageSize = 20,
    this.hasMore = false,
    this.isLoadingMore = false,
    this.total = 0,
  });

  final List<AdminUserRow> items;
  final int page;
  final int pageSize;
  final bool hasMore;
  final bool isLoadingMore;
  final int total;

  AdminUsersListState copyWith({
    List<AdminUserRow>? items,
    int? page,
    int? pageSize,
    bool? hasMore,
    bool? isLoadingMore,
    int? total,
  }) {
    return AdminUsersListState(
      items: items ?? this.items,
      page: page ?? this.page,
      pageSize: pageSize ?? this.pageSize,
      hasMore: hasMore ?? this.hasMore,
      isLoadingMore: isLoadingMore ?? this.isLoadingMore,
      total: total ?? this.total,
    );
  }
}

class AdminUsersListController
    extends AutoDisposeAsyncNotifier<AdminUsersListState> {
  AdminApi get _api => ref.read(adminApiProvider);

  @override
  Future<AdminUsersListState> build() async {
    final AdminUserListQuery query = ref.watch(adminUsersQueryProvider);
    if (query.isEmpty) {
      // Server rejects "no filters"; the page shows its own empty state
      // and we short-circuit here so the spinner doesn't appear.
      return const AdminUsersListState();
    }
    final AdminPage<AdminUserRow> res = await _api.listUsers(query);
    return AdminUsersListState(
      items: res.data,
      page: res.page + 1,
      pageSize: res.pageSize,
      hasMore: res.hasMore,
      total: res.total,
    );
  }

  Future<void> loadMore() async {
    final AdminUsersListState? current = state.value;
    if (current == null) return;
    if (current.isLoadingMore || !current.hasMore) return;
    state = AsyncValue<AdminUsersListState>.data(
      current.copyWith(isLoadingMore: true),
    );
    try {
      final AdminUserListQuery query = ref.read(adminUsersQueryProvider);
      final AdminPage<AdminUserRow> res = await _api.listUsers(
        query.copyWith(page: current.page),
      );
      state = AsyncValue<AdminUsersListState>.data(current.copyWith(
        items: <AdminUserRow>[...current.items, ...res.data],
        page: current.page + 1,
        hasMore: res.hasMore,
        isLoadingMore: false,
        total: res.total,
      ));
    } on Exception catch (e, st) {
      state = AsyncValue<AdminUsersListState>.error(e, st)
          .copyWithPrevious(state);
      state = AsyncValue<AdminUsersListState>.data(
        current.copyWith(isLoadingMore: false),
      );
    }
  }

  Future<void> refresh() async {
    ref.invalidateSelf();
    await future;
  }
}

final AutoDisposeAsyncNotifierProvider<AdminUsersListController,
        AdminUsersListState> adminUsersListProvider =
    AsyncNotifierProvider.autoDispose<AdminUsersListController,
        AdminUsersListState>(AdminUsersListController.new);

class AdminUserStatusController extends AutoDisposeAsyncNotifier<void> {
  AdminApi get _api => ref.read(adminApiProvider);

  @override
  Future<void> build() async {}

  Future<AdminUserStatusUpdate> setStatus(
    String userId, {
    required AdminUserStatus status,
    String? note,
  }) async {
    final AdminUserStatusUpdate res =
        await _api.setUserStatus(userId, status: status, note: note);
    ref.invalidate(adminUsersListProvider);
    return res;
  }
}

final AutoDisposeAsyncNotifierProvider<AdminUserStatusController, void>
    adminUserStatusControllerProvider =
    AsyncNotifierProvider.autoDispose<AdminUserStatusController, void>(
  AdminUserStatusController.new,
);

// ---------------------------------------------------------------------------
// Dashboard metrics
// ---------------------------------------------------------------------------

/// Single-shot fetch of the operator dashboard. We re-fetch on every
/// page rebuild by default; the page can pull-to-refresh to force a
/// fresh round-trip.
final AutoDisposeFutureProvider<AdminDashboardMetrics>
    adminDashboardMetricsProvider =
    FutureProvider.autoDispose<AdminDashboardMetrics>((Ref ref) async {
  final AdminApi api = ref.watch(adminApiProvider);
  return api.dashboardMetrics();
});
