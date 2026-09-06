// Apply / verify the "add updated_at to orders" migration.
//
// This script has two modes:
//
//   A) APPLY MODE (needs the DB password):
//        SUPABASE_DB_PASSWORD=<password> node supabase/migrate-orders.js
//      connects directly to the project's Postgres database and runs the
//      migration SQL (adds updated_at to orders so the auto-update trigger
//      stops failing with 42703). Reads SUPABASE_URL and optionally the
//      password from .env.
//
//   B) CHECK MODE:  node supabase/migrate-orders.js
//      checks whether public.orders has the updated_at column and, if not,
//      prints the exact SQL to paste into the Supabase Dashboard SQL Editor.
//
// Usage:
//   node supabase/migrate-orders.js
//   SUPABASE_DB_PASSWORD=xxx node supabase/migrate-orders.js

const supabase = require("../supabase.js");
const fs = require("fs");
const path = require("path");

const MIGRATION = path.join(__dirname, "migrations", "002_add_orders_updated_at.sql");

function loadEnv() {
    const out = {};
    const envPath = path.join(__dirname, "..", ".env");
    if (fs.existsSync(envPath)) {
        for (const line of fs.readFileSync(envPath, "utf-8").split(/\r?\n/)) {
            const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/);
            if (m && m[1]) out[m[1]] = m[2].trim();
        }
    }
    return out;
}

async function columnExists() {
    try {
        // Ask PostgREST for the updated_at column on a non-existent order.
        // If the column is missing we get a 42703 error; if present we get 200 + [].
        await supabase.sb("/orders?select=updated_at&order_id=eq.__nosuchorder__&limit=1");
        return true;
    } catch (e) {
        if (/42703|field "updated_at" not found|could not find the.*updated_at/i.test(e.message)) return false;
        console.warn("  (column check returned an unexpected error, treating as missing)\n  ", e.message);
        return false;
    }
}

async function applyWithPg(password, ref) {
    const { Client } = require("pg");
    const sql = fs.readFileSync(MIGRATION, "utf-8").replace(/^--.*$/gm, ""); // strip comments before executing

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
    if (!client) return console.error("ERROR: could not connect with the provided password.");

    try {
        await client.query(sql);
        console.log("\nMigration applied successfully — orders.updated_at column added.");
    } catch (err) {
        console.error("Migration SQL failed:", err.message);
    } finally {
        await client.end();
    }
}

async function printInstructions() {
    console.log("Run the SQL below in your Supabase Dashboard -> SQL Editor -> New query -> Run:\n");
    console.log("------------------------------------------------------------");
    console.log(fs.readFileSync(MIGRATION, "utf-8"));
    console.log("------------------------------------------------------------\n");
}

async function main() {
    console.log("=== ORDERS updated_at MIGRATION ===\n");
    const has = await columnExists();
    if (has) {
        console.log("OK: public.orders already has an updated_at column.");
        console.log("Order status updates now persist in Supabase.");
        process.exit(0);
    }

    console.log("MISSING: public.orders has no updated_at column.");
    console.log("This is why admin order-status updates fail with:\n");
    console.log('  record "new" has no field "updated_at"\n');

    // Try to apply directly if we have the DB password (env var wins over .env)
    const env = Object.assign(loadEnv(), process.env);
    const url = env.SUPABASE_URL || "";
    const ref = (String(url).match(/https:\/\/([a-z0-9]+)\.supabase\.co/) || [])[1];
    const password = env.SUPABASE_DB_PASSWORD;

    if (ref && password) {
        await applyWithPg(password, ref);
        const nowHas = await columnExists();
        if (nowHas) {
            console.log("\nVerification passed — the column now exists. Status updates will persist in Supabase.\n");
            process.exit(0);
        }
        console.log("\nMigration did not take effect yet — see options below.\n");
    } else {
        console.log("No SUPABASE_DB_PASSWORD set — cannot apply automatically.\n");
    }

    await printInstructions();
    console.log('After running it, re-run "node supabase/migrate-orders.js" to confirm.');
    console.log('Or set SUPABASE_DB_PASSWORD (env var or .env) and re-run to auto-apply.');
    process.exit(1);
}

main().catch(function (e) {
    console.error("Script failed:", e.message);
    process.exit(1);
});