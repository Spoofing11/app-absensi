import dotenv from "dotenv";
import mysql from "mysql2/promise";
import { testUsers } from "./test-users.js";

dotenv.config({ path: ".env.local" });

export default async function globalTeardown() {
  const connection = await mysql.createConnection(process.env.DATABASE_URL);
  const usernames = testUsers.map((user) => user.username);

  await connection.query(
    `DELETE FROM users WHERE username IN (${usernames.map(() => "?").join(", ")})`,
    usernames,
  );

  console.log("Test users dibersihkan.");
  await connection.end();
}
