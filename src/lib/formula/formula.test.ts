import { describe, expect, it } from "vitest";
import {
  detectCycle,
  evaluateFormula,
  formulaToString,
  parseFormula,
  resolveAll,
  tokenizeText,
  transitiveDependents,
  type FormulaToken,
  type GraphNode,
} from "./index";

const codes: Record<string, string> = { C1: "train", C2: "bus", C3: "flight", C4: "hotel", C5: "food" };
const values: Record<string, number> = { train: 1500, bus: 2000, flight: 3000, hotel: 4000, food: 0 };
const tk = (s: string) => tokenizeText(s, (c) => codes[c]);
const run = (s: string) => evaluateFormula(tk(s), (id) => values[id] ?? null);

describe("tokenizer", () => {
  it("tokenizes categories, numbers, operators and parentheses", () => {
    const t = tk("(C1 + C2) * 1.5");
    expect(t.map((x) => x.kind)).toEqual(["lparen", "category", "operator", "category", "rparen", "operator", "number"]);
  });
  it("rejects unknown references and characters", () => {
    expect(() => tk("C9 + C1")).toThrow(/Unknown category/);
    expect(() => tk("C1 ^ C2")).toThrow(/Unexpected character/);
  });
});

describe("evaluation", () => {
  it.each([
    ["C1 + C2", 3500],
    ["C1 + C2 + C3", 6500],
    ["(C1 + C2) - C3", 500],
    ["C1 + C2 - C3 + C4", 4500],
    ["C1 + C2 * 2", 5500], // precedence
    ["(C1 + C2) * 2", 7000],
    ["C3 / C1", 2],
    ["C1 - C2 - C3", -3500], // left associativity
    ["C3 / C1 / 2", 1],
    ["((C1))", 1500],
    ["C1 * 0.1 + 0.2", 150.2],
  ])("%s = %d", (expr, expected) => {
    const r = run(expr);
    expect(r.ok && r.value).toBe(expected);
  });

  it("supports multiplying categories C1 + (C2 * C3)", () => {
    const r = run("C1 + (C2 * C3)");
    expect(r.ok && r.value).toBe(1500 + 2000 * 3000);
  });

  it("reports runtime division by zero", () => {
    const r = run("C1 / C5");
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.reason).toBe("division-by-zero");
  });

  it("rejects literal division by zero at parse time", () => {
    const p = parseFormula(tk("C1 / 0"));
    expect(p.ok).toBe(false);
  });
});

describe("validation messages", () => {
  const msg = (s: string) => {
    const p = parseFormula(tk(s), (id) => id);
    return p.ok ? null : p.error;
  };
  it.each([
    ["", /at least one category/],
    ["+ C1", /can't start/],
    ["C1 +", /can't end/],
    ["C1 + * C2", /Two operators/],
    ["C1 C2", /Missing operator/],
    ["C1 (C2)", /Missing operator/],
    ["(C1 + C2", /unclosed/],
    ["C1 + C2)", /no matching/],
    ["()", /Empty parentheses/],
    ["(C1 +)", /right side/],
    ["(* C1)", /left side/],
  ])("%s", (expr, re) => {
    const e = msg(expr);
    expect(e).not.toBeNull();
    expect(e!.message).toMatch(re);
  });

  it("points at the offending token", () => {
    expect(msg("C1 + * C2")!.tokenIndex).toBe(2);
  });
});

describe("dependencies", () => {
  const f = (s: string): FormulaToken[] => tokenizeText(s, (c) => ({ ...codes, A: "A", B: "B", X: "X" })[c]);
  const nodes: GraphNode[] = [
    { id: "train", type: "NORMAL", formula: null },
    { id: "bus", type: "NORMAL", formula: null },
    { id: "A", type: "CALCULATED", formula: f("C1 + C2") },
    { id: "B", type: "CALCULATED", formula: f("A * 2") },
  ];

  it("resolves calculated categories that reference calculated categories", () => {
    const out = resolveAll(nodes, new Map([["train", 100], ["bus", 50]]));
    expect(out.get("A")!.value).toBe(150);
    expect(out.get("B")!.value).toBe(300);
  });

  it("detects direct and indirect cycles", () => {
    expect(detectCycle(nodes, "A", f("B + C1"))).toEqual(["A", "B", "A"]);
    expect(detectCycle(nodes, "A", f("A + C1"))).toEqual(["A", "A"]);
    expect(detectCycle(nodes, "X", f("A + B"))).toBeNull();
  });

  it("finds transitive dependents", () => {
    expect(transitiveDependents(nodes, "train").sort()).toEqual(["A", "B"]);
  });

  it("is cycle-safe when evaluating corrupt data", () => {
    const bad: GraphNode[] = [
      { id: "A", type: "CALCULATED", formula: f("B") },
      { id: "B", type: "CALCULATED", formula: f("A") },
    ];
    const out = resolveAll(bad, new Map());
    expect(out.get("A")!.value).toBeNull();
  });
});

describe("formatting", () => {
  it("renders pretty text", () => {
    const s = formulaToString(tk("(C1 + C2) * 2"), (id) => Object.keys(codes).find((k) => codes[k] === id)!, { pretty: true });
    expect(s).toBe("(C1 + C2) × 2");
  });
});
