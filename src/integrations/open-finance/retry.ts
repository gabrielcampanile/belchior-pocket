/**
 * Bounded retry for Pluggy HTTP calls (BP-035). PURE: the clock, sleep and randomness are
 * injected, so tests drive it with fake timers.
 *
 * Policy:
 *  - only TRANSIENT failures are retried: 408, 425, 429, 5xx (except 501/505), timeouts and
 *    network errors. Auth (401/403) and other 4xx stop at once: retrying cannot fix them and
 *    would only hammer the provider;
 *  - at most `maxAttempts` calls in total (default 3), within `maxTotalMs` (default 30s);
 *  - delay = Retry-After when the provider sends it, else exponential backoff with full
 *    jitter (base 1s, capped at `maxDelayMs`). A Retry-After longer than the cap or the
 *    remaining budget means "not now": we give up instead of blocking the request;
 *  - each retry repeats ONE request (one page, one lookup), so pages already drained stay
 *    collected (checkpoint), and every call is a GET or the token POST: safe to repeat.
 */

export interface RetryOptions {
  maxAttempts?: number;
  baseDelayMs?: number;
  maxDelayMs?: number;
  maxTotalMs?: number;
  sleep?: (ms: number) => Promise<void>;
  now?: () => number;
  random?: () => number;
  /** Called before each retry (log only counts and the delay, never payloads). */
  onRetry?: (info: { attempt: number; delayMs: number; status: number | null }) => void;
}

export const RETRY_DEFAULTS = {
  maxAttempts: 3,
  baseDelayMs: 1_000,
  maxDelayMs: 10_000,
  maxTotalMs: 30_000,
} as const;

/** Status carried by an error (PluggyHttpError.status or a generic statusCode), else null. */
export function errorStatus(err: unknown): number | null {
  const raw =
    (err as { status?: unknown })?.status ?? (err as { statusCode?: unknown })?.statusCode;
  const n = Number(raw);
  return Number.isFinite(n) && n > 0 ? n : null;
}

/** Whether a failure is worth repeating. */
export function isRetryable(err: unknown): boolean {
  const status = errorStatus(err);
  if (status != null) {
    if (status === 408 || status === 425 || status === 429) return true;
    return status >= 500 && status <= 599 && status !== 501 && status !== 505;
  }
  const name = (err as { name?: string })?.name;
  // fetch() rejects with TypeError on network failures; AbortSignal.timeout -> TimeoutError.
  return name === "TimeoutError" || name === "AbortError" || err instanceof TypeError;
}

/**
 * Retry-After header -> milliseconds from `now`. Accepts delta-seconds ("120") or an HTTP
 * date. Returns null when absent or unparseable; never negative.
 */
export function parseRetryAfter(header: string | null | undefined, now: number): number | null {
  if (!header) return null;
  const value = header.trim();
  if (/^\d+$/.test(value)) return Number(value) * 1000;
  const at = Date.parse(value);
  return Number.isNaN(at) ? null : Math.max(0, at - now);
}

/** Exponential backoff with full jitter: random in [0, min(max, base * 2^(attempt-1))]. */
export function backoffDelay(
  attempt: number,
  baseDelayMs: number,
  maxDelayMs: number,
  random: () => number,
): number {
  const ceiling = Math.min(maxDelayMs, baseDelayMs * 2 ** (attempt - 1));
  return Math.round(random() * ceiling);
}

const defaultSleep = (ms: number) => new Promise<void>((resolve) => setTimeout(resolve, ms));

export async function withRetry<T>(fn: () => Promise<T>, options: RetryOptions = {}): Promise<T> {
  const maxAttempts = Math.max(1, options.maxAttempts ?? RETRY_DEFAULTS.maxAttempts);
  const baseDelayMs = options.baseDelayMs ?? RETRY_DEFAULTS.baseDelayMs;
  const maxDelayMs = options.maxDelayMs ?? RETRY_DEFAULTS.maxDelayMs;
  const maxTotalMs = options.maxTotalMs ?? RETRY_DEFAULTS.maxTotalMs;
  const sleep = options.sleep ?? defaultSleep;
  const now = options.now ?? Date.now;
  const random = options.random ?? Math.random;
  const startedAt = now();

  for (let attempt = 1; ; attempt++) {
    try {
      return await fn();
    } catch (err) {
      if (attempt >= maxAttempts || !isRetryable(err)) throw err;

      const retryAfter = (err as { retryAfterMs?: number | null })?.retryAfterMs ?? null;
      const delayMs =
        retryAfter != null ? retryAfter : backoffDelay(attempt, baseDelayMs, maxDelayMs, random);
      const remaining = maxTotalMs - (now() - startedAt);
      // The provider asked us to wait longer than we are willing to: give up, report it.
      if (delayMs > maxDelayMs || delayMs > remaining) throw err;

      options.onRetry?.({ attempt, delayMs, status: errorStatus(err) });
      await sleep(delayMs);
    }
  }
}
