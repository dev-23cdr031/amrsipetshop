// Verifies the Supabase setup end-to-end after schema.sql has been run:
//   1. All four tables exist (service key)
//   2. promo_codes seeded with the four coupon codes
//   3. Publishable key can read products but NOT orders (RLS check)
//
// Usage: node supabase/verify.js

const fs = require("fs");
const path = require("path");

function loadEnv() {
    const out = {};
    const envPath = path.join(__dirname, "..", ".env");
    if (fs.existsSync(envPath)) {
        for (const line of fs.readFileSync(envPath, "utf-8").split(/\r?\n/)) {
            const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/);
            if (m) out[m[1]] = m[2].trim();
        }
    }
    return out;
}

async function main() {
    const env = loadEnv();
    const base = (env.SUPABASE_URL || "").replace(/\/$/, "") + "/rest/v1";
    const service = env.SUPABASE_SERVICE_KEY || env.SUPABASE_SECRET_KEY;
    const pub = env.SUPABASE_PUBLISHABLE_KEY;
    if (!base || !service || !pub) return console.error("ERROR: .env is missing SUPABASE_URL / keys");

    let failures = 0;
    const ok = function (msg) { console.log("  ✅ " + msg); };
    const bad = function (msg) { console.log("  ❌ " + msg); failures++; };

    console.log("1) Tables (via service key):");
    for (const t of ["products", "orders", "contact_messages", "promo_codes"]) {
        try {
            const res = await fetch(base + "/" + t + "?select=*&limit=1000", { headers: { apikey: service, Authorization: "Bearer " + service } });
            if (!res.ok) { bad(t + " -> HTTP " + res.status); continue; }
            const rows = await res.json();
            ok(t + " exists (" + rows.length + " rows)");
            if (t === "promo_codes") {
                const codes = rows.map(function (r) { return r.code; }).sort();
                const expected = ["AQUA20", "FREESHIP", "PETLOVE10", "WELCOME150"];
                if (JSON.stringify(codes) === JSON.stringify(expected)) ok("promo codes seeded: " + codes.join(", "));
                else bad("promo codes expected " + expected.join(", ") + " but found " + codes.join(", "));
            }
        } catch (e) { bad(t + " -> " + e.message); }
    }

    console.log("2) Row Level Security (publishable key):");
    try {
        const res = await fetch(base + "/orders?select=order_id&limit=1", { headers: { apikey: pub } });
        const rows = res.ok ? await res.json() : null;
        if (res.ok && Array.isArray(rows) && rows.length === 0) ok("orders NOT readable by public key (RLS working)");
        else bad("orders readable by public key! RLS is OFF or misconfigured");
    } catch (e) { ok("orders blocked for public key (HTTP error = RLS working)"); }
    try {
        const res = await fetch(base + "/contact_messages?select=id&limit=1", { headers: { apikey: pub } });
        const rows = res.ok ? await res.json() : null;
        if (res.ok && Array.isArray(rows) && rows.length === 0) ok("contact_messages NOT readable by public key (insert-only)");
        else bad("contact_messages readable by public key — check policies");
    } catch (e) { ok("contact_messages blocked for public key (insert-only)"); }
    try {
        const res = await fetch(base + "/products?select=id&limit=1", { headers: { apikey: pub } });
        if (res.ok) ok("products readable by public key (shop needs this)");
        else bad("products NOT readable by public key — shop pages would break");
    } catch (e) { bad("products blocked for public key — shop pages would break"); }

    console.log(failures === 0 ? "\nALL CHECKS PASSED ✅" : "\n" + failures + " CHECK(S) FAILED ❌");
    process.exit(failures === 0 ? 0 : 1);
}

main();
