# Deploying Totalio to Vercel

Totalio is one Next.js app. The pages (frontend) and the API routes (backend) deploy together as a single Vercel project. The only separate piece is the **database**.

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

1. On github.com, click **New repository**. Name it `totalio`, make it **Private**, and do **not** add a README or .gitignore. Click **Create repository**.
2. In a terminal, run:

   ```bash
   cd c:\entries\spendly
   git init
   git add .
   git commit -m "Initial commit"
   git branch -M main
   git remote add origin https://github.com/<your-username>/totalio.git
   git push -u origin main
   ```

   `.gitignore` already keeps out `node_modules`, `.next`, `.env` and the local database.

---

## Step 2 – Create the Vercel project

1. On vercel.com, click **Add New… → Project**.
2. Find the `totalio` repo and click **Import**. If it's missing, click *Adjust GitHub App Permissions* and give Vercel access to it.
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

Vercel now adds the connection strings as environment variables. With the Neon integration they are usually named `DATABASE_URL` (pooled) and `DATABASE_URL_UNPOOLED` (direct). Other `POSTGRES_*` / `PG*` variables may appear too; Totalio doesn't use those.

> **Without the integration:** create a project at neon.tech, open **Connection Details**, and copy two strings: one with **Connection pooling** on (the host contains `-pooler`), and one with it off.

---

## Step 4 – Set the environment variables

**With the Neon integration from Step 3, there is nothing to do here.** The build script (`scripts/vercel-build.mjs`) and the app pick up the variables the integration created:

| Totalio uses | Taken from (first one that exists) |
|---|---|
| `DATABASE_URL` (pooled) | `DATABASE_URL`, `POSTGRES_PRISMA_URL`, `POSTGRES_URL` |
| `DIRECT_URL` (direct) | `DIRECT_URL`, `DATABASE_URL_UNPOOLED`, `POSTGRES_URL_NON_POOLING`, else the pooled URL |

The build log prints which names it used (`• Database (pooled) : …`), never the values.

**Using your own Neon/Supabase project instead?** In **Project → Settings → Environment Variables**, add `DATABASE_URL` (pooled string, host contains `-pooler`) and optionally `DIRECT_URL` (direct string), both for **Production and Preview**, and both ending in `?sslmode=require`.

> Variables only apply to **new** deployments. After adding or changing one, redeploy.

Why two? The app runs on serverless functions that open many short connections, so they go through the pooler. Schema changes (`prisma db push`) need a direct connection.

---

## Step 5 – Deploy

- If you haven't deployed yet: **Deployments → Create Deployment** (or push any commit).
- If the first deploy failed: open **Deployments**, click **⋯** on the latest one, and choose **Redeploy**.

During the build, `npm run vercel-build` will:
1. generate the Prisma client for PostgreSQL,
2. create or update the tables in Neon (`prisma db push`), which is safe to run on every deploy,
3. build Next.js.

When it finishes, click **Visit**. You'll get a URL like `https://totalio-xxxx.vercel.app`.

---

## Step 6 – Create your account and add your data

Open the live URL. You'll land on **Sign in**. Click **Create an account**.

> **Sign up straight away.** The *first* account created on a site takes ownership of any data that was stored before accounts existed (see *Upgrading a site that had no accounts* below). On a brand-new database there's nothing to claim, but it's still good to be first.

Each account sees **only its own** categories, expenses, formulas and settings. Then choose one:

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

## Step 8 – Accounts & sign-ups

Totalio requires sign-in. Every person creates their own account, and data is completely separate per account; the server checks ownership on every request.

**Who can sign up?** By default, anyone with the URL can create an account (and sees only their own, empty data). To make the site **invite-free / private** after you and your family or team have signed up:

1. Go to **Project → Settings → Environment Variables** and add `ALLOW_SIGNUPS` = `false` (Production and Preview).
2. Redeploy.

The sign-up page then says sign-ups are closed. Existing accounts keep working. (The very first account can always be created, so a fresh deployment never locks you out.) Set it back to `true` to reopen.

