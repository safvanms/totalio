/**
 * Safe formula parser. No eval(), no Function(): a recursive-descent parser
 * over structured tokens builds an AST that honours operator precedence
 * (* and / bind tighter than + and -) and parentheses. Every failure is
 * reported with a human-readable message and the offending token index so
 * the visual builder can highlight it.
 *
 * Grammar:
 *   expression := term (("+" | "-") term)*
 *   term       := factor (("*" | "/") factor)*
 *   factor     := NUMBER | CATEGORY | "(" expression ")"
 */
import type { FormulaToken, Operator } from "./tokens";
import { OPERATOR_GLYPHS, OPERATORS } from "./tokens";
import { uid } from "@/lib/utils";

export type FormulaNode =
  | { type: "number"; value: number; tokenIndex: number }
  | { type: "ref"; categoryId: string; tokenIndex: number }
  | { type: "binary"; op: Operator; left: FormulaNode; right: FormulaNode; tokenIndex: number };

export class FormulaError extends Error {
  /** Index of the offending token, or null for whole-formula errors */
  tokenIndex: number | null;
  constructor(message: string, tokenIndex: number | null = null) {
    super(message);
    this.name = "FormulaError";
    this.tokenIndex = tokenIndex;
  }
}

export type ParseResult = { ok: true; ast: FormulaNode } | { ok: false; error: FormulaError };

type NameOf = (categoryId: string) => string;

const isOperand = (t: FormulaToken | undefined) => !!t && (t.kind === "category" || t.kind === "number");

function describe(t: FormulaToken, nameOf: NameOf): string {
  switch (t.kind) {
    case "category":
      return `"${nameOf(t.categoryId)}"`;
    case "number":
      return String(t.value);
    case "operator":
      return `"${OPERATOR_GLYPHS[t.op]}"`;
    case "lparen":
      return '"("';
    case "rparen":
      return '")"';
  }
}

/**
 * Structural pre-check producing friendly messages for the common mistakes
 * a user makes while building visually.
 */
function precheck(tokens: FormulaToken[], nameOf: NameOf): FormulaError | null {
  if (tokens.length === 0) return new FormulaError("Add at least one category to start the formula.");
  let depth = 0;
  for (let i = 0; i < tokens.length; i++) {
    const t = tokens[i];
    const prev = tokens[i - 1];
    if (t.kind === "operator") {
      if (!prev || prev.kind === "lparen") {
        return new FormulaError(
          i === 0
            ? `The formula can't start with ${describe(t, nameOf)}. Add a category first.`
            : `${describe(t, nameOf)} needs a value on its left side.`,
          i,
        );
      }
      if (prev.kind === "operator") {
        return new FormulaError(
          `Two operators in a row (${describe(prev, nameOf)} and ${describe(t, nameOf)}). Add a category between them or remove one.`,
          i,
        );
      }
    }
    if (isOperand(t) || t.kind === "lparen") {
      if (prev && (isOperand(prev) || prev.kind === "rparen")) {
        return new FormulaError(
          `Missing operator between ${describe(prev, nameOf)} and ${describe(t, nameOf)}.`,
          i,
        );
      }
    }
    if (t.kind === "lparen") depth++;
    if (t.kind === "rparen") {
      if (prev?.kind === "lparen") return new FormulaError("Empty parentheses. Put a category inside or remove them.", i);
      if (prev?.kind === "operator") {
        return new FormulaError(`${describe(prev, nameOf)} needs a value on its right side.`, i - 1);
      }
      depth--;
      if (depth < 0) return new FormulaError('Closing ")" has no matching opening "(".', i);
    }
  }
  const last = tokens[tokens.length - 1];
  if (last.kind === "operator") {
    return new FormulaError(`The formula can't end with ${describe(last, nameOf)}. Add a category after it.`, tokens.length - 1);
  }
  if (depth > 0) {
    const idx = findUnclosedParen(tokens);
    return new FormulaError(`${depth} unclosed parenthesis${depth > 1 ? "es" : ""}. Add a closing ")".`, idx);
  }
  return null;
}

