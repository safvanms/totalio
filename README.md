# Totalio

Personal expense management & analytics dashboard with a visual, drag-and-drop formula builder for calculated categories.

**Stack:** Next.js 15 (App Router) · TypeScript · Tailwind CSS · shadcn/ui-style components on Radix · Lucide · Recharts · React Hook Form + Zod · TanStack Query + Zustand · dnd-kit · Prisma (SQLite, PostgreSQL-ready)

## Getting started

```bash
npm install          # also runs `prisma generate`
npm run setup        # creates the SQLite DB and loads sample data
npm run dev          # http://localhost:3000
```

Other scripts: `npm run build`, `npm start`, `npm test` (formula engine unit tests), `npm run typecheck`, `npm run db:reset` (wipe + reseed).

Sample data is optional. Settings → *Delete all data* gives you an empty app; *Load sample data* restores the demo set.

## Architecture

```
prisma/schema.prisma        Category, Expense, CategoryDependency (formula graph edges), Setting
src/lib/formula/            Safe formula engine: tokens, recursive-descent parser, evaluator, dependency graph
src/lib/analytics.ts        Pure functions: totals, summaries, time series, calculated history, breakdowns
src/lib/server/             Prisma services (categories, expenses, settings, backup, sample data)
src/app/api/                REST route handlers
src/hooks/, src/stores/     React Query data hooks (mutations invalidate all derived views), Zustand UI state
src/components/             ui/ primitives, layout/, shared/, charts/, dashboard/, reports/, formula/, expenses/, categories/
```

### Data & calculation rules

- **Totals are never stored.** Every total is derived from expense rows. Sums are done in integer minor units, so 0.1 + 0.2 stays exact.
- **Formulas** are stored as structured JSON tokens that reference categories by ID, so renaming a category never breaks a formula. They are parsed with a recursive-descent parser that handles operator precedence and parentheses. **No `eval`.**
- **Validation** runs on both client and server. It catches structural errors (with the offending token highlighted), missing references, self- and circular references (with the cycle path), and division by zero (literal 0, or a divisor that currently totals 0).
- **Date ranges**: a calculated category is evaluated from the selected period's own category totals. History charts evaluate the formula separately for each bucket.
- Calculated categories can reference other calculated categories. Deleting a category that a formula references is blocked.
- `CategoryDependency` mirrors formula references so the database enforces referential integrity (`onDelete: Restrict`).

### Export & import

**Settings → Export & import** (also **Import** on Expense history):

- **Export data** writes *everything* (categories with codes, colours, icons and formulas, every expense with its ID, and settings) as:
  - **CSV**: one table, each row tagged `record_type` (`META`/`SETTING`/`CATEGORY`/`EXPENSE`).
  - **Excel**: sheets *Expenses*, *Categories*, *Settings*.
  - **JSON**: an exact backup.
  - **PDF**: a report for reading only; it can't be imported.
- **Import** accepts `.csv`, `.xlsx` or `.json`. It shows a preview (counts, total, date range, problems listed by row) before anything changes, then lets you choose:
  - **Replace everything** restores the data exactly as exported.
  - **Merge** keeps your current data and adds only what's new. Categories are matched by ID, then by name. Expenses already present are skipped, by ID, or by category + date + amount + particular. Importing the same file twice is safe.
- Expense lists from other tools also import, as do the report exports from Expense history. Any sheet with *Particular* and *Amount* columns works, with *Date* and *Category* optional. Dates may be in common formats or Excel serials, and amounts may include currency symbols or thousands separators.
- Formulas are stored in files as readable codes, e.g. `(C1 + C2) * 2`. Hand-edited files are validated on import.

### Deployment (Vercel + PostgreSQL)

Local development uses SQLite (`prisma/schema.prisma`). Production uses PostgreSQL (`prisma/schema.postgres.prisma`, identical models), built with `npm run vercel-build`. See **[DEPLOYMENT.md](DEPLOYMENT.md)** for the full step-by-step guide.
