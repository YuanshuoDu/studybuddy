/**
 * 页面 query 参数解析工具
 *
 * 微信小程序的 `onLoad(options)` / `wx.navigateTo` 透传的 `options` 是
 * `Record<string, string | undefined>`（所有值都是 string / undefined）。
 * 直接当业务类型使用会埋下两类坑：
 *   1. 类型断言成 `number` 后，缺值时变成 NaN；
 *   2. 业务页面拿不到合法值时静默失败，难以排查。
 *
 * 这里提供一组轻量、强类型的 reader：缺值/非法值时返回 fallback（必要时
 * 走 logger.warn 提示），避免每个页面重复写 try/catch + parseInt。
 */

/** 微信 onLoad options 的原始类型 */
export type PageQueryRaw = Record<string, string | undefined> | null | undefined;

/**
 * 读取字符串参数。空字符串视为缺值，返回 fallback。
 *
 * @example
 *   const id = readString(options, 'id', '');
 *   const next = readString(options, 'next', '/pages/index/index');
 */
export function readString(
  options: PageQueryRaw,
  key: string,
  fallback = '',
): string {
  if (!options) return fallback;
  const raw = options[key];
  if (raw === undefined || raw === null) return fallback;
  const trimmed = String(raw).trim();
  return trimmed === '' ? fallback : trimmed;
}

/**
 * 读取整数参数。非法值 / 缺值时返回 fallback。
 *
 * @example
 *   const page = readInt(options, 'page', 1);
 */
export function readInt(
  options: PageQueryRaw,
  key: string,
  fallback: number,
): number {
  const raw = options?.[key];
  if (raw === undefined || raw === null || String(raw).trim() === '') {
    return fallback;
  }
  const n = parseInt(String(raw), 10);
  if (!Number.isFinite(n)) return fallback;
  return n;
}

/**
 * 读取布尔参数。识别：1/true/yes → true；0/false/no → false；其它 → fallback。
 *
 * @example
 *   const fromShare = readBool(options, 'fromShare', false);
 */
export function readBool(
  options: PageQueryRaw,
  key: string,
  fallback: boolean,
): boolean {
  const raw = options?.[key];
  if (raw === undefined || raw === null) return fallback;
  const v = String(raw).trim().toLowerCase();
  if (v === '' ) return fallback;
  if (v === '1' || v === 'true' || v === 'yes') return true;
  if (v === '0' || v === 'false' || v === 'no') return false;
  return fallback;
}

/**
 * 读取枚举参数：值必须属于 `allowed` 之一，否则返回 fallback。
 *
 * 用于 type / status 这种强约束字段，避免把非法值直接传给 API。
 *
 * @example
 *   const t = readEnum<ActivityType>(options, 'type', 'OTHER', [
 *     'STUDY', 'SPORTS', 'BOARD_GAME', 'ONLINE_GAME', 'OTHER',
 *   ]);
 */
export function readEnum<T extends string>(
  options: PageQueryRaw,
  key: string,
  fallback: T,
  allowed: readonly T[],
): T {
  const raw = readString(options, key);
  if (raw === '') return fallback;
  return (allowed as readonly string[]).includes(raw) ? (raw as T) : fallback;
}