**Account management** (each user, under **Settings → Account**): change name, change password (signs out other devices), sign out of other devices, delete account (removes all of that user's data).

**Forgotten passwords:** there's no email-based reset yet, because that needs an email-sending service. Until then, an affected user can create a new account. Their old data stays tied to the old account, so encourage everyone to keep an export as a backup.

**Security details:**
- Passwords are hashed with scrypt.
- Sessions use HttpOnly, Secure, SameSite cookies and last 30 days, renewed while in use.
- Five wrong passwords lock an account for 15 minutes.
- Cross-site requests are rejected.

---

## Optional

- **Custom domain:** see *Connecting your domain* below.
- **Function region:** Project → Settings → **Functions** → set the region to the same one as your Neon database. This makes every page noticeably faster.
- **Automatic deploys:** every `git push` to `main` redeploys production. Pushes to other branches get their own preview URLs.

---

## Connecting your domain

1. In Vercel, go to **Project → Settings → Domains**, enter your domain (e.g. `totalio.app`), and click **Add**. Add the `www.` version too if you want it; Vercel offers to redirect one to the other.
2. Vercel shows the exact DNS records to create, usually:
   - an **A** record for the root domain (`@`), and
   - a **CNAME** record for `www`.

   Copy the values **from the Vercel screen**, since they can differ per project.
3. At your domain registrar (GoDaddy, Namecheap, Hostinger, Cloudflare, …), open the domain's **DNS settings**, add those records, and remove any older A/CNAME records for `@` or `www` that point elsewhere.
4. Wait for the Domains page to show **Valid Configuration**. This takes minutes to a few hours. The HTTPS certificate is issued automatically.

If you bought the domain through Vercel, there's nothing to configure; just add it to the project.

## Renaming an existing deployment (was "Spendly")

If you deployed before the app was renamed to Totalio, none of this is required; the app works either way. For tidiness:

- **GitHub repo:** on GitHub, go to repo **Settings → General → Repository name**, change it to `totalio`, and click **Rename**. GitHub redirects the old URL, but update your local remote:
  ```bash
  git remote set-url origin https://github.com/<your-username>/totalio.git
  ```
  Vercel follows the rename automatically.
- **Vercel project:** go to **Project → Settings → General → Project Name** and set it to `totalio`. The `*.vercel.app` URL changes; a custom domain doesn't.
- **Your data is unaffected:** the database is the same. Export files made under the old name still import.

## Upgrading a site that had no accounts

If you deployed an earlier version (before sign-in existed), your production database already contains data that belongs to nobody. Deploying this version is safe: the database change only **adds** tables and columns, and nothing is deleted.

1. **Optional but recommended:** before deploying, open the live site and go to **Settings → Export data → JSON** to keep a copy.
2. Push the new code. Vercel builds and upgrades the database automatically.
3. **Immediately** open the site and **create your account**. As the first account, it automatically takes ownership of all existing categories, expenses and settings.
4. Other people can then sign up and will start with empty accounts.

If someone else managed to sign up first, they now own that data. In that case, delete that account (sign in as it, then **Settings → Delete account**), create yours, and import the JSON export from step 1.

## Updating the app later

```bash
git add .
git commit -m "Describe the change"
git push
```

Vercel builds and deploys automatically.

**If you change the data model:** edit `prisma/schema.prisma`, then run `npm run schema:sync` to regenerate the production schema, and commit both files. The next deploy applies it. If a change would delete data (e.g. dropping a column), `prisma db push` stops the build instead of losing data. Export a backup first, then handle that change deliberately.

---

## Troubleshooting

| Symptom | Cause / fix |
|---|---|
| Build fails: `Environment variable not found: DIRECT_URL` | You're on an old build script. Pull the latest code (`scripts/vercel-build.mjs`), or add `DIRECT_URL` manually, then redeploy. |
| Build fails: `No database connection string found` | The database isn't connected to this environment. Go to Storage → your database → **Connect Project**, tick Production and Preview, then redeploy. |
| Build fails: `Can't reach database server` | Wrong or expired connection string, or a missing `?sslmode=require`. Copy it again from Neon/Storage. |
| Pages load but show "Couldn't load this data" | Check **Deployments → (latest) → Functions/Logs**. Usually `DATABASE_URL` is missing for that environment (Production vs Preview). |
| Build log shows `There might be data loss…` but continues | Normal when new unique constraints are added. They can't delete data, so the build applies them automatically (`• All N warning(s) are new unique constraints…`). |
| Build fails: `Database update stopped … could remove or alter existing data` | A schema change would really delete or change data. Nothing was applied. Export a backup, then handle that change deliberately (see *Updating the app later*). |
| Import of a very large file fails | Vercel limits request bodies to about 4.5 MB. Split the file (e.g. by year) and import each part with **Merge**. |
| Every page sends me back to Sign in | Cookies are blocked for the site, or you're opening it over plain `http://` in production (the session cookie requires HTTPS). Use the `https://` URL. |
| "Too many failed attempts" | Five wrong passwords lock that account for 15 minutes. Wait, then try again. |
| Sign-up says "Sign-ups are closed" | `ALLOW_SIGNUPS` is `false`. Remove it or set it to `true`, then redeploy. |
| Search is case-sensitive in production | `DATABASE_URL` must start with `postgres://` or `postgresql://`; the app uses that to switch on case-insensitive search. |

---

## Running against the production database from your computer (advanced)

You normally don't need this. In PowerShell:

```powershell
$env:DATABASE_URL = "<pooled string>"
$env:DIRECT_URL   = "<direct string>"
npm run db:push:prod     # create/update tables
Remove-Item Env:DATABASE_URL, Env:DIRECT_URL
```

To load demo data into a production account, sign in and use **Settings → Load sample data**. It only affects that account.

**If you change the data model:** edit `prisma/schema.prisma` only, then run `npm run schema:sync` to regenerate `prisma/schema.postgres.prisma`. The Vercel build refuses to run if the two are out of sync.
