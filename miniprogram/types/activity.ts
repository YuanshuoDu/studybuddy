/**
 * 活动相关类型
 *
 * 与后端 M2 接口保持一致：
 * - type 枚举: STUDY / SPORTS / BOARD_GAME / ONLINE_GAME / OTHER
 * - status 枚举: RECRUITING / FULL / STARTED / ENDED / CANCELED
 * - 位置信息为扁平字段：locationName / locationAddr / locationLat / locationLng
 * - 人数字段: currentCount（后端字段，签到时 +1，取消时 -1）
 * - 详情接口额外返回 isJoined 标识当前用户是否已报名
 *
 * 之前的脚手架版本用了一组小写 + 嵌套 location 的旧定义；issue #22 起
 * 统一改为后端契约，所有活动相关页面 / 组件 / API 客户端同步切换。
 */

export type ActivityType =
  | 'STUDY' // 自习
  | 'SPORTS' // 运动
  | 'BOARD_GAME' // 桌游
  | 'ONLINE_GAME' // 线上开黑
  | 'OTHER';

/** 活动状态（与 Prisma `ActivityStatus` enum 保持一致） */
export type ActivityStatus =
  | 'RECRUITING' // 招募中
  | 'FULL' // 已满员
  | 'STARTED' // 已开始
  | 'ENDED' // 已结束
  | 'CANCELED'; // 已取消

/** 活动类型中文标签（前端展示用） */
export const ACTIVITY_TYPE_LABEL: Record<ActivityType, string> = {
  STUDY: '自习',
  SPORTS: '运动',
  BOARD_GAME: '桌游',
  ONLINE_GAME: '开黑',
  OTHER: '其他',
};

/** 活动状态中文标签 + 颜色（前端展示用） */
export const ACTIVITY_STATUS_LABEL: Record<ActivityStatus, string> = {
  RECRUITING: '招募中',
  FULL: '已满员',
  STARTED: '进行中',
  ENDED: '已结束',
  CANCELED: '已取消',
};

/** 活动类型筛选芯片（list 页用） */
export const ACTIVITY_TYPE_FILTERS: { value: ActivityType | ''; label: string }[] = [
  { value: '', label: '全部' },
  { value: 'STUDY', label: '自习' },
  { value: 'SPORTS', label: '运动' },
  { value: 'BOARD_GAME', label: '桌游' },
  { value: 'ONLINE_GAME', label: '开黑' },
  { value: 'OTHER', label: '其他' },
];

/** 活动状态筛选芯片 */
export const ACTIVITY_STATUS_FILTERS: { value: ActivityStatus | ''; label: string }[] = [
  { value: '', label: '全部' },
  { value: 'RECRUITING', label: '招募中' },
  { value: 'FULL', label: '已满员' },
  { value: 'STARTED', label: '进行中' },
  { value: 'ENDED', label: '已结束' },
];

/** 活动实体（后端 GET /api/v1/activities/:id 响应） */
export interface Activity {
  id: string;
  type: ActivityType;
  title: string;
  description: string;
  coverUrl: string | null;
  locationName: string;
  locationAddr: string;
  locationLat: number;
  locationLng: number;
  /** ISO 字符串 */
  startTime: string;
  /** ISO 字符串 */
  endTime: string;
  maxParticipants: number;
  currentCount: number;
  tags: string[];
  status: ActivityStatus;
  creatorId: string;
  createdAt: string;
  updatedAt: string;
  /** 仅详情接口返回：当前用户是否已报名（未登录固定为 false） */
  isJoined?: boolean;
}

/** 活动列表查询参数（与后端 listQuerySchema 保持一致） */
export interface ActivityListQuery {
  type?: ActivityType;
  status?: ActivityStatus;
  city?: string;
  page?: number;
  pageSize?: number;
}

/** 活动列表响应（与后端 list handler 保持一致） */
export interface ActivityListResponse {
  data: Activity[];
  total: number;
  page: number;
  pageSize: number;
}

/** 创建活动入参（与后端 createBodySchema 保持一致） */
export interface CreateActivityPayload {
  type: ActivityType;
  title: string;
  description: string;
  coverUrl?: string;
  location: {
    name: string;
    addr: string;
    lat: number;
    lng: number;
  };
  /** ISO 字符串 */
  startTime: string;
  /** ISO 字符串 */
  endTime: string;
  maxParticipants: number;
  tags?: string[];
}

/** 编辑活动入参（与后端 patchBodySchema 保持一致） */
export interface UpdateActivityPayload {
  title?: string;
  description?: string;
  coverUrl?: string | null;
  startTime?: string;
  endTime?: string;
  maxParticipants?: number;
  tags?: string[];
}

/** 报名记录状态 */
export type SignupStatusValue = 'PENDING' | 'APPROVED' | 'REJECTED' | 'CANCELED';

/** 报名成功响应（POST /activities/:id/signup） */
export interface SignupSuccess {
  signup: {
    id: string;
    activityId: string;
    userId: string;
    status: SignupStatusValue;
    signedAt: string;
    canceledAt: string | null;
    remark?: string | null;
  };
  newCount: number;
  isFull: boolean;
}

/** 取消报名响应（DELETE /activities/:id/signup） */
export interface CancelSignupSuccess {
  signupId: string;
  newCount: number;
  reopened: boolean;
}

/** 取消活动响应（DELETE /activities/:id） */
export interface CancelActivitySuccess {
  id: string;
  status: 'CANCELED';
}

/** 报名列表分页响应（GET /activities/:id/participants） */
export interface ParticipantsResponse {
  data: Array<{
    userId: string;
    nickname: string;
    avatar: string | null;
    school: string | null;
    relation: 'creator' | 'signup';
    signedAt: string;
  }>;
  total: number;
  page: number;
  pageSize: number;
}
