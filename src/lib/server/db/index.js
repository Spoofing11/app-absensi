import mysql from "mysql2/promise";
import { drizzle } from "drizzle-orm/mysql2";
import { env } from "../env.js";
import * as schema from "./schema/index.js";

const globalForDb = globalThis;

function createPool() {
  return mysql.createPool({
    uri: env.DATABASE_URL,
    connectionLimit: 10,
    timezone: "Z",
    charset: "utf8mb4",
  });
}

const pool = globalForDb.__absensiMysqlPool ?? createPool();

if (env.NODE_ENV !== "production") {
  globalForDb.__absensiMysqlPool = pool;
}

export const db = drizzle(pool, { schema, mode: "default" });
export { pool };
