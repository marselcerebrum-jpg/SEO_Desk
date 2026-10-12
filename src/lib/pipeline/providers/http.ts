export class HttpError extends Error {
  constructor(
    message: string,
    readonly status: number,
  ) {
    super(message);
  }
}

const retryable = (error: unknown) =>
  !(error instanceof HttpError) || error.status === 429 || error.status >= 500;

// Setara retryOnFail + maxTries 2 di n8n. Error 4xx (kecuali 429) tidak diulang.
export async function withRetry<T>(fn: () => Promise<T>, tries = 2, delayMs = 3000): Promise<T> {
  for (let attempt = 1; ; attempt++) {
    try {
      return await fn();
    } catch (error) {
      if (attempt >= tries || !retryable(error)) throw error;
      await new Promise((resolve) => setTimeout(resolve, delayMs * attempt));
    }
  }
}

export async function fetchJson<T>(url: string, init: RequestInit & { timeoutMs?: number }): Promise<T> {
  const { timeoutMs = 180_000, ...rest } = init;
  const response = await fetch(url, { ...rest, signal: AbortSignal.timeout(timeoutMs) });
  const body = await response.text();
  if (!response.ok) {
    throw new HttpError(`${new URL(url).host} ${response.status}: ${body.slice(0, 500)}`, response.status);
  }
  return JSON.parse(body) as T;
}
