/**
 * Pino-based structured logger.
 *
 * Why pino:
 *   - Fastest JSON logger in the Node ecosystem.
 *   - Structured by default; great for Loki/Elastic ingestion later.
 *   - In development we swap in `pino-pretty` for human-friendly output.
 *
 * Never log secrets (JWT_SECRET, DATABASE_URL, etc). The boot-time env
 * validator is responsible for surfacing misconfiguration, not the logger.
 */
import { pino, type Logger, type LoggerOptions } from 'pino';

import { getEnv } from './env.js';

const options: LoggerOptions = {
  level: getEnv().LOG_LEVEL,
  base: {
    service: 'studybuddy-server',
    env: getEnv().NODE_ENV,
    pid: process.pid,
  },
  timestamp: pino.stdTimeFunctions.isoTime,
  redact: {
    paths: [
      'req.headers.authorization',
      'req.headers.cookie',
      'req.body.password',
      'req.body.token',
      '*.password',
      '*.token',
      '*.secret',
    ],
    censor: '[REDACTED]',
  },
  formatters: {
    level: (label) => ({ level: label }),
  },
  transport:
    getEnv().NODE_ENV === 'development'
      ? {
          target: 'pino-pretty',
          options: {
            colorize: true,
            translateTime: 'SYS:HH:MM:ss.l',
            ignore: 'pid,hostname,service,env',
            singleLine: false,
          },
        }
      : undefined,
};

export const logger: Logger = pino(options);

export type { Logger };
