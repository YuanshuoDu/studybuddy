/**
 * 活动详情页（tab bar 上的“活动”入口用，仍然是 mock）
 *
 * NOTE: 真实的活动详情接入在 pages/activities/detail（issue #22），
 *       本页保留是为了不破坏 tabBar 配置；后续 issue #35 / #33 上线后
 *       即可考虑下线 / 合并。
 */

import { activityTimeRange, formatDateTime } from '../../utils/date';
import { ApiError } from '../../utils/error';
import { ACTIVITY_STATUS_LABEL, ACTIVITY_TYPE_LABEL } from '../../types/activity';
import type { Activity, ActivityStatus, ActivityType } from '../../types/activity';

interface ActivityData {
  id: string | null;
  loading: boolean;
  submitting: boolean;
  activity: Activity | null;
  timeRange: string;
  deadlineText: string;
  typeLabel: string;
  statusLabel: string;
}

interface ActivityCustom {
  _load: (id: string) => Promise<void>;
  _mockDetail: (id: string) => Promise<Activity>;
  onSignup: () => Promise<void>;
}

Page<ActivityData, ActivityCustom>({
  data: {
    id: null,
    loading: true,
    submitting: false,
    activity: null,
    timeRange: '',
    deadlineText: '',
    typeLabel: '',
    statusLabel: '',
  },

  onLoad(options) {
    const id = options?.id || null;
    this.setData({ id });
    if (id) this._load(id);
  },

  async _load(id: string) {
    this.setData({ loading: true });
    try {
      // 真实场景：const activity = await activityApi.getActivity(id);
      // mock：复用首页数据
      const activity = await this._mockDetail(id);
      const type = activity.type as ActivityType;
      const status = activity.status as ActivityStatus;
      this.setData({
        activity,
        timeRange: activityTimeRange(activity.startTime, activity.endTime),
        deadlineText: formatDateTime(activity.startTime),
        typeLabel: ACTIVITY_TYPE_LABEL[type] ?? '其他',
        statusLabel: ACTIVITY_STATUS_LABEL[status] ?? '',
        loading: false,
      });
    } catch (err) {
      const msg = err instanceof ApiError ? err.userMessage : '加载失败';
      wx.showToast({ title: msg, icon: 'none' });
      this.setData({ loading: false });
    }
  },

  async _mockDetail(id: string): Promise<Activity> {
    await new Promise((r) => setTimeout(r, 200));
    return {
      id,
      type: 'STUDY',
      title: '图书馆期末复习搭子',
      description:
        '本周三、周五下午图书馆二楼，想找 2-3 个同学一起复习高数，重点刷课后习题。\n\n我们打算：\n1. 13:30 准时到，找好位置\n2. 14:00-15:30 刷题 90 分钟\n3. 15:30-16:00 休息讨论\n4. 16:00-17:30 继续刷题\n5. 17:30 复盘，错题分享',
      coverUrl: null,
      locationName: '图书馆二楼自习区',
      locationAddr: '校园主楼北侧',
      locationLat: 39.9842,
      locationLng: 116.3074,
      startTime: '2026-06-10T13:30:00.000Z',
      endTime: '2026-06-10T17:30:00.000Z',
      maxParticipants: 4,
      currentCount: 2,
      tags: ['高数', '复习', '安静', '坐得住'],
      status: 'RECRUITING',
      creatorId: 'u-101',
      isJoined: false,
      createdAt: '2026-06-05T08:00:00.000Z',
      updatedAt: '2026-06-05T08:00:00.000Z',
    };
  },

  async onSignup() {
    if (!this.data.activity) return;
    if (this.data.submitting) return;
    this.setData({ submitting: true });
    try {
      // await activityApi.signup(this.data.activity.id);
      await new Promise((r) => setTimeout(r, 400));
      this.setData({
        'activity.isJoined': true,
        'activity.currentCount': this.data.activity.currentCount + 1,
      });
      wx.showToast({ title: '报名成功', icon: 'success' });
    } catch (err) {
      const msg = err instanceof ApiError ? err.userMessage : '报名失败';
      wx.showToast({ title: msg, icon: 'none' });
    } finally {
      this.setData({ submitting: false });
    }
  },
});
