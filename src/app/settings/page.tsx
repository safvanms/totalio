"use client";

import { useEffect, useState } from "react";
import { useTheme } from "next-themes";
import { toast } from "sonner";
import { Database, DatabaseBackup, Laptop, Moon, RotateCcw, Save, Sparkles, Sun, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle, Field, Label, Separator, Skeleton, Switch } from "@/components/ui/primitives";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { PageHeader } from "@/components/shared/common";
import { ConfirmDialog } from "@/components/shared/confirm-dialog";
import { DataExportMenu, ImportDataButton } from "@/components/data/data-transfer";
import { useCategories, useDataAction, useSaveSettings, useSettingsQuery } from "@/hooks/use-data";
import { FALLBACK_SETTINGS } from "@/hooks/use-settings";
import { DATE_FORMATS, formatDateKey, PRESET_LABELS, todayKey } from "@/lib/dates";
import { CURRENCIES, formatMoney } from "@/lib/money";
import { cn } from "@/lib/utils";
import type { RangePreset, Settings } from "@/lib/types";

const CHARTS: { key: keyof Settings["dashboard"]["visibleCharts"]; label: string }[] = [
  { key: "donut", label: "Expenses by category (donut)" },
  { key: "monthly", label: "Monthly expenses (bar)" },
  { key: "trend", label: "Spending trend (line)" },
  { key: "top", label: "Top spending categories" },
  { key: "cumulative", label: "Cumulative expenses (area)" },
];

function SectionCard({ title, description, children }: { title: string; description: string; children: React.ReactNode }) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>{title}</CardTitle>
        <CardDescription>{description}</CardDescription>
      </CardHeader>
      <CardContent className="space-y-5">{children}</CardContent>
    </Card>
  );
}

function ToggleRow({ id, label, description, checked, onChange }: { id: string; label: string; description?: string; checked: boolean; onChange: (v: boolean) => void }) {
  return (
    <div className="flex items-center justify-between gap-4">
      <Label htmlFor={id} className="min-w-0 cursor-pointer">
        <span className="block text-sm font-medium">{label}</span>
        {description && <span className="mt-0.5 block text-xs font-normal text-muted-foreground">{description}</span>}
      </Label>
      <Switch id={id} checked={checked} onCheckedChange={onChange} />
    </div>
  );
}

