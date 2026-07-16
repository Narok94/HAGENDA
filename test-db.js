import { neon } from "@neondatabase/serverless";
import dotenv from "dotenv";
dotenv.config();

async function test() {
  console.log("Connecting to:", process.env.DATABASE_URL);
  try {
    const sql = neon(process.env.DATABASE_URL);
    const res = await sql`SELECT 1`;
    console.log("Success:", res);
  } catch (err) {
    console.error("Error:", err);
  }
}
test();
