/**
 * Push notification dispatcher — issue #27 (stub for M3 launch).
 *
 * Channel-specific send logic is a noop in this PR. M3 W2 followup
 * wires:
 *   - WECHAT_TEMPLATE → `wx.api.uniformMessage.send` (or
 *     `subscribeMessage.send`) per the template-id set
 *   - TPNS → REST POST https://api.tpns.tencent.com/v3/push/app-push
 *   - FCM  → POST https://fcm.googleapis.com/v1/projects/{}/messages:send
 *   - APNS → provider API tokens + HTTP/2 push to APNs
 *
 * For M3 the function returns `{ ok: true, dispatched: false }` so
 * the client registration round-trip is end-to-end testable without
 * a provider credential.
 */

import type { PushChannel } from '@prisma/client';

export interface PushPayload {
  /** `test` for the registration smoke check; later: `activity_reminder`,
   * `signup_confirmed`, `review_request`, etc. */
  kind: string;
  title: string;
  body: string;
  data?: Record<string, unknown>;
}

export interface PushResult {
  ok: boolean;
  dispatched: boolean;
  providerMessageId?: string;
  error?: string;
}

/**
 * Best-effort send. Never throws — push failures must not surface
 * to the API caller. Logged for ops; tracked via Sentry once
 * monitoring lands.
 */
export async function sendPush(
  channel: PushChannel,
  _token: string,
  _payload: PushPayload,
): Promise<PushResult> {
  // Issue #27 M3 launch: dispatcher is a noop. Future implementation:
  switch (channel) {
    case 'WECHAT_TEMPLATE':
    case 'TPNS':
    case 'FCM':
    case 'APNS':
      // noop
      return { ok: true, dispatched: false };
    default: {
      // Exhaustiveness check — should be unreachable because `channel`
      // is typed as `PushChannel`, but we make TS strict-mode happy.
      const _exhaustive: never = channel;
      void _exhaustive;
      return { ok: false, dispatched: false, error: 'unsupported channel' };
    }
  }
}
