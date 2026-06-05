/**
 * activity-card 组件
 *
 * Props:
 *   activity: Activity   （后端契约的 Activity 实体）
 *
 * Events:
 *   tap       - 点击卡片
 *   signup    - 点击报名按钮（已结束 / 已满员时不触发）
 *
 * 渲染所需字段（来自后端契约）：
 *   type, title, startTime, endTime, locationName, currentCount,
 *   maxParticipants, status, coverUrl, isJoined
 */

import { activityTimeRange, relativeTime } from '../../utils/date';
import {
  ACTIVITY_TYPE_LABEL,
  type Activity,
  type ActivityType,
} from '../../types/activity';

Component({
  properties: {
    activity: {
      type: Object,
      value: {} as Activity,
    },
  },

  data: {
    typeLabel: '',
    timeText: '',
    progress: 0,
    /** 用于 WXML 中控制"已满 / 报名"按钮的显示 */
    isFull: false,
    isEnded: false,
  },

  observers: {
    'activity': function (activity: Activity) {
      if (!activity || !activity.id) return;
      const type = activity.type as ActivityType;
      const isFull = activity.status === 'FULL' || activity.currentCount >= activity.maxParticipants;
      const isEnded = activity.status === 'ENDED' || activity.status === 'CANCELED';
      this.setData({
        typeLabel: ACTIVITY_TYPE_LABEL[type] || '其他',
        timeText: activityTimeRange(activity.startTime, activity.endTime) || relativeTime(activity.startTime),
        progress:
          activity.maxParticipants > 0
            ? Math.min(100, Math.round((activity.currentCount / activity.maxParticipants) * 100))
            : 0,
        isFull,
        isEnded,
      });
    },
  },

  methods: {
    onTap() {
      this.triggerEvent('tap', { activity: this.data.activity });
    },
    onSignup() {
      // 已满 / 已结束的卡片不让触发报名事件，由上层 disable 即可；
      // 这里再兜一次防止冒泡穿透。
      if (this.data.isFull || this.data.isEnded) return;
      this.triggerEvent('signup', { activity: this.data.activity });
    },
  },
});
