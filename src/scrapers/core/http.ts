/**
 * A deliberately polite HTTP client.
 *
 * Every request checks the host's robots.txt first and honours its
 * Crawl-delay. A disallowed path throws rather than being fetched — the NPFL,
 * for one, publishes `Disallow: /`, and that answer is respected unless an
 * operator passes an explicit override saying they have permission.
 */

export interface FetchOptions {
  /** Minimum gap between requests to the same host, in ms. */
  minDelayMs?: number;
  timeoutMs?: number;
  retries?: number;
  headers?: Record<string, string>;
  /**
   * Set only when the operator has permission from the site owner that
   * supersedes robots.txt. Logged loudly on every use.
   */
  ignoreRobots?: boolean;
}

const USER_AGENT =
  "bass-stats/0.1 (tournament results aggregator; +https://github.com/your-org/bass-stats)";

interface RobotsRules {
  disallow: string[];
  allow: string[];
  crawlDelayMs: number;
}

const robotsCache = new Map<string, Promise<RobotsRules>>();
const lastRequestAt = new Map<string, number>();

function parseRobots(text: string): RobotsRules {
  const rules: RobotsRules = { disallow: [], allow: [], crawlDelayMs: 0 };
  let applies = false;

  for (const rawLine of text.split("\n")) {
    const line = rawLine.split("#")[0].trim();
    if (!line) continue;
    const [rawKey, ...rest] = line.split(":");
    const key = rawKey.trim().toLowerCase();
    const value = rest.join(":").trim();

    if (key === "user-agent") {
      // Groups accumulate: a `*` group anywhere in the file applies to us.
      applies = value === "*";
    } else if (!applies) {
      continue;
    } else if (key === "disallow") {
      if (value) rules.disallow.push(value);
    } else if (key === "allow") {
      if (value) rules.allow.push(value);
    } else if (key === "crawl-delay") {
      const secs = Number(value);
      if (Number.isFinite(secs)) rules.crawlDelayMs = Math.max(rules.crawlDelayMs, secs * 1000);
    }
  }
  return rules;
}

async function getRobots(origin: string): Promise<RobotsRules> {
  let pending = robotsCache.get(origin);
  if (!pending) {
    pending = (async () => {
      try {
        const res = await fetch(`${origin}/robots.txt`, {
          headers: { "user-agent": USER_AGENT },
          signal: AbortSignal.timeout(15_000),
        });
        // No robots.txt means no restrictions.
        if (!res.ok) return { disallow: [], allow: [], crawlDelayMs: 0 };
        return parseRobots(await res.text());
      } catch {
        // Unreachable robots.txt: assume nothing and stay slow.
        return { disallow: [], allow: [], crawlDelayMs: 2000 };
      }
    })();
    robotsCache.set(origin, pending);
  }
  return pending;
}

/** Longest matching rule wins, Allow beating Disallow on a tie. */
export function isAllowed(rules: RobotsRules, path: string): boolean {
  const match = (patterns: string[]) =>
    patterns.reduce((best, p) => (path.startsWith(p) && p.length > best ? p.length : best), 0);
  const deny = match(rules.disallow);
  if (deny === 0) return true;
  return match(rules.allow) >= deny;
}

async function throttle(origin: string, minDelayMs: number) {
  const last = lastRequestAt.get(origin) ?? 0;
  const wait = last + minDelayMs - Date.now();
  if (wait > 0) await new Promise((r) => setTimeout(r, wait));
  lastRequestAt.set(origin, Date.now());
}

export class RobotsDisallowedError extends Error {
  constructor(url: string) {
    super(
      `robots.txt disallows ${url}. This source has asked not to be crawled; ` +
        `use an authorized import path instead of overriding it.`,
    );
    this.name = "RobotsDisallowedError";
  }
}

export async function politeFetch(
  url: string,
  options: FetchOptions = {},
): Promise<Response> {
  const {
    minDelayMs = 1000,
    timeoutMs = 30_000,
    retries = 3,
    headers = {},
    ignoreRobots = false,
  } = options;

  const parsed = new URL(url);
  const origin = parsed.origin;
  const rules = await getRobots(origin);

  if (!ignoreRobots && !isAllowed(rules, parsed.pathname)) {
    throw new RobotsDisallowedError(url);
  }
  if (ignoreRobots && !isAllowed(rules, parsed.pathname)) {
    console.warn(
      `[http] OVERRIDING robots.txt for ${url} — only valid with the site owner's permission.`,
    );
  }

  const delay = Math.max(minDelayMs, rules.crawlDelayMs);
  let lastError: unknown;

  for (let attempt = 0; attempt <= retries; attempt++) {
    await throttle(origin, delay);
    try {
      const res = await fetch(url, {
        headers: { "user-agent": USER_AGENT, accept: "application/json, text/html", ...headers },
        signal: AbortSignal.timeout(timeoutMs),
      });

      // Back off and retry on rate limits and transient server errors.
      if (res.status === 429 || res.status >= 500) {
        lastError = new Error(`HTTP ${res.status} for ${url}`);
        const retryAfter = Number(res.headers.get("retry-after")) * 1000;
        await new Promise((r) =>
          setTimeout(r, Number.isFinite(retryAfter) && retryAfter > 0
            ? retryAfter
            : delay * 2 ** attempt),
        );
        continue;
      }
      return res;
    } catch (error) {
      lastError = error;
      await new Promise((r) => setTimeout(r, delay * 2 ** attempt));
    }
  }
  throw lastError instanceof Error ? lastError : new Error(`Failed to fetch ${url}`);
}

/** Response headers matter for paginated WordPress endpoints, so expose them. */
export async function fetchJsonWithMeta<T>(
  url: string,
  options?: FetchOptions,
): Promise<{ data: T; headers: Headers; status: number }> {
  const res = await politeFetch(url, options);
  if (!res.ok) throw new Error(`HTTP ${res.status} for ${url}`);
  const text = await res.text();
  try {
    const parsed = JSON.parse(text);
    // Some WordPress proxies double-encode their upstream payload.
    const data = (typeof parsed === "string" ? JSON.parse(parsed) : parsed) as T;
    return { data, headers: res.headers, status: res.status };
  } catch {
    throw new Error(`Expected JSON from ${url}, got: ${text.slice(0, 120)}`);
  }
}

export async function fetchJson<T>(url: string, options?: FetchOptions): Promise<T> {
  return (await fetchJsonWithMeta<T>(url, options)).data;
}

export async function fetchText(url: string, options?: FetchOptions): Promise<string> {
  const res = await politeFetch(url, options);
  if (!res.ok) throw new Error(`HTTP ${res.status} for ${url}`);
  return res.text();
}
