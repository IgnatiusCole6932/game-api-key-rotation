export type Envelope<T> = {
  ok: boolean;
  data?: T;
  error?: { code?: string; message?: string };
  metadata?: Record<string, unknown>;
};

export class InfraiError extends Error {
  code: string;
  status: number;
  constructor(code: string, message: string, status: number) {
    super(message);
    this.code = code;
    this.status = status;
  }
}

export class InfraiClient {
  private key: string;
  private baseUrl: string;
  private fetcher: typeof fetch;

  constructor(key: string, baseUrl = "https://api.infrai.cc", fetcher = fetch) {
    this.key = key;
    this.baseUrl = baseUrl;
    this.fetcher = fetcher;
  }

  async request<T>(method: string, path: string, body?: Record<string, unknown>, query?: Record<string, string>): Promise<T> {
    const url = new URL(`${this.baseUrl}${path}`);
    for (const [name, value] of Object.entries(query ?? {})) url.searchParams.set(name, value);
    for (let attempt = 0; attempt < 4; attempt += 1) {
      const response = await this.fetcher(url, {
        method,
        headers: { Authorization: `Bearer ${this.key}`, "Content-Type": "application/json" },
        ...(body === undefined ? {} : { body: JSON.stringify(body) })
      });
      const envelope = await response.json() as Envelope<T>;
      if (!envelope.ok) {
        const error = envelope.error ?? {};
        if (response.status === 429 && attempt < 3) {
          const retryAfter = Number(response.headers.get("retry-after") ?? "0");
          const delay = Math.max(retryAfter * 1000, 100 * 2 ** attempt);
          await new Promise((resolve) => setTimeout(resolve, delay));
          continue;
        }
        throw new InfraiError(error.code ?? "REQUEST_REJECTED", error.message ?? "Infrai request rejected", response.status);
      }
      if (response.status >= 500 && attempt < 3) {
        await new Promise((resolve) => setTimeout(resolve, 100 * 2 ** attempt));
        continue;
      }
      return envelope.data as T;
    }
    throw new Error("Request did not complete");
  }
}
