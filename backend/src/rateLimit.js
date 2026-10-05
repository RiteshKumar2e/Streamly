// Small in-memory rate limiting helpers (token bucket). No external dependencies.
//
// - TokenBucket: one bucket, e.g. per socket per event (garbage-collected with the socket).
// - createKeyedLimiter: buckets keyed by string (e.g. client IP) with periodic cleanup so the
//   map does not grow without bound.
// - createConnectionCounter: concurrent-connection counter keyed by IP.
// - clientIpFromSocket: real client IP behind a proxy (Render) for Socket.IO handshakes.

/**
 * Token bucket allowing `limit` events per `windowMs`, refilling continuously.
 * A burst of `limit` is allowed, after which events are admitted at limit/windowMs.
 */
export class TokenBucket {
  constructor(limit, windowMs, now = Date.now()) {
    this.limit = limit;
    this.ratePerMs = limit / windowMs;
    this.tokens = limit;
    this.last = now;
  }

  refill(now) {
    if (now > this.last) {
      this.tokens = Math.min(this.limit, this.tokens + (now - this.last) * this.ratePerMs);
      this.last = now;
    }
  }

  /** Consume one token. Returns true if allowed. */
  take(now = Date.now()) {
    this.refill(now);
    if (this.tokens >= 1) {
      this.tokens -= 1;
      return true;
    }
    return false;
  }

  /** Milliseconds until one token is available. */
  retryAfterMs(now = Date.now()) {
    this.refill(now);
    return this.tokens >= 1 ? 0 : Math.ceil((1 - this.tokens) / this.ratePerMs);
  }

  /** True when the bucket is full again (safe to forget). */
  isIdle(now = Date.now()) {
    this.refill(now);
    return this.tokens >= this.limit;
  }
}

function every(ms, fn) {
  const t = setInterval(fn, ms);
  t.unref?.();
  return t;
}

/**
 * Keyed limiter: `limit` events per `windowMs` per key.
 * `hit(key)` returns { ok:true } or { ok:false, retryAfterMs }.
 */
export function createKeyedLimiter({ limit, windowMs, maxKeys = 50000 }) {
  /** @type {Map<string, TokenBucket>} */
  const buckets = new Map();

  every(Math.max(10000, windowMs), () => {
    const now = Date.now();
    for (const [key, bucket] of buckets) {
      if (bucket.isIdle(now)) buckets.delete(key);
    }
  });

  return {
    hit(key) {
      const now = Date.now();
      let bucket = buckets.get(key);
      if (!bucket) {
        // Hard cap: under a huge key flood, drop the oldest entry (Map keeps insertion order).
        if (buckets.size >= maxKeys) buckets.delete(buckets.keys().next().value);
        bucket = new TokenBucket(limit, windowMs, now);
        buckets.set(key, bucket);
      }
      if (bucket.take(now)) return { ok: true, retryAfterMs: 0 };
      return { ok: false, retryAfterMs: bucket.retryAfterMs(now) };
    },
    size: () => buckets.size,
  };
}

/** Express middleware: 429 { error:'RATE_LIMITED' } with Retry-After (seconds). */
export function rateLimitMiddleware(opts) {
  const limiter = createKeyedLimiter(opts);
  return (req, res, next) => {
    const r = limiter.hit(req.ip || req.socket?.remoteAddress || 'unknown');
    if (r.ok) return next();
    res.set('Retry-After', String(Math.max(1, Math.ceil(r.retryAfterMs / 1000))));
    res.status(429).json({ error: 'RATE_LIMITED' });
  };
}

/** Counts concurrent connections per key. Entries are removed when they reach zero. */
export function createConnectionCounter(max) {
  /** @type {Map<string, number>} */
  const counts = new Map();
  return {
    /** Try to add a connection; returns false if `key` is already at the limit. */
    acquire(key) {
      const n = counts.get(key) || 0;
      if (n >= max) return false;
      counts.set(key, n + 1);
      return true;
    },
    release(key) {
      const n = (counts.get(key) || 0) - 1;
      if (n > 0) counts.set(key, n);
      else counts.delete(key);
    },
    count: (key) => counts.get(key) || 0,
  };
}

/** Client IP for a Socket.IO socket: first X-Forwarded-For entry (Render proxy), else peer address. */
export function clientIpFromSocket(socket) {
  const xff = socket.handshake?.headers?.['x-forwarded-for'];
  const first = (Array.isArray(xff) ? xff[0] : xff || '').split(',')[0].trim();
  return first || socket.handshake?.address || socket.conn?.remoteAddress || 'unknown';
}
