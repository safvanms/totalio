# Deploying Spendly to Vercel

Spendly is one Next.js app. The pages (frontend) and the API routes (backend) deploy together as a single Vercel project. The only separate piece is the **database**.

| | Local | Vercel |
|---|---|---|
| Database | SQLite file (`prisma/dev.db`) | Hosted PostgreSQL (Neon) |
| Prisma schema | `prisma/schema.prisma` | `prisma/schema.postgres.prisma` |
| Build | `npm run build` | `npm run vercel-build` |

SQLite can't be used on Vercel because its servers don't keep files: data written to disk disappears between requests.

---

## What you need

- A **GitHub** account (free)
- A **Vercel** account (free *Hobby* plan works). Sign up at vercel.com with GitHub.
- **Git** installed (`git --version` to check)

---

## Step 1 – Put the code on GitHub

1. On github.com, click **New repository**. Name it `spendly`, make it **Private**, and do **not** add a README or .gitignore. Click **Create repository**.
2. In a terminal, run:

   ```bash
   cd c:\entries\spendly
   git init
   git add .
   git commit -m "Initial commit"
   git branch -M main
   git remote add origin https://github.com/<your-username>/spendly.git
   git push -u origin main
   ```

   `.gitignore` already keeps out `node_modules`, `.next`, `.env` and the local database.

---

## Step 2 – Create the Vercel project

1. On vercel.com, click **Add New… → Project**.
2. Find the `spendly` repo and click **Import**. If it's missing, click *Adjust GitHub App Permissions* and give Vercel access to it.
3. On the configure screen:
   - **Framework Preset:** Next.js (detected automatically)
   - **Root Directory:** `./`
   - Open **Build and Output Settings**, turn on the override for **Build Command**, and enter:
     ```
     npm run vercel-build
     ```
   - Leave Install Command and Output Directory as they are.
4. **Don't click Deploy yet.** The first deploy would fail because there's no database. If you already clicked it, that's fine: carry on, then redeploy in Step 5.

---

## Step 3 – Create the database (Neon Postgres via Vercel)

1. In the Vercel project, open the **Storage** tab, click **Create Database**, and choose **Neon** (Serverless Postgres).
2. Accept the terms. Pick the **Free** plan and a **region close to you** (e.g. *Singapore* or *Mumbai* for India). Click **Create**.
3. When asked which environments to connect, tick **Production, Preview and Development**, then click **Connect**.

Vercel now adds the connection strings as environment variables. With the Neon integration they are usually named `DATABASE_URL` (pooled) and `DATABASE_URL_UNPOOLED` (direct). Other `POSTGRES_*` / `PG*` variables may appear too; Spendly doesn't use those.

> **Without the integration:** create a project at neon.tech, open **Connection Details**, and copy two strings: one with **Connection pooling** on (the host contains `-pooler`), and one with it off.

---

## Step 4 – Set the environment variables

Go to **Project → Settings → Environment Variables**. Spendly needs exactly these two:

| Name | Value | Environments |
|---|---|---|
| `DATABASE_URL` | the **pooled** string (host contains `-pooler`) | Production, Preview |
| `DIRECT_URL` | the **direct** string (no `-pooler`), i.e. the value of `DATABASE_URL_UNPOOLED` | Production, Preview |

- If the integration already created `DATABASE_URL`, keep it. Click **Add New**, name it `DIRECT_URL`, and paste the value of `DATABASE_URL_UNPOOLED` (click the eye icon to reveal it).
- Both strings should end with `?sslmode=require`.

Why two? The app runs on serverless functions that open many short connections, so they go through the pooler. Schema changes (`prisma db push`) need a direct connection.

---

## Step 5 – Deploy

- If you haven't deployed yet: **Deployments → Create Deployment** (or push any commit).
- If the first deploy failed: open **Deployments**, click **⋯** on the latest one, and choose **Redeploy**.

During the build, `npm run vercel-build` will:
1. generate the Prisma client for PostgreSQL,
2. create or update the tables in Neon (`prisma db push`), which is safe to run on every deploy,
3. build Next.js.

When it finishes, click **Visit**. You'll get a URL like `https://spendly-xxxx.vercel.app`.

---

## Step 6 – Add your data

The production database starts empty. Choose one:

- **Move your local data (recommended):** locally, go to **Settings → Export data → JSON** (or CSV/Excel). On the live site, go to **Settings → Import data**, choose the file, then **Replace everything**. Categories, formulas, expenses and settings come across exactly.
- **Demo data:** on the live site, go to **Settings → Load sample data**.
- **Start empty:** just begin adding categories.

---

## Step 7 – Check it works

On the live URL:
1. **Dashboard** shows cards and charts (or empty states if you started empty).
2. **Add an expense** with the top-right button, then refresh the page. It should still be there, which proves the database is connected.
3. **Formula Builder**: drag two categories in and save. The calculated category should appear in **Categories**.
4. **Expense history**: search for a word in a particular. Matching is case-insensitive.

---

## Step 8 – Protect it (important)

**Spendly has no login.** Anyone who has the URL can view, change, export or delete all your data.

- Go to **Project → Settings → Deployment Protection** and turn on the strongest option your plan allows (e.g. *Vercel Authentication*, so only you, logged in to Vercel, can open it). Options differ between the Hobby and Pro plans, so check what applies to your production URL.
- Don't share the URL publicly until proper sign-in is added to the app.

---

## Optional

- **Custom domain:** Project → Settings → **Domains** → **Add**, then follow the DNS instructions.
- **Function region:** Project → Settings → **Functions** → set the region to the same one as your Neon database. This makes every page noticeably faster.
- **Automatic deploys:** every `git push` to `main` redeploys production. Pushes to other branches get their own preview URLs.

---

## Updating the app later

```bash
git add .
git commit -m "Describe the change"
git push
```

Vercel builds and deploys automatically.

**If you change the data model:** make the same change in **both** `prisma/schema.prisma` and `prisma/schema.postgres.prisma`; only their `datasource` blocks differ. The next deploy applies it. If a change would delete data (e.g. dropping a column), `prisma db push` stops the build instead of losing data. Export a backup first, then handle that change deliberately.

---

## Troubleshooting

| Symptom | Cause / fix |
|---|---|
| Build fails: `Environment variable not found: DIRECT_URL` | Add `DIRECT_URL` (Step 4), then redeploy. |
| Build fails: `Can't reach database server` | Wrong or expired connection string, or a missing `?sslmode=require`. Copy it again from Neon/Storage. |
| Pages load but show "Couldn't load this data" | Check **Deployments → (latest) → Functions/Logs**. Usually `DATABASE_URL` is missing for that environment (Production vs Preview). |
| Build fails: `data loss` warning from `prisma db push` | A schema change would delete data. See *Updating the app later*. |
| Import of a very large file fails | Vercel limits request bodies to about 4.5 MB. Split the file (e.g. by year) and import each part with **Merge**. |
| Search is case-sensitive in production | `DATABASE_URL` must start with `postgres://` or `postgresql://`; the app uses that to switch on case-insensitive search. |

---

## Running against the production database from your computer (advanced)

You normally don't need this. In PowerShell:

```powershell
$env:DATABASE_URL = "<pooled string>"
$env:DIRECT_URL   = "<direct string>"
npm run db:push:prod     # create/update tables
npm run db:seed:prod     # REPLACES all data with the sample dataset
Remove-Item Env:DATABASE_URL, Env:DIRECT_URL
```
