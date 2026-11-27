/**
 * Dependency graph between calculated categories and the categories their
 * formulas reference. Used to reject circular formulas, to evaluate
 * calculated categories in dependency order, and to find which calculated
 * categories are affected when a category changes.
 */
import type { FormulaToken } from "./tokens";
import { referencedCategoryIds } from "./tokens";
import { evaluateFormula, type EvalResult } from "./parser";

export interface GraphNode {
  id: string;
  type: "NORMAL" | "CALCULATED";
  formula: FormulaToken[] | null;
}

export type Graph = Map<string, string[]>;

export function buildGraph(nodes: GraphNode[]): Graph {
  const g: Graph = new Map();
  for (const n of nodes) g.set(n.id, n.type === "CALCULATED" ? referencedCategoryIds(n.formula) : []);
  return g;
}

/**
 * Returns the cycle path (e.g. [A, B, C, A]) reachable from `start`, or null.
 */
export function findCycleFrom(graph: Graph, start: string): string[] | null {
  const state = new Map<string, "visiting" | "done">();
  const stack: string[] = [];

  function dfs(id: string): string[] | null {
    const s = state.get(id);
    if (s === "visiting") {
      const at = stack.indexOf(id);
      return [...stack.slice(at), id];
    }
    if (s === "done") return null;
    state.set(id, "visiting");
    stack.push(id);
    for (const next of graph.get(id) ?? []) {
      const c = dfs(next);
      if (c) return c;
    }
    stack.pop();
    state.set(id, "done");
    return null;
  }
  return dfs(start);
}

/**
 * Would saving `tokens` as the formula of `targetId` create a cycle?
 * Returns the cycle path (category ids) or null.
 */
export function detectCycle(nodes: GraphNode[], targetId: string, tokens: FormulaToken[]): string[] | null {
  const graph = buildGraph(nodes);
  graph.set(targetId, referencedCategoryIds(tokens));
  return findCycleFrom(graph, targetId);
}

/** All calculated categories that (transitively) depend on `id`. */
export function transitiveDependents(nodes: GraphNode[], id: string): string[] {
  const graph = buildGraph(nodes);
  const reverse = new Map<string, string[]>();
  for (const [from, tos] of graph) for (const to of tos) reverse.set(to, [...(reverse.get(to) ?? []), from]);
  const out: string[] = [];
  const seen = new Set<string>([id]);
  const queue = [id];
  while (queue.length) {
    const cur = queue.shift()!;
    for (const d of reverse.get(cur) ?? []) {
      if (!seen.has(d)) {
        seen.add(d);
        out.push(d);
        queue.push(d);
      }
    }
  }
  return out;
}

export type CalcFailure = Extract<EvalResult, { ok: false }>["reason"] | "cycle";
export type CalcValue = { value: number; error: null } | { value: null; error: string; reason: CalcFailure };

/**
 * Resolves the value of every category for one period.
 * - Normal categories take their base total (sum of expense entries in the period).
 * - Calculated categories evaluate their formula against those values,
 *   recursively (calculated categories may reference other calculated
 *   categories). Memoised, and cycle-safe even if bad data slipped in.
 */
export function resolveAll(nodes: GraphNode[], baseTotals: Map<string, number>): Map<string, CalcValue> {
  const byId = new Map(nodes.map((n) => [n.id, n]));
  const memo = new Map<string, CalcValue>();
  const visiting = new Set<string>();

  function resolve(id: string): CalcValue {
    const cached = memo.get(id);
    if (cached) return cached;
    const node = byId.get(id);
    if (!node) return { value: null, error: "Referenced category no longer exists.", reason: "missing-reference" };
    if (node.type === "NORMAL") {
      const v: CalcValue = { value: baseTotals.get(id) ?? 0, error: null };
      memo.set(id, v);
      return v;
    }
    if (visiting.has(id)) return { value: null, error: "Circular dependency detected.", reason: "cycle" };
    if (!node.formula?.length) {
      const v: CalcValue = { value: null, error: "No formula defined yet.", reason: "invalid" };
      memo.set(id, v);
      return v;
    }
    visiting.add(id);
    const res = evaluateFormula(node.formula, (ref) => resolve(ref).value);
    visiting.delete(id);
    const v: CalcValue = res.ok ? { value: res.value, error: null } : { value: null, error: res.message, reason: res.reason };
    memo.set(id, v);
    return v;
  }

  for (const n of nodes) resolve(n.id);
  return memo;
}
