import { afterEach, describe, expect, it, vi } from 'vitest';
import { createLogger } from './logger';
import { shutdown } from './shutdown';

const logger = createLogger({ level: 'silent' });
afterEach(() => vi.useRealTimers());

function fakeServer(closes: boolean) {
  return {
    close: vi.fn((cb: (err?: Error) => void) => {
      if (closes) setTimeout(() => cb(), 0);
    }),
    closeIdleConnections: vi.fn()
  };
}

describe('shutdown', () => {
  it('stops accepting, drains, closes the pool, then exits 0', async () => {
    const server = fakeServer(true);
    const pool = { end: vi.fn(async () => undefined) };
    const exit = vi.fn();
    await shutdown({ server, pool, logger, exit, timeoutMs: 1000 });
    expect(server.close).toHaveBeenCalled();
    expect(server.closeIdleConnections).toHaveBeenCalled();
    expect(pool.end).toHaveBeenCalled();
    expect(exit).toHaveBeenCalledWith(0);
  });

  it('exits 1 when connections do not drain in time', async () => {
    vi.useFakeTimers();
    const server = fakeServer(false);
    const pool = { end: vi.fn(async () => undefined) };
    const exit = vi.fn();
    const done = shutdown({ server, pool, logger, exit, timeoutMs: 5000 });
    await vi.advanceTimersByTimeAsync(5000);
    await done;
    expect(exit).toHaveBeenCalledWith(1);
  });
});
