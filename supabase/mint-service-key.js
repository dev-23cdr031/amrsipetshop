// Mints legacy-style service_role/anon JWTs from the project's JWT secret
// (Dashboard → Project Settings → API → JWT Settings) and live-tests them
// against the REST API.
//
// Usage: SUPABASE_JWT_SECRET=<value from dashboard> node supabase/mint-service-key.js
// The secret in the dashboard is base64-encoded; it is decoded to raw bytes
// before being used as the HMAC key (matching how Supabase signs keys).

const crypto = require("crypto");
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

function b64url(buf) {
    return buf.toString("base64").replace(/=/g, "").replace(/\+/g, "-").replace(/\//g, "_");
}

function mintJwt(secretB64, role, ref) {
    const iat = Math.floor(Date.now() / 1000);
    const header = b64url(Buffer.from(JSON.stringify({ alg: "HS256", typ: "JWT" })));
    const payload = b64url(Buffer.from(JSON.stringify({ role, iss: "supabase", ref, iat, exp: iat + 315360000 })));
    const key = Buffer.from(secretB64, "base64");
    const sig = b64url(crypto.createHmac("sha256", key).update(header + "." + payload).digest());
    return header + "." + payload + "." + sig;
}

async function test(label, url, jwt) {
    try {
        const res = await fetch(url, { headers: { apikey: jwt, Authorization: "Bearer " + jwt } });
        const body = await res.text();
        console.log(label + " -> " + res.status + " " + body.slice(0, 120));
    } catch (e) {
        console.log(label + " -> NETWORK ERROR " + e.message);
    }
}

async function main() {
    const env = Object.assign(loadEnv(), process.env);
    const secret = env.SUPABASE_JWT_SECRET;
    const ref = (env.SUPABASE_URL || "").match(/https:\/\/([a-z0-9]+)\.supabase\.co/);
    if (!secret) return console.error("ERROR: SUPABASE_JWT_SECRET not set");
    if (!ref) return console.error("ERROR: SUPABASE_URL missing/invalid in .env");

    const base = "https://" + ref[1] + ".supabase.co/rest/v1";
    const serviceKey = mintJwt(secret, "service_role", ref[1]);
    const anonKey = mintJwt(secret, "anon", ref[1]);

    console.log("SERVICE_ROLE key:");
    console.log(serviceKey);
    console.log("");
    await test("REST root (service_role):      ", base + "/", serviceKey);
    await test("REST promo_codes (service_role):", base + "/promo_codes", serviceKey);
    await test("REST root (anon):               ", base + "/", anonKey);
    console.log("");
    console.log("ANON key (kept for reference):");
    console.log(anonKey);
}

main();
