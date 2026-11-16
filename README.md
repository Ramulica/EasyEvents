# EasyEvents

Shared event companion for camps, parties, and multi-activity weekends.

One Expo codebase → **iOS / Android / Web**, with **Supabase** as the shared database.

## Multi-tenant memberships

Each membership account owns a **tenant workspace**:

- Signup creates a personal tenant (`free` plan for now)
- Events belong to that tenant (`events.tenant_id`)
- Hosts only manage events inside their workspace
- Guests still join with an event **code** (no tenant login needed)
- Ready for paid plans later (`tenants.plan`: `free` | `pro` | `enterprise`)

Run this migration in the Supabase SQL Editor after older schema/fixes:

`supabase/fix_tenants.sql`

## 1. Create a free Supabase project

1. Go to [https://supabase.com](https://supabase.com) and create a project
2. Open **SQL Editor** → run `supabase/schema.sql`, then any `supabase/fix_*.sql` you need (including `fix_tenants.sql`)
3. Enable anonymous guests: **Authentication → Providers → Anonymous → Enable**
4. For easy testing, turn **Confirm email** Off
5. Copy Project URL + `anon` key from **Project Settings → API**

## 2. Connect the app locally

```bash
cp .env.example .env
```

```env
EXPO_PUBLIC_SUPABASE_URL=https://xxxx.supabase.co
EXPO_PUBLIC_SUPABASE_ANON_KEY=eyJhbGciOi...
```

```bash
npm install
npm run web
```

## 3. Deploy web on Render

The web app exports as a SPA (`app.json` → `web.output: "single"`), which fits dynamic routes like `/event/[eventId]`.

### Option A — Blueprint (`render.yaml`)

1. Push this repo to GitHub
2. Render → **New → Blueprint** → select the repo
3. Set env vars (must be available at **build** time):
   - `EXPO_PUBLIC_SUPABASE_URL`
   - `EXPO_PUBLIC_SUPABASE_ANON_KEY`
4. Deploy

### Option B — Manual static site

1. Render → **New → Static Site**
2. Build command: `npm ci && npm run build:web`
3. Publish directory: `dist`
4. Add rewrite: `/*` → `/index.html`
5. Same two `EXPO_PUBLIC_*` env vars as above

### Local production check

```bash
npm run build:web
npm run serve:web
```

Open http://localhost:3000

## App flows

- **Member**: sign up → personal tenant workspace → create events → add people/roles → open event
- **Guest**: event code → password → pick name → optional user password
- **Manage**: people, chat mode, theme, activities, news
- **Account**: profile name + photo

## Notes

- Env vars prefixed with `EXPO_PUBLIC_` are baked into the web bundle at build time — change them on Render, then redeploy
- Supabase stays the backend; Render only hosts the static web client
- Mobile builds later: EAS (`eas build`) — separate from Render web hosting
