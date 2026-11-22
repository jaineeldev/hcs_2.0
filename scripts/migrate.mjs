import { readFileSync } from "fs";
import { fileURLToPath } from "url";
import { dirname, join } from "path";
import { neon } from "@neondatabase/serverless";

const __dirname = dirname(fileURLToPath(import.meta.url));

if (!process.env.DATABASE_URL) {
  console.error("DATABASE_URL is not set. Run `vercel env pull` first.");
  process.exit(1);
}

const sql = neon(process.env.DATABASE_URL);
const schema = readFileSync(join(__dirname, "../db/schema.sql"), "utf8");

const statements = schema.split(";").map((s) => s.trim()).filter(Boolean);

for (const statement of statements) {
  await sql.query(statement);
  console.log("Ran:", statement.slice(0, 60).replace(/\s+/g, " ") + "…");
}

console.log("Migration complete.");
