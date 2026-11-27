"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  DndContext,
  DragOverlay,
  KeyboardSensor,
  MouseSensor,
  TouchSensor,
  closestCenter,
  pointerWithin,
  useSensor,
  useSensors,
  type CollisionDetection,
  type DragEndEvent,
  type DragStartEvent,
} from "@dnd-kit/core";
import { sortableKeyboardCoordinates } from "@dnd-kit/sortable";
import { AlertTriangle, ArrowRight, Calculator, CheckCircle2, Keyboard, Plus, Save, Sigma, XCircle } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Badge, Card, Field, Input, Skeleton, Textarea } from "@/components/ui/primitives";
import { Select, SelectContent, SelectItem, SelectSeparator, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/overlays";
import { CategoryIcon, EmptyState, ErrorState, PageHeader } from "@/components/shared/common";
import { ColorPicker, IconPicker } from "@/components/shared/pickers";
import { ConfirmDialog } from "@/components/shared/confirm-dialog";
import { DateRangeFilter } from "@/components/shared/date-range-filter";
import { useCategories, useCreateCategory, useExpensePoints, useUpdateCategory } from "@/hooks/use-data";
import { useDateRange } from "@/hooks/use-date-range";
import { useFormat } from "@/hooks/use-settings";
import { categoryValues, toGraphNodes } from "@/lib/analytics";
import { errorMessage } from "@/lib/api-client";
import { nextCategoryColor } from "@/lib/constants";
import { describeRange } from "@/lib/dates";
import {
  detectCycle,
  evaluateAst,
  formulaToString,
  parseFormula,
  referencedCategoryIds,
  tokenizeText,
  transitiveDependents,

  type FormulaToken,
} from "@/lib/formula";
import { cn, formatPercent } from "@/lib/utils";
import { useDialogs } from "@/stores/dialog-store";
import { CategoryLibrary } from "./category-library";
import { TokenChip } from "./token-chip";
import { FormulaWorkspace, OperatorPalette, SelectionBar } from "./workspace";
import { useFormulaEditor, type NewToken } from "./use-formula-editor";

const NEW = "__new__";

/** Prefer the pointer position (works for touch too); fall back to nearest centre. */
const collision: CollisionDetection = (args) => {
  const hits = pointerWithin(args);
  if (hits.length) {
    const tokenHit = hits.find((h) => h.id !== "workspace");
    return tokenHit ? [tokenHit] : hits;
  }
  return closestCenter(args);
};

type CheckState = "ok" | "error" | "warn" | "idle";

function Check({ state, label, detail }: { state: CheckState; label: string; detail?: string }) {
  const Icon = state === "ok" ? CheckCircle2 : state === "warn" ? AlertTriangle : state === "error" ? XCircle : CheckCircle2;
  return (
    <li className="flex gap-2.5">
      <Icon
        className={cn(
          "mt-0.5 h-4 w-4 shrink-0",
          state === "ok" && "text-success",
          state === "warn" && "text-warning",
          state === "error" && "text-destructive",
          state === "idle" && "text-muted-foreground/40",
        )}
        aria-label={state}
      />
      <span className="min-w-0 text-sm">
        <span className={cn("font-medium", state === "idle" && "text-muted-foreground")}>{label}</span>
        {detail && <span className={cn("block break-words text-xs", state === "error" ? "text-destructive" : "text-muted-foreground")}>{detail}</span>}
      </span>
    </li>
  );
}

export function FormulaBuilder({ initialId }: { initialId: string | null }) {
  const router = useRouter();
  const { data: categories, isLoading, error, refetch } = useCategories();
  const { state: rangeState, range, setState: setRange } = useDateRange("builder");
  const { data: points = [] } = useExpensePoints(range);
  const { money, dateFormat } = useFormat();
  const openCategory = useDialogs((s) => s.openCategory);
  const create = useCreateCategory();
  const update = useUpdateCategory();

  const editor = useFormulaEditor();
  const [targetId, setTargetId] = useState<string>(initialId ?? NEW);
  const [meta, setMeta] = useState({ name: "", description: "", color: "#ec4647", icon: "calculator" });
  const [loadedFor, setLoadedFor] = useState<string | null>(null);
  const [pendingTarget, setPendingTarget] = useState<string | null>(null);
  const [activeDrag, setActiveDrag] = useState<{ token: FormulaToken } | null>(null);
  const [typed, setTyped] = useState("");
  const [typedError, setTypedError] = useState<string | null>(null);
  const [nameError, setNameError] = useState<string | null>(null);

  useEffect(() => setTargetId(initialId ?? NEW), [initialId]);

  const all = useMemo(() => categories ?? [], [categories]);
  const byId = useMemo(() => new Map(all.map((c) => [c.id, c])), [all]);
  const target = targetId !== NEW ? byId.get(targetId) : undefined;
  const calculated = all.filter((c) => c.type === "CALCULATED");

  // Load the target's saved formula once categories are available.
  useEffect(() => {
    if (!categories || loadedFor === targetId) return;
    if (targetId === NEW) {
      editor.set([], true);
      setMeta({ name: "", description: "", color: nextCategoryColor(categories.map((c) => c.color)), icon: "calculator" });
    } else {
      const t = categories.find((c) => c.id === targetId);
      if (!t) return;
      editor.set(t.formula ?? [], true);
      setMeta({ name: t.name, description: t.description ?? "", color: t.color, icon: t.icon });
    }
    setLoadedFor(targetId);
    setNameError(null);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [categories, targetId, loadedFor]);

  /* ---------------- derived values ---------------- */

  const values = useMemo(() => {
    const m = new Map<string, number | null>();
    for (const [id, v] of categoryValues(all, points)) m.set(id, v.value);
    return m;
  }, [all, points]);

  const library = useMemo(() => all.filter((c) => c.id !== targetId), [all, targetId]);
  const blocked = useMemo(() => {
    if (targetId === NEW) return new Set<string>();
    return new Set(transitiveDependents(toGraphNodes(all), targetId));
  }, [all, targetId]);

  const tokens = editor.tokens;
  const parsed = useMemo(() => parseFormula(tokens, (id) => byId.get(id)?.name ?? "Unknown"), [tokens, byId]);
  const refs = referencedCategoryIds(tokens);
  const missing = refs.filter((id) => !byId.has(id));
  const cycle = useMemo(() => {
    if (targetId === NEW || !tokens.length) return null;
    return detectCycle(toGraphNodes(all), targetId, tokens);
  }, [all, targetId, tokens]);
  const evaluation = parsed.ok && !cycle && !missing.length ? evaluateAst(parsed.ast, (id) => values.get(id) ?? null) : null;
  const result = evaluation?.ok ? evaluation.value : null;
  const errorIndex = !parsed.ok ? parsed.error.tokenIndex : evaluation && !evaluation.ok ? evaluation.tokenIndex : null;

  // Structural comparison (token ids don't matter).
  const shape = (ts: FormulaToken[]) => formulaToString(ts, (id) => `#${id}`);
  const dirty =
    loadedFor === targetId &&
    (shape(tokens) !== shape(target?.formula ?? []) ||
      (target ? meta.name !== target.name || meta.description !== (target.description ?? "") : tokens.length > 0 || meta.name.trim() !== ""));
  const nameValid = meta.name.trim().length > 0 && meta.name.trim().length <= 60;
  const canSave = parsed.ok && !cycle && !missing.length && nameValid && !(evaluation && !evaluation.ok && evaluation.reason === "division-by-zero");

  // Warn before leaving with unsaved changes.
  useEffect(() => {
    if (!dirty) return;
    const h = (e: BeforeUnloadEvent) => e.preventDefault();
    window.addEventListener("beforeunload", h);
    return () => window.removeEventListener("beforeunload", h);
  }, [dirty]);

  const codeOf = (id: string) => byId.get(id)?.code ?? "?";
  const nameOf = (id: string) => byId.get(id)?.name ?? "Unknown";
  const breakdown = refs
    .map((id) => byId.get(id))
    .filter((c): c is NonNullable<typeof c> => !!c)
    .map((c) => ({ c, v: values.get(c.id) ?? null }));
  const absSum = breakdown.reduce((s, b) => s + Math.abs(b.v ?? 0), 0);

  /* ---------------- drag and drop ---------------- */

  const sensors = useSensors(
    useSensor(MouseSensor, { activationConstraint: { distance: 6 } }),
    useSensor(TouchSensor, { activationConstraint: { delay: 160, tolerance: 8 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  );

  const onDragStart = (e: DragStartEvent) => {
    const d = e.active.data.current as { source: string; categoryId?: string; token?: NewToken } | undefined;
    if (d?.source === "library" && d.categoryId) setActiveDrag({ token: { id: "drag", kind: "category", categoryId: d.categoryId } });
    else if (d?.source === "palette" && d.token) setActiveDrag({ token: { id: "drag", ...d.token } as FormulaToken });
    else {
      const t = tokens.find((x) => x.id === e.active.id);
      if (t) setActiveDrag({ token: t });
    }
  };

  const onDragEnd = ({ active, over }: DragEndEvent) => {
    setActiveDrag(null);
    const d = active.data.current as { source: string; categoryId?: string; token?: NewToken } | undefined;
    if (!d) return;
    if (d.source === "workspace") {
      const from = tokens.findIndex((t) => t.id === active.id);
      if (!over) {
        // Dropped outside the workspace: remove the block.
        editor.remove(String(active.id));
        return;
      }
      const to = tokens.findIndex((t) => t.id === over.id);
      if (from >= 0 && to >= 0) editor.reorder(from, to);
      return;
    }
    if (!over) return;
    const newToken: NewToken | null =
      d.source === "library" && d.categoryId ? { kind: "category", categoryId: d.categoryId } : d.source === "palette" && d.token ? d.token : null;
    if (!newToken) return;
    let at = tokens.length;
    const overIdx = tokens.findIndex((t) => t.id === over.id);
    if (overIdx >= 0) {
      const translated = active.rect.current.translated;
      const centerX = translated ? translated.left + translated.width / 2 : 0;
      at = centerX > over.rect.left + over.rect.width / 2 ? overIdx + 1 : overIdx;
    }
    editor.insert(newToken, at);
  };

  /* ---------------- actions ---------------- */

  const switchTarget = (id: string) => {
    if (id === targetId) return;
    if (dirty) return setPendingTarget(id);
    goTo(id);
  };
  const goTo = (id: string) => {
    setLoadedFor(null);
    setTargetId(id);
    router.replace(id === NEW ? "/formula-builder" : `/formula-builder?id=${id}`, { scroll: false });
  };

  const applyTyped = () => {
    try {
      const codeMap = new Map(library.map((c) => [c.code.toUpperCase(), c.id]));
      const t = tokenizeText(typed, (code) => codeMap.get(code));
      editor.set(t);
      setTyped("");
      setTypedError(null);
    } catch (e) {
      setTypedError(errorMessage(e));
    }
  };

  const save = async () => {
    if (!nameValid) {
      setNameError("Give the calculated category a name.");
      return;
    }
    if (!canSave) return;
    try {
      if (target) {
        await update.mutateAsync({
          id: target.id,
          input: { name: meta.name.trim(), description: meta.description.trim() || null, formula: tokens, type: "CALCULATED" },
        });
      } else {
        const created = await create.mutateAsync({
          name: meta.name.trim(),
          description: meta.description.trim() || null,
          color: meta.color,
          icon: meta.icon,
          type: "CALCULATED",
          formula: tokens,
        });
        setTargetId(created.id);
        router.replace(`/formula-builder?id=${created.id}`, { scroll: false });
      }
    } catch (e) {
      const msg = errorMessage(e);
      if (/name/i.test(msg)) setNameError(msg);
      toast.error(msg);
    }
  };

  /* ---------------- render ---------------- */

  if (isLoading) {
    return (
      <div className="space-y-6">
        <Skeleton className="h-9 w-64" />
        <div className="grid gap-5 xl:grid-cols-[280px_minmax(0,1fr)_340px]">
          <Skeleton className="h-96 rounded-2xl" />
          <Skeleton className="h-96 rounded-2xl" />
          <Skeleton className="h-96 rounded-2xl" />
        </div>
      </div>
    );
  }
  if (error) return <ErrorState error={error} onRetry={() => refetch()} />;

  const normalCount = all.filter((c) => c.type === "NORMAL").length;
  if (normalCount === 0) {
    return (
      <>
        <PageHeader title="Formula Builder" description="Combine categories into calculated categories using a visual formula." />
        <Card>
          <EmptyState
            icon={Sigma}
            title="You need some categories first"
            description="Create expense categories (e.g. Train Tickets, Bus Tickets), then combine them here."
            action={<Button onClick={() => openCategory({ type: "NORMAL" })}>Create category</Button>}
          />
        </Card>
      </>
    );
  }

  const formulaCodes = formulaToString(tokens, codeOf, { pretty: true });
  const formulaNames = formulaToString(tokens, nameOf, { pretty: true });
  const displayName = meta.name.trim() || "New calculated category";

  const resultLabel = (
    <>
      <span className="min-w-0 truncate font-medium text-muted-foreground" title={displayName}>
        {displayName}
      </span>
      <span className="text-muted-foreground">=</span>
      <span className={cn("tabular truncate text-lg font-semibold", result === null ? "text-muted-foreground" : "text-foreground")}>
        {result === null ? "—" : money(result)}
      </span>
    </>
  );

  return (
    <>
      <PageHeader
        title="Formula Builder"
        description="Drag categories and operators into the workspace to build a calculated category. Totals update live and recalculate automatically whenever expenses change."
        actions={
          <div className="flex w-full flex-col gap-2 xs:flex-row sm:w-auto">
            <Select value={targetId} onValueChange={switchTarget}>
              <SelectTrigger className="w-full sm:w-64" aria-label="Calculated category to edit">
                <SelectValue />
              </SelectTrigger>
              <SelectContent align="end">
                <SelectItem value={NEW}>
                  <Plus className="h-4 w-4 text-primary" /> New calculated category
                </SelectItem>
                {calculated.length > 0 && <SelectSeparator />}
                {calculated.map((c) => (
                  <SelectItem key={c.id} value={c.id}>
                    <CategoryIcon icon={c.icon} color={c.color} size="xs" />
                    <span className="truncate">{c.name}</span>
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Button onClick={save} disabled={!canSave || (!dirty && !!target)} loading={create.isPending || update.isPending} className="sm:hidden">
              <Save /> Save formula
            </Button>
          </div>
        }
      />

      <DndContext sensors={sensors} collisionDetection={collision} onDragStart={onDragStart} onDragEnd={onDragEnd} onDragCancel={() => setActiveDrag(null)}>
        <div className="grid min-w-0 gap-4 sm:gap-5 lg:grid-cols-[260px_minmax(0,1fr)] xl:grid-cols-[280px_minmax(0,1fr)_340px] 2xl:grid-cols-[300px_minmax(0,1fr)_380px]">
          {/* Left: library */}
          <div className="min-w-0 lg:row-span-2 xl:row-span-1">
            <div className="lg:sticky lg:top-24">
              <CategoryLibrary categories={library} values={values} formatValue={(n) => money(n)} blockedIds={blocked} onAdd={(id) => editor.insert({ kind: "category", categoryId: id })} />
            </div>
          </div>

          {/* Centre: workspace */}
          <section aria-label="Formula workspace" className="min-w-0 space-y-4">
            <Card className="overflow-hidden">
              <div className="flex flex-col gap-3 border-b p-4 sm:flex-row sm:items-center sm:justify-between">
                <div className="flex min-w-0 items-center gap-3">
                  <CategoryIcon icon={meta.icon} color={meta.color} size="md" />
                  <div className="min-w-0">
                    <p className="truncate font-semibold" title={displayName}>
                      {displayName}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      {target ? (
                        <>
                          {target.code} · {dirty ? <span className="text-warning">Unsaved changes</span> : "Saved"}
                        </>
                      ) : (
                        "Not saved yet"
                      )}
                    </p>
                  </div>
                </div>
                {target && (
                  <Button asChild variant="ghost" size="sm" className="self-start sm:self-auto">
                    <Link href={`/categories/${target.id}`}>
                      View details <ArrowRight />
                    </Link>
                  </Button>
                )}
              </div>
              <div className="space-y-4 p-4">
                <OperatorPalette editor={editor} />
                <FormulaWorkspace editor={editor} categoriesById={byId} values={values} formatValue={(n) => money(n)} errorIndex={errorIndex} resultLabel={resultLabel} />
                <SelectionBar editor={editor} categoriesById={byId} />
                <Popover>
                  <PopoverTrigger asChild>
                    <Button variant="link" size="xs" className="h-auto px-0 text-muted-foreground">
                      <Keyboard /> Prefer typing? Enter the formula with category codes
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent align="start" className="w-[min(26rem,calc(100vw-2rem))]">
                    <form
                      className="space-y-2"
                      onSubmit={(e) => {
                        e.preventDefault();
                        applyTyped();
                      }}
                    >
                      <p className="text-sm font-medium">Type a formula</p>
                      <p className="text-xs text-muted-foreground">
                        Use codes like {library.slice(0, 3).map((c) => c.code).join(", ")} with + − × ÷ and parentheses. It&apos;s converted into blocks you can keep editing.
                      </p>
                      <Input value={typed} onChange={(e) => setTyped(e.target.value)} placeholder="(C1 + C2) - C3" className="font-mono" aria-label="Formula text" />
                      {typedError && <p className="text-xs text-destructive">{typedError}</p>}
                      <Button type="submit" size="sm" disabled={!typed.trim()}>
                        Convert to blocks
                      </Button>
                    </form>
                  </PopoverContent>
                </Popover>
              </div>
            </Card>

            <Card className="p-4">
              <div className="flex flex-col gap-3">
                <div>
                  <p className="text-sm font-semibold">Preview period</p>
                  <p className="text-xs text-muted-foreground">Values below use expenses from {describeRange(range, dateFormat).toLowerCase() === "all time" ? "all time" : describeRange(range, dateFormat)}.</p>
                </div>
                <DateRangeFilter state={rangeState} range={range} onChange={setRange} />
              </div>
            </Card>
          </section>

          {/* Right: preview & save */}
          <aside aria-label="Formula preview" className="min-w-0 space-y-4 lg:col-start-2 xl:col-start-auto">
            <Card className="overflow-hidden">
              <div className="relative overflow-hidden bg-gradient-to-br from-indigo-600 via-violet-600 to-violet-700 p-5 text-white">
                <div className="absolute -right-10 -top-10 h-36 w-36 rounded-full bg-white/10 blur-2xl" aria-hidden />
                <p className="flex items-center gap-1.5 text-xs font-medium uppercase tracking-wide text-white/70">
                  <Calculator className="h-3.5 w-3.5" /> Live result
                </p>
                <p className="mt-1 truncate text-sm text-white/85" title={displayName}>
                  {displayName}
                </p>
                <p className="tabular mt-1 break-all text-3xl font-semibold tracking-tight">{result === null ? "—" : money(result)}</p>
                <p className="mt-3 break-words rounded-lg bg-white/10 px-3 py-2 font-mono text-[13px]">{formulaCodes || "Formula is empty"}</p>
              </div>
              <div className="space-y-4 p-4 sm:p-5">
                {formulaNames && <p className="break-words text-xs text-muted-foreground">{formulaNames}</p>}
                <ul className="space-y-2.5" aria-label="Validation">
                  <Check
                    state={!tokens.length ? "idle" : parsed.ok ? "ok" : "error"}
                    label="Valid expression"
                    detail={!tokens.length ? "Add categories and operators" : parsed.ok ? undefined : parsed.error.message}
                  />
                  <Check
                    state={!tokens.length ? "idle" : missing.length ? "error" : "ok"}
                    label="All referenced categories exist"
                    detail={missing.length ? "Remove blocks for deleted categories." : undefined}
                  />
                  <Check
                    state={!tokens.length ? "idle" : cycle ? "error" : "ok"}
                    label="No circular dependencies"
                    detail={cycle ? `Cycle: ${cycle.map((id) => (id === targetId ? displayName : nameOf(id))).join(" → ")}` : undefined}
                  />
                  <Check
                    state={!evaluation ? "idle" : evaluation.ok ? "ok" : "error"}
                    label="No division by zero"
                    detail={evaluation && !evaluation.ok ? evaluation.message : undefined}
                  />
                </ul>
              </div>
            </Card>

            <Card className="p-4 sm:p-5">
              <p className="mb-3 text-sm font-semibold">Breakdown</p>
              {breakdown.length === 0 ? (
                <p className="text-sm text-muted-foreground">Referenced categories and their totals will appear here.</p>
              ) : (
                <ul className="space-y-3">
                  {breakdown.map(({ c, v }) => {
                    const share = absSum > 0 ? (Math.abs(v ?? 0) / absSum) * 100 : 0;
                    return (
                      <li key={c.id} className="space-y-1.5">
                        <div className="flex items-center justify-between gap-3 text-sm">
                          <span className="flex min-w-0 items-center gap-2">
                            <CategoryIcon icon={c.icon} color={c.color} size="xs" />
                            <span className="truncate" title={c.name}>
                              {c.name}
                            </span>
                          </span>
                          <span className="tabular shrink-0 font-medium">{v === null ? "—" : money(v)}</span>
                        </div>
                        <div className="flex items-center gap-2">
                          <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-muted">
                            <div className="h-full rounded-full transition-all" style={{ width: `${share}%`, backgroundColor: c.color }} />
                          </div>
                          <span className="tabular w-12 text-right text-[11px] text-muted-foreground">{formatPercent(share)}</span>
                        </div>
                      </li>
                    );
                  })}
                </ul>
              )}
            </Card>

            <Card className="space-y-4 p-4 sm:p-5">
              <p className="text-sm font-semibold">{target ? "Category" : "Save as new category"}</p>
              <Field label="Name" htmlFor="fb-name" error={nameError ?? undefined} required>
                <Input
                  id="fb-name"
                  value={meta.name}
                  maxLength={60}
                  placeholder="e.g. All Tickets Expenses"
                  aria-invalid={!!nameError}
                  onChange={(e) => {
                    setMeta((m) => ({ ...m, name: e.target.value }));
                    setNameError(null);
                  }}
                />
              </Field>
              <Field label="Description" htmlFor="fb-desc">
                <Textarea id="fb-desc" rows={2} maxLength={240} value={meta.description} placeholder="Optional" onChange={(e) => setMeta((m) => ({ ...m, description: e.target.value }))} />
              </Field>
              {!target && (
                <>
                  <Field label="Colour">
                    <ColorPicker value={meta.color} onChange={(color) => setMeta((m) => ({ ...m, color }))} />
                  </Field>
                  <Field label="Icon">
                    <div className="max-h-36 overflow-y-auto pr-1 scrollbar-thin">
                      <IconPicker value={meta.icon} color={meta.color} onChange={(icon) => setMeta((m) => ({ ...m, icon }))} />
                    </div>
                  </Field>
                </>
              )}
              <div className="flex flex-col gap-2 pt-1">
                <Button onClick={save} disabled={!canSave || (!dirty && !!target)} loading={create.isPending || update.isPending} size="lg">
                  <Save /> {target ? "Save formula" : "Create calculated category"}
                </Button>
                {target && dirty && (
                  <Button variant="ghost" onClick={() => setLoadedFor(null)}>
                    Discard changes
                  </Button>
                )}
                {!canSave && tokens.length > 0 && parsed.ok && !cycle && !nameValid && (
                  <p className="text-center text-xs text-muted-foreground">Enter a name to save.</p>
                )}
              </div>
              {target && (
                <div className="flex flex-wrap gap-1.5">
                  <Badge variant="secondary">Used by {target.dependentIds.length} formula{target.dependentIds.length === 1 ? "" : "s"}</Badge>
                  <Badge variant="secondary">{refs.length} reference{refs.length === 1 ? "" : "s"}</Badge>
                </div>
              )}
            </Card>
          </aside>
        </div>

        <DragOverlay dropAnimation={{ duration: 180, easing: "cubic-bezier(0.2, 0, 0, 1)" }}>
          {activeDrag ? (
            <TokenChip
              token={activeDrag.token}
              category={activeDrag.token.kind === "category" ? byId.get(activeDrag.token.categoryId) : undefined}
              value={activeDrag.token.kind === "category" ? values.get(activeDrag.token.categoryId) : undefined}
              formatValue={(n) => money(n)}
              overlay
            />
          ) : null}
        </DragOverlay>
      </DndContext>

      <ConfirmDialog
        open={!!pendingTarget}
        onOpenChange={(o) => !o && setPendingTarget(null)}
        title="Discard unsaved changes?"
        description="Your changes to this formula haven't been saved."
        confirmLabel="Discard"
        onConfirm={() => {
          if (pendingTarget) goTo(pendingTarget);
          setPendingTarget(null);
        }}
      />
    </>
  );
}


