/**
 * Google "Sign in with Google" id_token verification.
 *
 * Uses `google-auth-library`'s `OAuth2Client.verifyIdToken` which:
 *   1. Fetches Google's JWKS (https://www.googleapis.com/oauth2/v3/certs)
 *      and caches it (12h default — Google rotates ~every 6h).
 *   2. Verifies the signature, audience, issuer, and expiry.
 *   3. Returns the decoded payload including `sub` (stable Google user id).
 *
 * Reference: https://developers.google.com/identity/sign-in/web/devinfo-project-id
 */
import { OAuth2Client, type LoginTicket } from 'google-auth-library';

import { env } from './env.js';

export interface GoogleVerified {
  sub: string;            // Google user id (stable, opaque)
  email?: string;
  emailVerified?: boolean;
  name?: string;
  picture?: string;
  raw: {
    sub: string;
    email?: string;
    email_verified?: boolean;
    name?: string;
    picture?: string;
    [k: string]: unknown;
  };
}

export class GoogleNotConfiguredError extends Error {
  constructor() {
    super('GOOGLE_CLIENT_ID not configured');
    this.name = 'GoogleNotConfiguredError';
  }
}

export class GoogleTokenError extends Error {
  constructor(message: string, public readonly code: string = 'INVALID_ID_TOKEN') {
    super(message);
    this.name = 'GoogleTokenError';
  }
}

let _client: OAuth2Client | null = null;
function client(): OAuth2Client {
  if (!_client) {
    if (!env.GOOGLE_CLIENT_ID) {
      throw new GoogleNotConfiguredError();
    }
    _client = new OAuth2Client(env.GOOGLE_CLIENT_ID);
  }
  return _client;
}

/**
 * Verify a Google id_token and return the Google `sub` plus the
 * user-info claims we use to populate a freshly-merged User record.
 */
export async function verifyGoogleIdToken(idToken: string): Promise<GoogleVerified> {
  if (!env.GOOGLE_CLIENT_ID) {
    throw new GoogleNotConfiguredError();
  }

  let ticket: LoginTicket;
  try {
    ticket = await client().verifyIdToken({
      idToken,
      audience: env.GOOGLE_CLIENT_ID,
    });
  } catch (e) {
    const err = e as Error & { message?: string };
    if (/expired/i.test(err.message ?? '')) {
      throw new GoogleTokenError('Google id_token expired', 'TOKEN_EXPIRED');
    }
    throw new GoogleTokenError(`Google id_token invalid: ${err.message ?? 'unknown'}`);
  }

  const payload = ticket.getPayload();
  if (!payload) {
    throw new GoogleTokenError('Google id_token returned empty payload');
  }
  if (typeof payload.sub !== 'string' || payload.sub.length === 0) {
    throw new GoogleTokenError('Google id_token missing sub claim');
  }

  return {
    sub: payload.sub,
    email: payload.email,
    emailVerified: payload.email_verified,
    name: payload.name,
    picture: payload.picture,
    raw: payload as unknown as GoogleVerified['raw'],
  };
}
