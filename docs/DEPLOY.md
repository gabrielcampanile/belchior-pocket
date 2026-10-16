# Deploy (Vercel)

Production is a Vercel project connected to this GitHub repository: every push to `main`
deploys to production and every pull request gets a preview deployment.

## How the build works

- `vercel.json` pins the install (`npm ci`, the same lockfile CI uses) and the build
  (`npm run build`). The repo also has `bun.lock` for local development; without the pin
  Vercel could pick a different package manager and resolve different versions.
- The server is built by Nitro (`nitro/vite` in `vite.config.ts`). On Vercel, Nitro detects
  the platform and emits the Build Output API (`.vercel/output`): static assets plus one
  Node.js 22 function (`__server`) that serves SSR and the server functions.
- To reproduce locally: `NITRO_PRESET=vercel npm run build` (PowerShell:
  `$env:NITRO_PRESET='vercel'; npm run build`).

## Environment variables

Set them in Vercel → Project → Settings → Environment Variables, for **Production** and
**Preview**. Never commit them. Only `VITE_*` values reach the browser, so only public
values may use that prefix.

| Variable | Where it runs | What it is |
|---|---|---|
| `VITE_SUPABASE_URL` | browser | Supabase project URL |
| `VITE_SUPABASE_PUBLISHABLE_KEY` | browser | publishable key (public by design, RLS applies) |
| `SUPABASE_URL` | server | same URL, read by server code |
| `SUPABASE_PUBLISHABLE_KEY` | server | same publishable key, used by the auth middleware |
| `SUPABASE_SERVICE_ROLE_KEY` | server | secret key; bypasses RLS, used only by the sync |
| `PLUGGY_CLIENT_ID` | server | Pluggy application id |
| `PLUGGY_CLIENT_SECRET` | server | Pluggy application secret |
| `PLUGGY_ITEM_IDS` | server | `XP:<item-uuid>,Wise:<item-uuid>` |
| `PLUGGY_OWNER_USER_ID` | server | the only Supabase user allowed to sync these items |

`VITE_*` values are inlined at build time: changing one requires a redeploy.

## Supabase Auth

- Authentication → URL Configuration: set **Site URL** to the production URL and add to
  **Redirect URLs** the production URL and the preview pattern
  (`https://<project>-*-<team>.vercel.app/**`). Sign-in redirects back to
  `window.location.origin`, so a missing URL breaks Google sign-in on that domain.
- Authentication → Sign In / Providers: once your account exists, turn off
  **Allow new users to sign up**. RLS already isolates data and the sync only runs for
  `PLUGGY_OWNER_USER_ID`, but there is no reason to let strangers create accounts.

## Previews

Preview deployments use the same Supabase project and Pluggy credentials as production
(there is one household and one database). Keep Vercel's Deployment Protection on for
previews so only you can open them.

## Sync schedule

There is no server-side cron: the app syncs when it is opened (if the last sync is older
than 6 hours) and from "Sincronizar agora". Pluggy itself refreshes bank data about once a
day, so this matches the v1 requirement of daily or on-demand updates.
