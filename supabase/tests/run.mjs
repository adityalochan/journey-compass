// Runs the schema + row-level-security tests on PGlite (Postgres compiled to WebAssembly), so no
// database server is needed.  Usage (from supabase/tests):  npm install && node run.mjs
import { PGlite } from "@electric-sql/pglite";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";

const root = fileURLToPath(new URL("../..", import.meta.url));
const db = new PGlite();
for (const f of ["supabase/tests/auth_stub.sql", "supabase/migrations/0001_schema.sql", "supabase/migrations/0002_coordinator_queue.sql", "supabase/migrations/0003_acceptance_rates.sql", "supabase/migrations/0004_next_steps_registration_url.sql", "supabase/migrations/0005_coordinator_people.sql", "supabase/migrations/0006_contact_details.sql", "supabase/tests/rls_test.sql"]) {
  try {
    const res = await db.exec(readFileSync(`${root}/${f}`, "utf8"));
    console.log(`ok   ${f}`);
    const last = res.at(-1);
    if (last?.rows?.length) console.log("     ", JSON.stringify(last.rows));
  } catch (e) {
    console.log(`FAIL ${f}: ${e.message}`);
    process.exit(1);
  }
}
