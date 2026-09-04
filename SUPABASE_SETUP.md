# Supabase Setup — AM SRI Petshop

Your Supabase keys are saved in `.env` (already git-ignored). Follow these steps
to finish setup.

## 1. Add your Project URL

Open `.env` and fill in `SUPABASE_URL` (copy it from
**Supabase Dashboard → Project Settings → API**):

```
SUPABASE_URL=https://xxxxxxxxxxxx.supabase.co
```

## 2. Create the tables

1. Open the **SQL Editor** in the Supabase Dashboard (left sidebar).
2. Click **New query**.
3. Copy the entire contents of [`supabase/schema.sql`](supabase/schema.sql), paste it, and click **Run**.

This creates four tables mirroring the app's current data model:

| Table              | Replaces                          | Notes                                        |
| ------------------ | --------------------------------- | -------------------------------------------- |
| `products`         | `data/products.js` + overrides    | `archived` flag built in, auto `updated_at`  |
| `orders`           | `data/orders.json`                | `items`/addresses stored as JSONB — same payload as today |
| `contact_messages` | in-memory `contactMessages` array | Survives server restarts                     |
| `promo_codes`      | `data/promo-codes.js`             | Seeded with PETLOVE10, WELCOME150, AQUA20, FREESHIP |

It also enables Row Level Security and registers `orders` on the Realtime
publication (a future replacement for the current SSE implementation).

## 3. Key usage rules

| Key | Where it may appear |
| --- | ------------------- |
| `SUPABASE_PUBLISHABLE_KEY` (`sb_publishable_...`) | Browser code (`public/*.js`), `@supabase/supabase-js` client |
| `SUPABASE_SECRET_KEY` (`sb_secret_...`) | **Server only** (`server.js`), environment variables. It bypasses Row Level Security |

The secret key is in `.env`, which `.gitignore` already excludes — never commit
it or embed it in a frontend file. Since it was shared in chat, consider
rotating it later (Dashboard → Project Settings → API → rotate keys).

## 4. Using the keys from Node (when you integrate)

```js
require("dotenv").config();           // npm i dotenv
const { createClient } = require("@supabase/supabase-js");  // npm i @supabase/supabase-js

// Server-side client — uses the secret key, bypasses RLS
const supabase = createClient(
    process.env.SUPABASE_URL,
    process.env.SUPABASE_SECRET_KEY,
    { auth: { persistSession: false } }
);
```

Nothing in the app uses Supabase yet — the Express server + JSON files keep
working exactly as before until you decide to migrate (step 4 above).

## 5. Connection status (verified 2026-09-04)

Live tests against `https://jqtsepqberrygocqciml.supabase.co`:

| Check | Result |
| --- | --- |
| Publishable key → REST data routes | ✅ accepted (PostgREST responded) |
| Publishable key → Auth health / Storage | ✅ 200 OK |
| Secret key → Storage | ✅ 200 OK |
| Secret key → REST / Auth | ❌ 401 `UNAUTHORIZED_INVALID_API_KEY_TYPE` |

**What `UNAUTHORIZED_INVALID_API_KEY_TYPE` means:** the key is valid and
belongs to this project (it authenticates fine on Storage), but the REST and
Auth services still require legacy JWT-based keys for elevated access. The
gateway maps the publishable key to the `anon` role automatically, but the
secret key is only accepted once the project's API-key migration is completed.

**Fix (pick one):**

1. *Project Settings → API Keys* → complete the **"Migrate API keys"** flow
   (final step disables legacy JWT keys). Afterwards `sb_secret_...` works on
   REST and Auth — no code changes needed.
2. Until then, copy the legacy **`service_role`** JWT (`eyJ...`) from the
   *Legacy API keys* section and use it as the server-side key in `.env`
   (same server-only rules apply).

Header rules for new-format keys: send them on the `apikey` header — not
`Authorization: Bearer` (they are not JWTs; anything verifying them as JWTs
fails).

## 6. Utilities

- `supabase/apply-schema.js` — applies `schema.sql` directly to Postgres:
  `node supabase/apply-schema.js` (needs `SUPABASE_DB_PASSWORD` in `.env`;
  uses the direct IPv6 connection, falls back to the session pooler).
- `supabase/mint-service-key.js` — re-derive legacy `service_role`/`anon`
  JWTs from the project JWT secret (Settings → API → JWT Settings):
  `SUPABASE_JWT_SECRET=<value> node supabase/mint-service-key.js`.
