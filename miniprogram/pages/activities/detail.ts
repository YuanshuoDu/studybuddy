/**
 * 活动详情页（issue #22）
 *
 * - 入口：?id=<activityId>
 * - 调用 GET /api/v1/activities/:id 拉取详情
 * - 报名 / 取消报名：POST/DELETE /api/v1/activities/:id/signup
 * - 当前用户 = creator 时显示“编辑 / 取消活动”入口（仅占位，真正表单
 *   接入由 issue #33 跟进；此处只完成查看）
 *
 * 鉴权策略：
 * - 详情接口：匿名也能看（token 不存在时 withToken=false 走 request 拦截器）
 * - 报名 / 取消报名：必须有 token，否则引导跳登录页
 * - token 来自 userStore（与 auth 流程统一），request 拦截器自动注入
 *
 * 地图占位：详见 wxml 中的 TODO，issue #35 跟进。
 */

import { activityApi } from '../../api/activity';
import { ApiError } from '../../utils/error';
import { logger } from '../../utils/logger';
import { userStore, isLoggedIn } from '../../store/user';
import { activityTimeRange, formatDateTime } from '../../utils/date';
import { readString } from '../../utils/query';
import {
  ACTIVITY_STATUS_LABEL,
  ACTIVITY_TYPE_LABEL,
  type Activity,
  type ActivityStatus,
  type ActivityType,
} from '../../types/activity';
import type { User } from '../../types/user';

interface DetailData {
  id: string;
  loading: boolean;
  submitting: boolean;
  activity: Activity | null;
  /** 直接渲染的派生文本 */
  timeRange: string;
  startText: string;
  endText: string;
  typeLabel: string;
  statusLabel: string;
  /** 是否已登录 */
  loggedIn: boolean;
  /** 是否为活动创建者（控制 footer 是"报名"还是"编辑"） */
  isCreator: boolean;
  /** 当前用户 id（来自 userStore） */
  currentUserId: string;
  /** 报名按钮文案 */
  signupButtonText: string;
  signupButtonDisabled: boolean;
}

interface DetailCustom {
  _load: () => Promise<void>;
  _isActionable: () => boolean;
  onSignup: () => Promise<void>;
  onEdit: () => void;
  onCancelActivity: () => Promise<void>;
  onLogin: () => void;
  onShareAppMessage: () => WechatMiniprogram.Page.ICustomShareContent;
}

