import { describe, expect, it, vi } from "vitest";
import { backoffDelay, isRetryable, parseRetryAfter, withRetry } from "../retry";
import { classifySyncError } from "../sync";

/** Fake clock: sleep advances `now` instantly and records each delay. */
function fakeClock() {
  let t = 0;
  const delays: number[] = [];
  return {
    delays,
    now: () => t,
    sleep: async (ms: number) => {
      delays.push(ms);
      t += ms;
    },
  };
}

const http = (status: number, retryAfterMs: number | null = null) =>
  Object.assign(new Error(`HTTP ${status}`), { status, retryAfterMs });

describe("retry: classificação", () => {
  it("1. só repete falhas transitórias", () => {
    for (const s of [408, 425, 429, 500, 502, 503, 504]) expect(isRetryable(http(s))).toBe(true);
    for (const s of [400, 401, 403, 404, 422, 501, 505]) expect(isRetryable(http(s))).toBe(false);
    expect(isRetryable(new TypeError("fetch failed"))).toBe(true);
    expect(isRetryable(Object.assign(new Error("t"), { name: "TimeoutError" }))).toBe(true);
    expect(isRetryable(new Error("duplicate key"))).toBe(false);
  });

  it("2. Retry-After em segundos ou data HTTP", () => {
    const now = Date.parse("2026-10-17T12:00:00Z");
    expect(parseRetryAfter("5", now)).toBe(5000);
    expect(parseRetryAfter("Sat, 17 Oct 2026 12:00:03 GMT", now)).toBe(3000);
    expect(parseRetryAfter("Sat, 17 Oct 2026 11:00:00 GMT", now)).toBe(0);
    expect(parseRetryAfter(null, now)).toBeNull();
    expect(parseRetryAfter("lixo", now)).toBeNull();
  });

  it("3. backoff exponencial com jitter, limitado ao teto", () => {
    expect(backoffDelay(1, 1000, 10_000, () => 1)).toBe(1000);
    expect(backoffDelay(3, 1000, 10_000, () => 1)).toBe(4000);
    expect(backoffDelay(10, 1000, 10_000, () => 1)).toBe(10_000);
    expect(backoffDelay(3, 1000, 10_000, () => 0.5)).toBe(2000);
  });
});

describe("retry: withRetry", () => {
  it("4. recupera de uma falha transitória", async () => {
    const clock = fakeClock();
    const fn = vi.fn().mockRejectedValueOnce(http(503)).mockResolvedValue("ok");
    await expect(withRetry(fn, { ...clock, random: () => 1 })).resolves.toBe("ok");
    expect(fn).toHaveBeenCalledTimes(2);
    expect(clock.delays).toEqual([1000]);
  });

  it("5. desiste após o limite de tentativas e devolve o último erro", async () => {
    const clock = fakeClock();
    const fn = vi.fn().mockRejectedValue(http(502));
    await expect(withRetry(fn, { ...clock, random: () => 1 })).rejects.toMatchObject({
      status: 502,
    });
    expect(fn).toHaveBeenCalledTimes(3);
    expect(clock.delays).toEqual([1000, 2000]);
  });

  it("6. erro de autenticação ou permanente não é repetido", async () => {
    for (const status of [401, 403, 400]) {
      const clock = fakeClock();
      const fn = vi.fn().mockRejectedValue(http(status));
      await expect(withRetry(fn, clock)).rejects.toMatchObject({ status });
      expect(fn).toHaveBeenCalledTimes(1);
      expect(clock.delays).toEqual([]);
    }
  });

  it("7. respeita o Retry-After do 429", async () => {
    const clock = fakeClock();
    const fn = vi.fn().mockRejectedValueOnce(http(429, 4000)).mockResolvedValue("ok");
    await expect(withRetry(fn, clock)).resolves.toBe("ok");
    expect(clock.delays).toEqual([4000]);
  });

  it("8. Retry-After maior que o teto: desiste em vez de travar", async () => {
    const clock = fakeClock();
    const fn = vi.fn().mockRejectedValue(http(429, 60_000));
    await expect(withRetry(fn, clock)).rejects.toMatchObject({ status: 429 });
    expect(fn).toHaveBeenCalledTimes(1);
  });

  it("9. respeita o orçamento total de tempo", async () => {
    const clock = fakeClock();
    const fn = vi.fn().mockRejectedValue(http(503, 8000));
    await expect(
      withRetry(fn, { ...clock, maxAttempts: 10, maxTotalMs: 20_000 }),
    ).rejects.toMatchObject({ status: 503 });
    // 8s + 8s = 16s; a third wait would pass 20s.
    expect(clock.delays).toEqual([8000, 8000]);
    expect(fn).toHaveBeenCalledTimes(3);
  });

  it("10. o checkpoint fica com quem chama: só a página que falhou é repetida", async () => {
    const clock = fakeClock();
    const calls: string[] = [];
    const page = (n: number) => () => {
      calls.push(`p${n}`);
      if (n === 2 && calls.filter((c) => c === "p2").length === 1) {
        return Promise.reject(http(503));
      }
      return Promise.resolve([n]);
    };
    const collected: number[] = [];
    for (const n of [1, 2, 3]) collected.push(...(await withRetry(page(n), clock)));
    expect(collected).toEqual([1, 2, 3]);
    expect(calls).toEqual(["p1", "p2", "p2", "p3"]);
  });
});

describe("retry: estado final orienta o usuário", () => {
  it("11. auth pede reconexão; transitório pede tentar depois; nada vaza", () => {
    expect(classifySyncError(http(401)).error).toMatch(/Reconecte/);
    expect(classifySyncError(http(429)).error).toMatch(/minutos/);
    expect(classifySyncError(http(503)).status).toBe("transient_error");
    expect(classifySyncError(http(422)).error).toMatch(/Repetir não resolve/);
    expect(classifySyncError(new Error("token=abc")).error).not.toContain("abc");
  });
});