function findUnclosedParen(tokens: FormulaToken[]): number | null {
  const stack: number[] = [];
  tokens.forEach((t, i) => {
    if (t.kind === "lparen") stack.push(i);
    if (t.kind === "rparen") stack.pop();
  });
  return stack.length ? stack[stack.length - 1] : null;
}

export function parseFormula(tokens: FormulaToken[], nameOf: NameOf = (id) => id): ParseResult {
  const pre = precheck(tokens, nameOf);
  if (pre) return { ok: false, error: pre };

  let pos = 0;
  const peek = () => tokens[pos];

  function parseExpression(): FormulaNode {
    let left = parseTerm();
    for (let t = peek(); t && t.kind === "operator" && (t.op === "+" || t.op === "-"); t = peek()) {
      const idx = pos++;
      left = { type: "binary", op: t.op, left, right: parseTerm(), tokenIndex: idx };
    }
    return left;
  }

  function parseTerm(): FormulaNode {
    let left = parseFactor();
    for (let t = peek(); t && t.kind === "operator" && (t.op === "*" || t.op === "/"); t = peek()) {
      const idx = pos++;
      const right = parseFactor();
      if (t.op === "/" && right.type === "number" && right.value === 0) {
        throw new FormulaError("Division by zero: you can't divide by 0.", right.tokenIndex);
      }
      left = { type: "binary", op: t.op, left, right, tokenIndex: idx };
    }
    return left;
  }

  function parseFactor(): FormulaNode {
    const t = peek();
    if (!t) throw new FormulaError("The formula ended unexpectedly.", tokens.length - 1);
    const idx = pos++;
    switch (t.kind) {
      case "number":
        return { type: "number", value: t.value, tokenIndex: idx };
      case "category":
        return { type: "ref", categoryId: t.categoryId, tokenIndex: idx };
      case "lparen": {
        const inner = parseExpression();
        const close = peek();
        if (!close || close.kind !== "rparen") throw new FormulaError('Missing closing ")".', idx);
        pos++;
        return inner;
      }
      default:
        throw new FormulaError(`Unexpected ${describe(t, nameOf)}.`, idx);
    }
  }

  try {
    const ast = parseExpression();
    if (pos < tokens.length) throw new FormulaError(`Unexpected ${describe(tokens[pos], nameOf)}.`, pos);
    return { ok: true, ast };
  } catch (e) {
    if (e instanceof FormulaError) return { ok: false, error: e };
    throw e;
  }
}

/* ------------------------------------------------------------------ */
/* Evaluation                                                          */
/* ------------------------------------------------------------------ */

export type EvalResult =
  | { ok: true; value: number }
  | { ok: false; reason: "division-by-zero" | "missing-reference" | "invalid"; message: string; tokenIndex: number | null };

/**
 * Evaluates an AST. `resolve` returns the value for a category, or null when
 * it can't be resolved (deleted category or an upstream error).
 */
export function evaluateAst(ast: FormulaNode, resolve: (categoryId: string) => number | null): EvalResult {
  function walk(n: FormulaNode): number {
    switch (n.type) {
      case "number":
        return n.value;
      case "ref": {
        const v = resolve(n.categoryId);
        if (v === null || !Number.isFinite(v)) {
          throw Object.assign(new FormulaError("A referenced category could not be resolved.", n.tokenIndex), {
            reason: "missing-reference",
          });
        }
        return v;
      }
      case "binary": {
        const l = walk(n.left);
        const r = walk(n.right);
        switch (n.op) {
          case "+":
            return l + r;
          case "-":
            return l - r;
          case "*":
            return l * r;
          case "/":
            if (r === 0) {
              throw Object.assign(
                new FormulaError("Division by zero: the divisor evaluates to 0 for this period.", n.tokenIndex),
                { reason: "division-by-zero" },
              );
            }
            return l / r;
        }
      }
    }
  }
  try {
    const value = walk(ast);
    if (!Number.isFinite(value)) {
      return { ok: false, reason: "invalid", message: "The result is not a finite number.", tokenIndex: null };
    }
    return { ok: true, value: Math.round(value * 100) / 100 };
  } catch (e) {
    if (e instanceof FormulaError) {
      const reason = (e as FormulaError & { reason?: "division-by-zero" | "missing-reference" }).reason ?? "invalid";
      return { ok: false, reason, message: e.message, tokenIndex: e.tokenIndex };
    }
    throw e;
  }
}