Page<DetailData, DetailCustom>({
  data: {
    id: '',
    loading: true,
    submitting: false,
    activity: null,
    timeRange: '',
    startText: '',
    endText: '',
    typeLabel: '',
    statusLabel: '',
    loggedIn: false,
    isCreator: false,
    currentUserId: '',
    signupButtonText: '立即报名',
    signupButtonDisabled: false,
  },

  onLoad(options) {
    const id = readString(options, 'id', '');
    if (!id) {
      wx.showToast({ title: '缺少活动 id', icon: 'none' });
      this.setData({ loading: false });
      return;
    }
    this.setData({ id });
    this._load();
  },

  onShow() {
    // 登录态可能变化（如从登录页跳回），刷新按钮态
    const u: User | null = userStore.state.user;
    const loggedIn = isLoggedIn();
    const creatorId = this.data.activity?.creatorId || '';
    const isCreator = !!u && !!creatorId && u.id === creatorId;
    this.setData({
      loggedIn,
      currentUserId: u?.id || '',
      isCreator,
    });
  },

  async _load() {
    if (!this.data.id) return;
    this.setData({ loading: true });
    try {
      const activity = await activityApi.getActivity(this.data.id);
      const type = activity.type as ActivityType;
      const status = activity.status as ActivityStatus;

      const u: User | null = userStore.state.user;
      const loggedIn = isLoggedIn();
      const isCreator = !!u && u.id === activity.creatorId;

      this.setData({
        activity,
        timeRange: activityTimeRange(activity.startTime, activity.endTime),
        startText: formatDateTime(activity.startTime),
        endText: formatDateTime(activity.endTime),
        typeLabel: ACTIVITY_TYPE_LABEL[type] ?? '其他',
        statusLabel: ACTIVITY_STATUS_LABEL[status] ?? '',
        loggedIn,
        currentUserId: u?.id || '',
        isCreator,
        loading: false,
        signupButtonText: this._signupButtonText(activity, isCreator, loggedIn),
        signupButtonDisabled: this._signupButtonDisabled(activity, isCreator, loggedIn),
      });
    } catch (err) {
      const msg = err instanceof ApiError ? err.userMessage : '加载失败';
      logger.warn('[activities/detail] load failed', msg);
      wx.showToast({ title: msg, icon: 'none' });
      this.setData({ loading: false });
    }
  },

  _isActionable(): boolean {
    if (!this.data.activity) return false;
    if (this.data.activity.status !== 'RECRUITING') return false;
    if (this.data.isCreator) return false;
    if (this.data.activity.isJoined) return false;
    return true;
  },

  _signupButtonText(activity: Activity, isCreator: boolean, loggedIn: boolean): string {
    if (isCreator) return '你是创建者';
    if (activity.isJoined) return '已报名';
    if (activity.status === 'FULL') return '已满员';
    if (activity.status === 'CANCELED') return '已取消';
    if (activity.status === 'ENDED') return '已结束';
    if (activity.status === 'STARTED') return '进行中';
    if (!loggedIn) return '登录后报名';
    return '立即报名';
  },

  _signupButtonDisabled(activity: Activity, isCreator: boolean, loggedIn: boolean): boolean {
    if (isCreator) return true;
    if (activity.isJoined) return true;
    if (activity.status !== 'RECRUITING') return true;
    // 未登录时点击跳登录，不视为 disabled
    if (!loggedIn) return false;
    return false;
  },

  async onSignup() {
    const activity = this.data.activity;
    if (!activity) return;
    if (this.data.submitting) return;

    // 未登录 → 跳登录页
    if (!this.data.loggedIn) {
      this.onLogin();
      return;
    }
    // 非创建者 + 未报名 → 报名
    // 已报名 → 取消报名
    if (activity.isJoined) {
      await this._doCancelSignup();
    } else {
      await this._doSignup();
    }
  },

  async _doSignup() {
    const activity = this.data.activity;
    if (!activity) return;
    this.setData({ submitting: true });
    try {
      const res = await activityApi.signup(activity.id);
      const newActivity: Activity = {
        ...activity,
        currentCount: res.newCount,
        status: res.isFull ? 'FULL' : activity.status,
        isJoined: true,
      };
      this.setData({
        activity: newActivity,
        submitting: false,
        signupButtonText: this._signupButtonText(newActivity, this.data.isCreator, this.data.loggedIn),
        signupButtonDisabled: this._signupButtonDisabled(newActivity, this.data.isCreator, this.data.loggedIn),
      });
      wx.showToast({ title: '报名成功', icon: 'success' });
    } catch (err) {
      const msg = err instanceof ApiError ? err.userMessage : '报名失败';
      logger.warn('[activities/detail] signup failed', msg);
      wx.showToast({ title: msg, icon: 'none' });
      this.setData({ submitting: false });
    }
  },

  async _doCancelSignup() {
    const activity = this.data.activity;
    if (!activity) return;
    this.setData({ submitting: true });
    try {
      const res = await activityApi.cancelSignup(activity.id);
      const newActivity: Activity = {
        ...activity,
        currentCount: res.newCount,
        status: res.reopened ? 'RECRUITING' : activity.status,
        isJoined: false,
      };
      this.setData({
        activity: newActivity,
        submitting: false,
        signupButtonText: this._signupButtonText(newActivity, this.data.isCreator, this.data.loggedIn),
        signupButtonDisabled: this._signupButtonDisabled(newActivity, this.data.isCreator, this.data.loggedIn),
      });
      wx.showToast({ title: '已取消报名', icon: 'success' });
    } catch (err) {
      const msg = err instanceof ApiError ? err.userMessage : '取消失败';
      logger.warn('[activities/detail] cancelSignup failed', msg);
      wx.showToast({ title: msg, icon: 'none' });
      this.setData({ submitting: false });
    }
  },

  onEdit() {
    if (!this.data.isCreator) return;
    // TODO: 接入 issue #33 活动创建 / 编辑表单；当前为占位。
    wx.showToast({ title: '编辑表单在 issue #33 接入', icon: 'none' });
  },

  async onCancelActivity() {
    if (!this.data.isCreator || !this.data.activity) return;
    const res = await wx.showModal({
      title: '确认取消活动？',
      content: '取消后所有报名者将收到通知，且无法恢复。',
      confirmText: '确认取消',
      confirmColor: '#e94b4b',
    });
    if (!res.confirm) return;
    this.setData({ submitting: true });
    try {
      await activityApi.cancelActivity(this.data.activity.id);
      wx.showToast({ title: '已取消', icon: 'success' });
      // 重新拉取详情更新状态
      await this._load();
    } catch (err) {
      const msg = err instanceof ApiError ? err.userMessage : '取消失败';
      wx.showToast({ title: msg, icon: 'none' });
    } finally {
      this.setData({ submitting: false });
    }
  },

  onLogin() {
    wx.navigateTo({ url: '/pages/login/login' });
  },

  onShareAppMessage(): WechatMiniprogram.Page.ICustomShareContent {
    const a = this.data.activity;
    if (!a) {
      return { title: 'StudyBuddy 活动' };
    }
    return {
      title: a.title,
      path: `/pages/activities/detail?id=${a.id}`,
    };
  },
});
