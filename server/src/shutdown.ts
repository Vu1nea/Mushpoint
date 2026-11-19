import type { Logger } from './logger';

interface Closable {
  close(cb: (err?: Error) => void): unknown;
  closeIdleConnections(): void;
}

/** Stops taking connections, lets in-flight requests finish, closes the pool
 * and exits. Exits 1 if draining takes longer than `timeoutMs`, so a stuck
 * request can't keep a terminating pod alive past its grace period. */
export async function shutdown(opts: {
  server: Closable;
  pool: { end(): Promise<void> };
  logger: Logger;
  exit: (code: number) => void;
  timeoutMs: number;
}): Promise<void> {
  const { server, pool, logger, exit, timeoutMs } = opts;
  let timer: NodeJS.Timeout | undefined;
  const drained = new Promise<boolean>((resolve) => {
    server.close(() => resolve(true));
    // Keep-alive sockets with no request in flight would otherwise hold close().
    server.closeIdleConnections();
  });
  const timedOut = new Promise<boolean>((resolve) => {
    timer = setTimeout(() => resolve(false), timeoutMs);
  });
  const clean = await Promise.race([drained, timedOut]);
  clearTimeout(timer);
  if (!clean) {
    logger.error({ timeoutMs }, 'shutdown timed out with requests still open');
    exit(1);
    return;
  }
  await pool.end().catch((err) => logger.error({ err }, 'closing the database pool failed'));
  logger.info('shutdown complete');
  exit(0);
}