/** Parse + evaluate in one step. */
export function evaluateFormula(
  tokens: FormulaToken[],
  resolve: (categoryId: string) => number | null,
  nameOf?: NameOf,
): EvalResult {
  const parsed = parseFormula(tokens, nameOf);
  if (!parsed.ok) {
    return { ok: false, reason: "invalid", message: parsed.error.message, tokenIndex: parsed.error.tokenIndex };
  }
  return evaluateAst(parsed.ast, resolve);
}

/* ------------------------------------------------------------------ */
/* Text <-> tokens                                                     */
/* ------------------------------------------------------------------ */

/** Render tokens as text, e.g. "C1 + (C2 × 3)" or with category names. */
export function formulaToString(
  tokens: FormulaToken[] | null | undefined,
  label: (categoryId: string) => string,
  opts: { pretty?: boolean } = {},
): string {
  if (!tokens?.length) return "";
  const parts: string[] = [];
  for (const t of tokens) {
    switch (t.kind) {
      case "category":
        parts.push(label(t.categoryId));
        break;
      case "number":
        parts.push(String(t.value));
        break;
      case "operator":
        parts.push(opts.pretty ? OPERATOR_GLYPHS[t.op] : t.op);
        break;
      case "lparen":
        parts.push("(");
        break;
      case "rparen":
        parts.push(")");
        break;
    }
  }
  return parts.join(" ").replace(/\( /g, "(").replace(/ \)/g, ")");
}

/**
 * Lexer for a textual formula such as "(C1 + C2) * 1.5 - C3".
 * Category references are resolved through `codeToId` (e.g. "C1" -> id).
 */
export function tokenizeText(text: string, codeToId: (code: string) => string | undefined): FormulaToken[] {
  const out: FormulaToken[] = [];
  let i = 0;
  while (i < text.length) {
    const ch = text[i];
    if (/\s/.test(ch)) {
      i++;
      continue;
    }
    if ((OPERATORS as string[]).includes(ch)) {
      out.push({ id: uid(), kind: "operator", op: ch as Operator });
      i++;
      continue;
    }
    if (ch === "×") {
      out.push({ id: uid(), kind: "operator", op: "*" });
      i++;
      continue;
    }
    if (ch === "÷") {
      out.push({ id: uid(), kind: "operator", op: "/" });
      i++;
      continue;
    }
    if (ch === "−") {
      out.push({ id: uid(), kind: "operator", op: "-" });
      i++;
      continue;
    }
    if (ch === "(") {
      out.push({ id: uid(), kind: "lparen" });
      i++;
      continue;
    }
    if (ch === ")") {
      out.push({ id: uid(), kind: "rparen" });
      i++;
      continue;
    }
    const num = /^\d+(\.\d+)?/.exec(text.slice(i));
    if (num) {
      out.push({ id: uid(), kind: "number", value: Number(num[0]) });
      i += num[0].length;
      continue;
    }
    const ident = /^[A-Za-z][A-Za-z0-9_]*/.exec(text.slice(i));
    if (ident) {
      const id = codeToId(ident[0].toUpperCase());
      if (!id) throw new FormulaError(`Unknown category "${ident[0]}".`, out.length);
      out.push({ id: uid(), kind: "category", categoryId: id });
      i += ident[0].length;
      continue;
    }
    throw new FormulaError(`Unexpected character "${ch}".`, out.length);
  }
  return out;
}
