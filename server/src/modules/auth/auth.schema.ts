/**
 * zod schemas for the auth module.
 *
 * Schemas are intentionally close to the spec (`docs/api/v1.md` §8) so the
 * same shape can be used to generate OpenAPI in M2.
 */
import { z } from 'zod';

// =====================================================================
// POST /api/v1/auth/wechat-login
// =====================================================================

export const wechatLoginBodySchema = z.object({
  code: z.string().min(1).max(64),
  // Optional identity hints we use to merge with an existing User (see
  // docs/architecture-v1.0.md §5.1 — phone-first merge).
  phone: z
    .string()
    .regex(/^\+?[0-9]{6,20}$/, 'phone must be E.164-ish (6–20 digits, optional +)')
    .optional(),
  // `encryptedData` + `iv` would normally be used to decrypt the WeChat
  // `unionId` and phone bundle. MVP does not decrypt server-side — we
  // accept them for forward compatibility but only `code` is required.
  encryptedData: z.string().min(1).max(2048).optional(),
  iv: z.string().min(1).max(64).optional(),
});
export type WechatLoginBody = z.infer<typeof wechatLoginBodySchema>;

// =====================================================================
// POST /api/v1/auth/apple-login
// =====================================================================

export const appleLoginBodySchema = z.object({
  idToken: z.string().min(10).max(4096),
  // Apple delivers the user's name ONLY on the first sign-in.  We accept
  // it for that case and persist it as the new user's nickname.
  fullName: z
    .object({
      firstName: z.string().min(1).max(50).optional(),
      lastName: z.string().min(1).max(50).optional(),
    })
    .optional(),
  email: z.string().email().optional(),
  // Optional phone used for the multi-platform merge path.  Apple
  // does not return a phone by default — if the client captures it via
  // a separate SDK, the app can pass it through here so the user is
  // merged with an existing WeChat/Google account.
  phone: z
    .string()
    .regex(/^\+?[0-9]{6,20}$/, 'phone must be E.164-ish (6–20 digits, optional +)')
    .optional(),
});
export type AppleLoginBody = z.infer<typeof appleLoginBodySchema>;

// =====================================================================
// POST /api/v1/auth/google-login
// =====================================================================

export const googleLoginBodySchema = z.object({
  idToken: z.string().min(10).max(4096),
  // Optional phone used for the multi-platform merge path.
  phone: z
    .string()
    .regex(/^\+?[0-9]{6,20}$/, 'phone must be E.164-ish (6–20 digits, optional +)')
    .optional(),
  // Optional nickname / avatar override from the client.
  nickname: z.string().min(1).max(50).optional(),
  avatar: z.string().url().max(500).optional(),
});
export type GoogleLoginBody = z.infer<typeof googleLoginBodySchema>;

// =====================================================================
// POST /api/v1/auth/refresh
// =====================================================================

export const refreshBodySchema = z.object({
  refreshToken: z.string().min(10).max(2048),
});
export type RefreshBody = z.infer<typeof refreshBodySchema>;

// =====================================================================
// POST /api/v1/auth/logout
// =====================================================================

export const logoutBodySchema = z.object({
  refreshToken: z.string().min(10).max(2048),
});
export type LogoutBody = z.infer<typeof logoutBodySchema>;

// =====================================================================
// Response shapes
// =====================================================================

export const userPublicSchema = z.object({
  id: z.string(),
  nickname: z.string(),
  avatar: z.string().nullable(),
  school: z.string().nullable(),
  primaryProvider: z.enum(['WECHAT', 'APPLE', 'GOOGLE', 'PHONE']),
  providers: z.array(z.enum(['WECHAT', 'APPLE', 'GOOGLE', 'PHONE'])),
  createdAt: z.string(),
});
export type UserPublic = z.infer<typeof userPublicSchema>;

export const loginResponseSchema = z.object({
  accessToken: z.string(),
  refreshToken: z.string(),
  expiresIn: z.number().int().positive(), // access token lifetime in seconds
  user: userPublicSchema,
});
export type LoginResponse = z.infer<typeof loginResponseSchema>;
