import { z } from "zod";

export type Operator = "+" | "-" | "*" | "/";
export const OPERATORS: Operator[] = ["+", "-", "*", "/"];

export const OPERATOR_LABELS: Record<Operator, string> = {
  "+": "Add",
  "-": "Subtract",
  "*": "Multiply",
  "/": "Divide",
};

/** Display glyphs for operators (stored form is always + - * /). */
export const OPERATOR_GLYPHS: Record<Operator, string> = {
  "+": "+",
  "-": "−",
  "*": "×",
  "/": "÷",
};

/**
 * Structured formula representation persisted for calculated categories.
 * Each token has a stable `id` so the visual builder can reorder it.
 * Categories are referenced by ID (not by name/code), so renames never
 * break a formula.
 */
export type FormulaToken =
  | { id: string; kind: "category"; categoryId: string }
  | { id: string; kind: "operator"; op: Operator }
  | { id: string; kind: "lparen" }
  | { id: string; kind: "rparen" }
  | { id: string; kind: "number"; value: number };

export const formulaTokenSchema = z.discriminatedUnion("kind", [
  z.object({ id: z.string().min(1).max(64), kind: z.literal("category"), categoryId: z.string().min(1).max(64) }),
  z.object({ id: z.string().min(1).max(64), kind: z.literal("operator"), op: z.enum(["+", "-", "*", "/"]) }),
  z.object({ id: z.string().min(1).max(64), kind: z.literal("lparen") }),
  z.object({ id: z.string().min(1).max(64), kind: z.literal("rparen") }),
  z.object({
    id: z.string().min(1).max(64),
    kind: z.literal("number"),
    value: z.number().finite().min(-1e12).max(1e12),
  }),
]);

export const formulaSchema = z.array(formulaTokenSchema).min(1, "Formula is empty").max(200, "Formula is too long");

export function referencedCategoryIds(tokens: FormulaToken[] | null | undefined): string[] {
  if (!tokens) return [];
  const seen = new Set<string>();
  for (const t of tokens) if (t.kind === "category") seen.add(t.categoryId);
  return [...seen];
}

/** Parse the JSON stored in the DB; returns null when absent or malformed. */
export function parseStoredFormula(raw: string | null | undefined): FormulaToken[] | null {
  if (!raw) return null;
  try {
    const parsed = formulaSchema.safeParse(JSON.parse(raw));
    return parsed.success ? (parsed.data as FormulaToken[]) : null;
  } catch {
    return null;
  }
}
