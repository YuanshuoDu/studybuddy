/**
 * 首页 - 活动列表
 *
 * - mock 3 条数据（脚手架阶段不调真实后端）
 * - 支持下拉刷新、分类切换、搜索入口、点击进入详情
 *
 * NOTE: 类型 / 字段命名已统一为后端契约（UPPERCASE 枚举 + 扁平 location）。
 *       活动真实数据接入在 pages/activities/list（issue #22）。
 */

import { userStore } from '../../store/user';
import type { Activity, ActivityType } from '../../types/activity';
import { ACTIVITY_TYPE_LABEL } from '../../types/activity';

interface Filter {
  id: ActivityType | 'all';
  label: string;
}

interface IndexData {
  loading: boolean;
  list: Activity[];
  page: number;
  hasMore: boolean;
  activeFilter: Filter['id'];
  filters: Filter[];
  nickname: string;
}

Page<IndexData, Record<string, any>>({
  data: {
    loading: false,
    list: [],
    page: 1,
    hasMore: true,
    activeFilter: 'all',
    filters: [
      { id: 'all', label: '全部' },
      { id: 'STUDY', label: ACTIVITY_TYPE_LABEL.STUDY },
      { id: 'SPORTS', label: ACTIVITY_TYPE_LABEL.SPORTS },
      { id: 'BOARD_GAME', label: ACTIVITY_TYPE_LABEL.BOARD_GAME },
      { id: 'ONLINE_GAME', label: ACTIVITY_TYPE_LABEL.ONLINE_GAME },
      { id: 'OTHER', label: ACTIVITY_TYPE_LABEL.OTHER },
    ],
    nickname: '',
  },

  onLoad() {
    this.setData({ nickname: userStore.state.user?.nickname || '' });
  },

  onShow() {
    // tabbar selected 同步
    if (typeof this.getTabBar === 'function' && this.getTabBar()) {
      this.getTabBar().setData({ selected: 0 });
    }
    this._loadList(true);
  },

  onPullDownRefresh() {
    this._loadList(true).finally(() => wx.stopPullDownRefresh());
  },

  onReachBottom() {
    if (this.data.hasMore && !this.data.loading) {
      this._loadList(false);
    }
  },

  onFilterChange(e: WechatMiniprogram.TouchEvent) {
    const id = e.currentTarget.dataset.id as Filter['id'];
    if (id === this.data.activeFilter) return;
    this.setData({ activeFilter: id });
    this._loadList(true);
  },

  onSearchTap() {
    wx.showToast({ title: '搜索功能开发中', icon: 'none' });
  },

  onCardTap(e: any) {
    const id = e.detail?.activity?.id;
    if (!id) return;
    wx.navigateTo({ url: `/pages/activities/detail?id=${id}` });
  },

  onSignupTap(e: any) {
    const id = e.detail?.activity?.id;
    if (!id) return;
    wx.navigateTo({ url: `/pages/activities/detail?id=${id}` });
  },

  /** mock 列表数据 */
  async _loadList(reset: boolean) {
    if (this.data.loading) return;
    this.setData({ loading: true });

    // 模拟网络延迟
    await new Promise((r) => setTimeout(r, 300));

    const mock: Activity[] = [
      {
        id: 'a-001',
        type: 'STUDY',
        title: '图书馆期末复习搭子',
        description: '本周三、周五下午图书馆二楼，想找 2-3 个同学一起复习高数，重点刷课后习题。',
        coverUrl: null,
        locationName: '图书馆二楼自习区',
        locationAddr: '校园主楼北侧',
        locationLat: 39.9842,
        locationLng: 116.3074,
        startTime: '2026-06-10T13:30:00.000Z',
        endTime: '2026-06-10T17:30:00.000Z',
        maxParticipants: 4,
        currentCount: 2,
        tags: ['高数', '复习', '安静'],
        status: 'RECRUITING',
        creatorId: 'u-101',
        isJoined: false,
        createdAt: '2026-06-05T08:00:00.000Z',
        updatedAt: '2026-06-05T08:00:00.000Z',
      },
      {
        id: 'a-002',
        type: 'SPORTS',
        title: '晨跑搭子·周末',
        description: '周六早上 7 点操场集合，5km 慢跑配速 6\'30"。我跑步新手，目标是半马。',
        coverUrl: null,
        locationName: '学校田径场',
        locationAddr: '体育馆旁',
        locationLat: 39.99,
        locationLng: 116.31,
        startTime: '2026-06-08T07:00:00.000Z',
        endTime: '2026-06-08T08:30:00.000Z',
        maxParticipants: 6,
        currentCount: 4,
        tags: ['晨跑', '5km', '新手友好'],
        status: 'RECRUITING',
        creatorId: 'u-102',
        isJoined: false,
        createdAt: '2026-06-04T20:00:00.000Z',
        updatedAt: '2026-06-04T20:00:00.000Z',
      },
      {
        id: 'a-003',
        type: 'OTHER',
        title: '海底捞拼单·88 折',
        description: '周五晚 6 点海底捞（大学城店），已有 3 人，再拼 1-2 人凑齐 88 折套餐。',
        coverUrl: null,
        locationName: '海底捞大学城店',
        locationAddr: '大学城商业街 2 楼',
        locationLat: 39.97,
        locationLng: 116.32,
        startTime: '2026-06-07T18:00:00.000Z',
        endTime: '2026-06-07T20:00:00.000Z',
        maxParticipants: 6,
        currentCount: 5,
        tags: ['拼单', '88 折', 'AA'],
        status: 'RECRUITING',
        creatorId: 'u-103',
        isJoined: false,
        createdAt: '2026-06-04T12:00:00.000Z',
        updatedAt: '2026-06-05T09:00:00.000Z',
      },
    ];

    // filter
    const filterId = this.data.activeFilter;
    const list = filterId === 'all' ? mock : mock.filter((m) => m.type === filterId);

    this.setData({
      list: reset ? list : [...this.data.list, ...list],
      page: this.data.page + 1,
      hasMore: false,
      loading: false,
    });
  },
});
