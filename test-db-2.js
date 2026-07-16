import { neon } from "@neondatabase/serverless";
import dotenv from "dotenv";
dotenv.config();

async function test() {
  const sql = neon(process.env.DATABASE_URL);
  try {
    const res = await sql`SELECT * FROM tasks`;
    console.log("Tasks table exists. Rows:", res.length);
  } catch (err) {
    console.error("Error:", err);
  }
}
test();
