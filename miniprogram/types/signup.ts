/**
 * 报名相关类型
 *
 * 报名状态枚举与后端 Prisma `SignupStatus` 保持一致：
 *   PENDING / APPROVED / REJECTED / CANCELED
 */
import type { Activity } from './activity';

export type SignupStatus = 'PENDING' | 'APPROVED' | 'REJECTED' | 'CANCELED';

export interface Signup {
  id: string;
  activityId: string;
  userId: string;
  status: SignupStatus;
  /** 报名时间 ISO */
  signedAt: string;
  /** 取消时间 ISO（未取消时为 null） */
  canceledAt: string | null;
  /** 备注 / 留言 */
  remark?: string | null;
}

/** 报名 + 活动详情（用于 "我的报名" 列表） */
export interface SignupWithActivity extends Signup {
  activity: Activity;
}
