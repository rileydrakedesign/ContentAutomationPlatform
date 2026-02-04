import IORedis from "ioredis";

let _connection: IORedis | null = null;

export function getConnection(): IORedis {
  if (!_connection) {
    const redisUrl = process.env.REDIS_URL || "redis://localhost:6379";
    _connection = new IORedis(redisUrl, { maxRetriesPerRequest: null });
  }
  return _connection;
}
