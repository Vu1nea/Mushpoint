import { randomUUID } from 'node:crypto';
import type { RequestHandler } from 'express';
import { pino, type DestinationStream, type Logger, type LoggerOptions } from 'pino';

export type { Logger };

/** JSON logs on stdout. Silent under Vitest unless LOG_LEVEL says otherwise. */
export function createLogger(opts: LoggerOptions = {}, stream?: DestinationStream): Logger {
  const level = process.env.LOG_LEVEL ?? (process.env.VITEST ? 'silent' : 'info');
  const options: LoggerOptions = {
    level,
    base: undefined,
    // Belt and braces: nothing here logs headers, but if anyone ever does,
    // credentials are masked.
    redact: ['req.headers.authorization', 'headers.authorization', 'authorization', 'apikey'],
    ...opts
  };
  return stream ? pino(options, stream) : pino(options);
}

/** The process-wide logger, for code that runs outside a request. */
export const log = createLogger();

const SAFE_ID = /^[A-Za-z0-9._-]{1,128}$/;

/** Assigns a request id (keeping a well-formed inbound `X-Request-Id`), puts a
 * child logger on `res.locals.log`, and writes one line when the response
 * finishes. Logs the path without its query string and never the headers. */
export function requestLogger(logger: Logger): RequestHandler {
  return (req, res, next) => {
    const inbound = req.header('x-request-id');
    const requestId = inbound && SAFE_ID.test(inbound) ? inbound : randomUUID();
    res.setHeader('X-Request-Id', requestId);
    res.locals.log = logger.child({ requestId });
    const started = process.hrtime.bigint();
    res.on('finish', () => {
      const durationMs = Number(process.hrtime.bigint() - started) / 1e6;
      const line = {
        method: req.method,
        path: req.originalUrl.split('?')[0],
        status: res.statusCode,
        durationMs: Math.round(durationMs * 10) / 10,
        userId: res.locals.userId as string | undefined
      };
      if (res.statusCode >= 500) res.locals.log.error(line, 'request');
      else res.locals.log.info(line, 'request');
    });
    next();
  };
}
