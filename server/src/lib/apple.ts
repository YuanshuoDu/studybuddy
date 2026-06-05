/**
 * Apple "Sign in with Apple" id_token verification.
 *
 * Apple publishes its signing keys as a JWKS at
 *   https://appleid.apple.com/auth/keys
 * and the token claims follow the OIDC spec with a few Apple-specific
 * quirks (see https://developer.apple.com/documentation/sign_in_with_apple/sign_in_with_apple_rest_api).
 *
 * We use `jose` to:
 *   1. Fetch and cache the JWKS (24h TTL — Apple rotates them ~monthly).
 *   2. Verify the id_token's signature against the published JWKs.
 *   3. Validate `iss` === 'https://appleid.apple.com', `aud` matches our
 *      client id, `exp` / `iat` are sane, and the token is not too old.
 *
 * On success we return the `sub` (Apple's stable, opaque user id) plus
 * the `email` (first sign-in only) and `isPrivateEmail` flag.
 */
import { createRemoteJWKSet, jwtVerify, type JWTPayload } from 'jose';

import { env } from './env.js';

const APPLE_JWKS_URL = new URL('https://appleid.apple.com/auth/keys');
const APPLE_ISSUER = 'https://appleid.apple.com';

let _jwks: ReturnType<typeof createRemoteJWKSet> | null = null;
function jwks(): ReturnType<typeof createRemoteJWKSet> {
  if (!_jwks) {
    // jose handles caching + rotation internally; default is 10min cooldown
    // per kid which is plenty for Apple.
    _jwks = createRemoteJWKSet(APPLE_JWKS_URL, {
      cacheMaxAge: 24 * 60 * 60 * 1_000, // 24 hours
    });
  }
  return _jwks;
}

export interface AppleVerified {
  sub: string;            // Apple user id (stable, opaque)
  email?: string;
  isPrivateEmail?: boolean;
  emailVerified?: boolean;
  raw: JWTPayload;
}

export class AppleNotConfiguredError extends Error {
  constructor() {
    super('APPLE_CLIENT_ID / APPLE_AUDIENCE not configured');
    this.name = 'AppleNotConfiguredError';
  }
}

export class AppleTokenError extends Error {
  constructor(message: string, public readonly code: string = 'INVALID_ID_TOKEN') {
    super(message);
    this.name = 'AppleTokenError';
  }
}

/**
 * Verify an Apple id_token and return the Apple `sub` plus a few claims
 * we care about.  Throws on any verification failure.
 *
 * Required env: APPLE_CLIENT_ID (and APPLE_AUDIENCE if it differs).
 */
export async function verifyAppleIdToken(idToken: string): Promise<AppleVerified> {
  const audience = env.APPLE_AUDIENCE ?? env.APPLE_CLIENT_ID;
  if (!audience) {
    throw new AppleNotConfiguredError();
  }

  let payload: JWTPayload;
  try {
    const verified = await jwtVerify(idToken, jwks(), {
      issuer: APPLE_ISSUER,
      audience,
      algorithms: ['RS256'],
    });
    payload = verified.payload;
  } catch (e) {
    const err = e as Error & { name?: string; code?: string };
    if (err.name === 'JWTExpired' || err.code === 'ERR_JWT_EXPIRED') {
      throw new AppleTokenError('Apple id_token expired', 'TOKEN_EXPIRED');
    }
    throw new AppleTokenError(`Apple id_token invalid: ${err.message}`);
  }

  if (typeof payload.sub !== 'string' || payload.sub.length === 0) {
    throw new AppleTokenError('Apple id_token missing sub claim');
  }

  return {
    sub: payload.sub,
    email: typeof payload.email === 'string' ? payload.email : undefined,
    isPrivateEmail: typeof payload['is_private_email'] === 'string'
      ? payload['is_private_email'] === 'true'
      : undefined,
    emailVerified: typeof payload.email_verified === 'boolean'
      ? payload.email_verified
      : typeof payload.email_verified === 'string'
        ? payload.email_verified === 'true'
        : undefined,
    raw: payload,
  };
}
