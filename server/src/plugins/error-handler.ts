/**
 * Global error handler.
 *
 * Maps:
 *   - AppError subclasses   → RFC 7807 with the error's statusCode / code
 *   - Fastify validation    → 400 VALIDATION_ERROR with field details
 *   - Anything else         → 500 INTERNAL_ERROR (message hidden in prod)
 *
 * Stack traces are NEVER leaked in responses. Server-side logs include
 * the full error for debugging.
 */
import type { FastifyError, FastifyInstance, FastifyReply, FastifyRequest } from 'fastify';
import fp from 'fastify-plugin';

import { AppError } from '@/lib/errors.js';
import { env } from '@/lib/env.js';

const ERROR_TYPE_BASE = 'https://pairhub.example.com/errors';

function problemTypeFor(code: string): string {
  return `${ERROR_TYPE_BASE}/${code.toLowerCase().replace(/_/g, '-')}`;
}

async function errorHandlerPlugin(app: FastifyInstance): Promise<void> {
  app.setErrorHandler((err: FastifyError, req: FastifyRequest, reply: FastifyReply) => {
    // Always log the full error server-side.
    req.log.error({ err }, 'request failed');

    // 1. Fastify schema validation
    if ('validation' in err && err.validation) {
      return reply.code(400).send({
        type: problemTypeFor('VALIDATION_ERROR'),
        title: 'Validation Error',
        status: 400,
        detail: err.message,
        instance: req.url,
        code: 'VALIDATION_ERROR',
        errors: err.validation,
      });
    }

    // 2. Our own domain errors
    if (err instanceof AppError) {
      return reply.code(err.statusCode).send({
        type: problemTypeFor(err.code),
        title: err.name,
        status: err.statusCode,
        detail: err.message,
        instance: req.url,
        code: err.code,
        ...(err.details ? { details: err.details } : {}),
      });
    }

    // 3. @fastify/jwt errors
    const jwtErrorCodes = new Set([
      'FST_JWT_AUTHORIZATION_TOKEN_EXPIRED',
      'FST_JWT_AUTHORIZATION_TOKEN_INVALID',
      'FST_JWT_NO_AUTHORIZATION_IN_HEADER',
      'FST_JWT_AUTHORIZATION_TOKEN_UNTRUSTED',
    ]);
    if (err.code && jwtErrorCodes.has(err.code)) {
      return reply.code(401).send({
        type: problemTypeFor('UNAUTHORIZED'),
        title: 'Unauthorized',
        status: 401,
        detail: 'Token 无效或已过期',
        instance: req.url,
        code: 'UNAUTHORIZED',
      });
    }

    // 4. @fastify/rate-limit errors
    if (err.statusCode === 429) {
      return reply.code(429).send({
        type: problemTypeFor('RATE_LIMIT_EXCEEDED'),
        title: 'Too Many Requests',
        status: 429,
        detail: '请求过于频繁，请稍后再试',
        instance: req.url,
        code: 'RATE_LIMIT_EXCEEDED',
      });
    }

    // 5. Anything else — never leak the message in production.
    const status = err.statusCode && err.statusCode >= 400 ? err.statusCode : 500;
    const isServer = status >= 500;
    return reply.code(status).send({
      type: isServer
        ? problemTypeFor('INTERNAL_ERROR')
        : problemTypeFor(err.code ?? 'ERROR'),
      title: err.name ?? 'Error',
      status,
      detail:
        isServer && env.NODE_ENV === 'production' ? '服务器内部错误' : err.message,
      instance: req.url,
      code: isServer ? 'INTERNAL_ERROR' : (err.code ?? 'ERROR'),
    });
  });
}

export default fp(errorHandlerPlugin, { name: 'error-handler-plugin' });
