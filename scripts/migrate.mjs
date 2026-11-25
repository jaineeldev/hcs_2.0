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

// Split on ";" — except inside $$ … $$ blocks (DO blocks / functions), whose
// bodies contain semicolons of their own and must run as one statement.
function splitStatements(sql) {
  const out = [];
  let current = "";
  let inDollar = false;
  for (let i = 0; i < sql.length; i++) {
    // Copy "--" comments through to end of line untouched, so a ";" inside a
    // comment never splits a statement.
    if (!inDollar && sql.startsWith("--", i)) {
      const end = sql.indexOf("\n", i);
      const stop = end === -1 ? sql.length : end;
      current += sql.slice(i, stop);
      i = stop - 1;
      continue;
    }
    if (sql.startsWith("$$", i)) {
      inDollar = !inDollar;
      current += "$$";
      i++;
      continue;
    }
    if (sql[i] === ";" && !inDollar) {
      out.push(current);
      current = "";
      continue;
    }
    current += sql[i];
  }
  out.push(current);
  // Drop chunks that are only comments/whitespace.
  return out.map((s) => s.trim()).filter((s) => s.replace(/--.*$/gm, "").trim());
}

const statements = splitStatements(schema);

for (const statement of statements) {
  await sql.query(statement);
  console.log("Ran:", statement.slice(0, 60).replace(/\s+/g, " ") + "…");
}

console.log("Migration complete.");
