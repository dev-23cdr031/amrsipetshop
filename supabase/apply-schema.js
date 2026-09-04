// Applies supabase/schema.sql to the project's Postgres database.
// Usage:  SUPABASE_DB_PASSWORD=<password> node supabase/apply-schema.js
// Reads SUPABASE_URL from .env to derive the database host.

const fs = require("fs");
const path = require("path");
const { Client } = require("pg");

// Minimal .env parser (no extra dependency needed)
function loadEnv() {
    const envPath = path.join(__dirname, "..", ".env");
    const out = {};
    if (fs.existsSync(envPath)) {
        for (const line of fs.readFileSync(envPath, "utf-8").split(/\r?\n/)) {
            const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/);
            if (m && m[1] !== undefined) out[m[1]] = m[2].trim();
        }
    }
    return out;
}

async function main() {
    const env = Object.assign(loadEnv(), process.env);
    const url = env.SUPABASE_URL || "";
    const ref = (url.match(/https:\/\/([a-z0-9]+)\.supabase\.co/) || [])[1];
    const password = env.SUPABASE_DB_PASSWORD;

    if (!ref) return console.error("ERROR: SUPABASE_URL missing or invalid in .env");
    if (!password) return console.error("ERROR: set SUPABASE_DB_PASSWORD (env var or in .env)");

    const sql = fs.readFileSync(path.join(__dirname, "schema.sql"), "utf-8");

    // Direct connection (IPv6). Falls back to the Supavisor session pooler.
    const configs = [
        { host: "db." + ref + ".supabase.co", port: 5432, user: "postgres", database: "postgres" },
        { host: "aws-0-ap-south-1.pooler.supabase.com", port: 5432, user: "postgres." + ref, database: "postgres" }
    ];

    let client = null;
    for (const cfg of configs) {
        try {
            console.log("Connecting to " + cfg.host + ":" + cfg.port + " as " + cfg.user + " ...");
            client = new Client(Object.assign({}, cfg, { password, ssl: { rejectUnauthorized: false } }));
            await client.connect();
            console.log("Connected.");
            break;
        } catch (err) {
            console.log("  failed: " + err.message);
            client = null;
        }
    }
    if (!client) return console.error("ERROR: could not connect with any configuration.");

    try {
        await client.query(sql);
        console.log("\nSchema applied successfully.");

        const { rows: tables } = await client.query(
            "select table_name from information_schema.tables where table_schema='public' order by table_name"
        );
        console.log("Tables in public schema:", tables.map(function (t) { return t.table_name; }).join(", "));

        const { rows: promos } = await client.query("select code from promo_codes order by code");
        console.log("Seeded promo codes:", promos.map(function (p) { return p.code; }).join(", "));
    } finally {
        await client.end();
    }
}

main().catch(function (err) {
    console.error("FAILED:", err.message);
    process.exit(1);
});
