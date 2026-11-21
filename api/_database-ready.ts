// Only idempotent schema initialization is retried here, never user writes.
const transientCodes = new Set(['08000', '08001', '08003', '08006', '40001', '40P01', '53300', '57P01', '57P02', '57P03', 'ECONNRESET', 'ETIMEDOUT', 'ECONNREFUSED']);
function isTransient(error: any) {
  return transientCodes.has(error?.code) || /fetch failed|error connecting to database|connection (?:closed|terminated)|timeout|timed out/i.test(error?.message || '');
}
export function createDatabaseInitializer(initialize: () => Promise<void>, options: {
  retries?: number; delayMs?: number; cooldownMs?: number;
  now?: () => number; wait?: (ms: number) => Promise<void>;
} = {}) {
  const { retries = 2, delayMs = 250, cooldownMs = 5000, now = Date.now,
    wait = (ms: number) => new Promise<void>(resolve => setTimeout(resolve, ms)) } = options;
  let ready = false;
  let pending: Promise<void> | null = null;
  let failure: unknown;
  let retryAt = 0;
  return function ensureDatabase(): Promise<void> {
    if (ready) return Promise.resolve();
    if (pending) return pending;
    if (failure && now() < retryAt) return Promise.reject(failure);
    const attempt = (async () => {
      for (let index = 0; ; index++) {
        try { await initialize(); ready = true; failure = undefined; return; }
        catch (error) {
          if (index >= retries || !isTransient(error)) throw error;
          await wait(delayMs * 2 ** index);
        }
      }
    })();
    pending = attempt;
    // Observe failures immediately, including eager serverless startup.
    attempt.then(() => { pending = null; }, error => {
      failure = error; retryAt = now() + cooldownMs; pending = null;
    });
    return attempt;
  };
}
