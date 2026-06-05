/**
 * Auth module public surface.
 *
 * Mounted by `lib/app.ts`:
 *   await registerAuthModule(app);
 */
export {
  registerAuthRoutes,
  // re-exported for tests
} from './auth.routes.js';

export { registerAuthRoutes as registerAuthModule } from './auth.routes.js';
export {
  findOrCreateUser,
  issueTokens,
  toUserPublic,
  type IdentityHint,
  type ProviderKind,
  type IssuedTokens,
} from './auth.service.js';
export {
  appleLoginBodySchema,
  googleLoginBodySchema,
  logoutBodySchema,
  refreshBodySchema,
  wechatLoginBodySchema,
  type AppleLoginBody,
  type GoogleLoginBody,
  type LogoutBody,
  type LoginResponse,
  type RefreshBody,
  type UserPublic,
  type WechatLoginBody,
} from './auth.schema.js';