export default function SettingsPage() {
  const { data, isLoading } = useSettingsQuery();
  const save = useSaveSettings();
  const action = useDataAction();
  const { data: categories = [] } = useCategories();
  const { theme, setTheme } = useTheme();
  const [mounted, setMounted] = useState(false);
  const [draft, setDraft] = useState<Settings>(FALLBACK_SETTINGS);
  const [confirm, setConfirm] = useState<null | "sample" | "clear">(null);

  useEffect(() => setMounted(true), []);
  useEffect(() => {
    if (data) setDraft(data);
  }, [data]);

  const dirty = !!data && JSON.stringify(draft) !== JSON.stringify(data);
  const setDash = (patch: Partial<Settings["dashboard"]>) => setDraft((d) => ({ ...d, dashboard: { ...d.dashboard, ...patch } }));

  return (
    <>
      <PageHeader
        title="Settings"
        description="Personalise Totalio and manage your data."
        actions={
          <>
            {dirty && (
              <Button variant="ghost" onClick={() => data && setDraft(data)}>
                <RotateCcw /> Reset
              </Button>
            )}
            <Button onClick={() => save.mutate(draft)} disabled={!dirty} loading={save.isPending}>
              <Save /> Save changes
            </Button>
          </>
        }
      />

      {isLoading ? (
        <div className="grid gap-5 lg:grid-cols-2">
          <Skeleton className="h-72 rounded-xl" />
          <Skeleton className="h-72 rounded-xl" />
        </div>
      ) : (
        <div className="grid min-w-0 gap-4 sm:gap-5 lg:grid-cols-2">
          <SectionCard title="Regional" description="How amounts and dates are displayed throughout the app.">
            <Field label="Currency" htmlFor="currency" hint={`Preview: ${formatMoney(123456.78, draft.currency)}`}>
              <Select value={draft.currency} onValueChange={(currency) => setDraft((d) => ({ ...d, currency }))}>
                <SelectTrigger id="currency">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {CURRENCIES.map((c) => (
                    <SelectItem key={c.code} value={c.code}>
                      <span className="w-10 font-mono text-xs text-muted-foreground">{c.code}</span> {c.name} ({c.symbol})
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </Field>
            <Field label="Date format" htmlFor="datefmt" hint={`Today: ${formatDateKey(todayKey(), draft.dateFormat)}`}>
              <Select value={draft.dateFormat} onValueChange={(dateFormat) => setDraft((d) => ({ ...d, dateFormat }))}>
                <SelectTrigger id="datefmt">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {DATE_FORMATS.map((f) => (
                    <SelectItem key={f.value} value={f.value}>
                      {f.example} <span className="text-xs text-muted-foreground">({f.value})</span>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </Field>
          </SectionCard>

          <SectionCard title="Appearance" description="Theme applies instantly and is remembered on this device.">
            <div className="grid grid-cols-3 gap-2" role="radiogroup" aria-label="Theme">
              {(
                [
                  { v: "light", label: "Light", icon: Sun },
                  { v: "dark", label: "Dark", icon: Moon },
                  { v: "system", label: "System", icon: Laptop },
                ] as const
              ).map((o) => {
                const active = mounted && theme === o.v;
                return (
                  <button
                    key={o.v}
                    type="button"
                    role="radio"
                    aria-checked={active}
                    onClick={() => setTheme(o.v)}
                    className={cn(
                      "flex flex-col items-center gap-2 rounded-xl border p-3 text-sm font-medium transition-colors hover:bg-accent/50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring sm:p-4",
                      active && "border-primary bg-primary/5 text-primary ring-1 ring-primary",
                    )}
                  >
                    <o.icon className="h-5 w-5" />
                    {o.label}
                  </button>
                );
              })}
            </div>
          </SectionCard>

          <SectionCard title="Dashboard" description="Choose what the dashboard shows by default.">
            <div className="grid gap-4 sm:grid-cols-2">
              <Field label="Default date range" htmlFor="defrange">
                <Select value={draft.dashboard.defaultRange} onValueChange={(v) => setDash({ defaultRange: v as RangePreset })}>
                  <SelectTrigger id="defrange">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {(["today", "week", "month", "year", "all"] as RangePreset[]).map((p) => (
                      <SelectItem key={p} value={p}>
                        {PRESET_LABELS[p]}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </Field>
              <Field label="Week starts on" htmlFor="weekstart">
                <Select value={String(draft.dashboard.weekStartsOn)} onValueChange={(v) => setDash({ weekStartsOn: Number(v) as 0 | 1 })}>
                  <SelectTrigger id="weekstart">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="1">Monday</SelectItem>
                    <SelectItem value="0">Sunday</SelectItem>
                  </SelectContent>
                </Select>
              </Field>
            </div>
            <Separator />
            <ToggleRow
              id="show-calc"
              label="Show calculated categories"
              description="List formula-based categories on the dashboard"
              checked={draft.dashboard.showCalculatedOnDashboard}
              onChange={(v) => setDash({ showCalculatedOnDashboard: v })}
            />
            <Separator />
            <p className="text-sm font-medium">Visible charts</p>
            <div className="space-y-3.5">
              {CHARTS.map((c) => (
                <ToggleRow
                  key={c.key}
                  id={`chart-${c.key}`}
                  label={c.label}
                  checked={draft.dashboard.visibleCharts[c.key]}
                  onChange={(v) => setDash({ visibleCharts: { ...draft.dashboard.visibleCharts, [c.key]: v } })}
                />
              ))}
            </div>
          </SectionCard>

          <SectionCard title="Data" description="Export, import, back up or reset your data.">
            <div className="rounded-xl border p-4">
              <div className="flex gap-3">
                <DatabaseBackup className="mt-0.5 h-5 w-5 shrink-0 text-primary" />
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-medium">Export & import</p>
                  <p className="text-xs text-muted-foreground">
                    Export everything (categories, formulas, expenses and settings) as CSV, Excel or JSON. Import the file at any time to restore it
                    exactly, or to merge it with your current data.
                  </p>
                  <div className="mt-3 flex flex-wrap gap-2">
                    <DataExportMenu />
                    <ImportDataButton />
                  </div>
                </div>
              </div>
            </div>
            <div className="rounded-xl border p-4">
              <div className="flex gap-3">
                <Database className="mt-0.5 h-5 w-5 shrink-0 text-muted-foreground" />
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-medium">Sample data & reset</p>
                  <p className="text-xs text-muted-foreground">
                    You currently have {categories.length} categories. Load a realistic demo dataset, or start fresh.
                  </p>
                  <div className="mt-3 flex flex-wrap gap-2">
                    <Button variant="outline" size="sm" onClick={() => setConfirm("sample")}>
                      <Sparkles /> Load sample data
                    </Button>
                    <Button variant="outline" size="sm" className="hover:border-destructive/40 hover:text-destructive" onClick={() => setConfirm("clear")}>
                      <Trash2 /> Delete all data
                    </Button>
                  </div>
                </div>
              </div>
            </div>
          </SectionCard>
        </div>
      )}

      <ConfirmDialog
        open={confirm === "sample"}
        onOpenChange={(o) => !o && setConfirm(null)}
        title="Replace your data with sample data?"
        description="All current categories and expenses will be deleted and replaced with a demo dataset. Download a backup first if you want to keep them."
        confirmLabel="Load sample data"
        loading={action.isPending}
        onConfirm={async () => {
          const r = await action.mutateAsync({ action: "sample" });
          toast.success(`Loaded ${r.categories} categories and ${r.expenses} expenses`);
          setConfirm(null);
        }}
      />
      <ConfirmDialog
        open={confirm === "clear"}
        onOpenChange={(o) => !o && setConfirm(null)}
        title="Delete all data?"
        description="Every category, formula and expense will be permanently deleted. Settings are kept. This can't be undone."
        confirmLabel="Delete everything"
        loading={action.isPending}
        onConfirm={async () => {
          await action.mutateAsync({ action: "clear" });
          toast.success("All data deleted");
          setConfirm(null);
        }}
      />
    </>
  );
}
