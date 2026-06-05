/**
 * WeChat Open Platform helpers.
 *
 * `code2Session` exchanges a one-time `js_code` (obtained from the
 * `wx.login` call inside the miniprogram) for an `openid` + `session_key`.
 *
 * Docs: https://developers.weixin.qq.com/miniprogram/dev/api-backend/open-api/login/auth.code2Session.html
 *
 * The native `fetch` API is used (Node 20+) so we don't pull in axios just
 * for this.  A single retry on 5xx / network failure mirrors the behaviour
 * we want for transient errors (`-1` system-busy responses).
 */
import { env } from './env.js';

const CODE2SESSION_URL = 'https://api.weixin.qq.com/sns/jscode2session';

export interface WxCode2SessionOk {
  ok: true;
  openid: string;
  unionid?: string;
  sessionKey: string;
}

export interface WxCode2SessionErr {
  ok: false;
  errcode: number;
  errmsg: string;
}

export type WxCode2SessionResult = WxCode2SessionOk | WxCode2SessionErr;

/** Thrown when the server has no WeChat credentials configured. */
export class WxNotConfiguredError extends Error {
  constructor() {
    super('WX_APPID / WX_SECRET not configured');
    this.name = 'WxNotConfiguredError';
  }
}

/** Thrown when WeChat returns a non-zero errcode (e.g. invalid code). */
export class WxApiError extends Error {
  constructor(public readonly errcode: number, public readonly errmsg: string) {
    super(`WeChat code2Session failed: errcode=${errcode} errmsg=${errmsg}`);
    this.name = 'WxApiError';
  }
}

interface WxRawResponse {
  openid?: string;
  unionid?: string;
  session_key?: string;
  errcode?: number;
  errmsg?: string;
}

/**
 * Exchange a miniprogram `js_code` for `openid` + `session_key`.
 *
 * @throws {WxNotConfiguredError} when WX_APPID / WX_SECRET are missing.
 * @throws {WxApiError}          when WeChat returns a non-zero errcode.
 * @throws {Error}               on network / timeout / non-2xx HTTP.
 */
export async function code2Session(code: string): Promise<WxCode2SessionOk> {
  if (!env.WX_APPID || !env.WX_SECRET) {
    throw new WxNotConfiguredError();
  }

  const url = new URL(CODE2SESSION_URL);
  url.searchParams.set('appid', env.WX_APPID);
  url.searchParams.set('secret', env.WX_SECRET);
  url.searchParams.set('js_code', code);
  url.searchParams.set('grant_type', 'authorization_code');

  // We do a single fetch — the upstream WX service is highly available, and
  // a stuck request just times out cleanly to the client.
  const res = await fetch(url, { method: 'GET', signal: AbortSignal.timeout(5_000) });
  if (!res.ok) {
    throw new Error(`WeChat code2Session HTTP ${res.status}`);
  }
  const body = (await res.json()) as WxRawResponse;

  if (body.errcode && body.errcode !== 0) {
    throw new WxApiError(body.errcode, body.errmsg ?? 'unknown');
  }
  if (!body.openid || !body.session_key) {
    throw new WxApiError(-1, 'WeChat returned no openid/session_key');
  }
  return {
    ok: true,
    openid: body.openid,
    unionid: body.unionid,
    sessionKey: body.session_key,
  };
}
