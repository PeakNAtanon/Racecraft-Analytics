import { createHash } from "node:crypto";
import { createRequire } from "node:module";

type RedisClient = {
  isReady: boolean;
  on(event: "error", listener: (error: unknown) => void): RedisClient;
  connect(): Promise<unknown>;
  disconnect(): Promise<void>;
  get(key: string): Promise<string | null>;
  set(key: string, value: string, options: { EX: number }): Promise<unknown>;
};

type RedisModule = {
  createClient(options: {
    url?: string;
    socket: { connectTimeout: number; reconnectStrategy: () => false };
  }): RedisClient;
};

const require = createRequire(import.meta.url);
const redis = require("redis") as RedisModule;

const RETRY_AFTER_MS = 30_000;
const MAX_VALUE_BYTES = 4 * 1024 * 1024;
let client: RedisClient | undefined;
let connection: Promise<RedisClient | undefined> | undefined;
let disabledUntil = 0;
let warningShown = false;

export function redisCacheConfigured() {
  return Boolean(process.env.REDIS_URL?.trim());
}

export function redisCacheKey(namespace: string, value: string) {
  const digest = createHash("sha256").update(value).digest("hex").slice(0, 32);
  return `racecraft:v1:${namespace}:${digest}`;
}

function disableRedis(error: unknown) {
  disabledUntil = Date.now() + RETRY_AFTER_MS;
  if (!warningShown) {
    console.warn("Redis cache unavailable; falling back to the in-process cache.", error instanceof Error ? error.message : error);
    warningShown = true;
  }
  const current = client;
  client = undefined;
  if (current) void current.disconnect().catch(() => undefined);
}

async function getRedisClient(): Promise<RedisClient | undefined> {
  if (!redisCacheConfigured() || disabledUntil > Date.now()) return undefined;
  if (client?.isReady) return client;
  if (connection) return connection;

  const next = redis.createClient({
    url: process.env.REDIS_URL,
    socket: { connectTimeout: 1500, reconnectStrategy: () => false },
  });
  next.on("error", error => disableRedis(error));
  connection = next.connect()
    .then(() => {
      client = next;
      disabledUntil = 0;
      warningShown = false;
      return next;
    })
    .catch(error => {
      disableRedis(error);
      return undefined;
    })
    .finally(() => {
      connection = undefined;
    });
  return connection;
}

export async function redisCacheGet<T>(key: string): Promise<T | undefined> {
  const redis = await getRedisClient();
  if (!redis) return undefined;
  try {
    const value = await redis.get(key);
    return value ? JSON.parse(value) as T : undefined;
  } catch (error) {
    disableRedis(error);
    return undefined;
  }
}

export async function redisCacheSet<T>(key: string, value: T, ttlSeconds: number) {
  const payload = JSON.stringify(value);
  if (Buffer.byteLength(payload, "utf8") > MAX_VALUE_BYTES) return false;
  const redis = await getRedisClient();
  if (!redis) return false;
  try {
    await redis.set(key, payload, { EX: ttlSeconds });
    return true;
  } catch (error) {
    disableRedis(error);
    return false;
  }
}
