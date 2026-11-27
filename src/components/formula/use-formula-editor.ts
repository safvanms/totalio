"use client";

import { useCallback, useReducer } from "react";
import type { FormulaToken, Operator } from "@/lib/formula/tokens";
import { uid } from "@/lib/utils";

export type NewToken =
  | { kind: "category"; categoryId: string }
  | { kind: "operator"; op: Operator }
  | { kind: "lparen" }
  | { kind: "rparen" }
  | { kind: "number"; value: number };

interface State {
  tokens: FormulaToken[];
  /** insertion point, 0..tokens.length */
  caret: number;
  selectedId: string | null;
  past: FormulaToken[][];
  future: FormulaToken[][];
}

type Action =
  | { type: "insert"; token: NewToken; at?: number; smart?: boolean }
  | { type: "remove"; id: string }
  | { type: "backspace" }
  | { type: "delete" }
  | { type: "move"; id: string; dir: -1 | 1 }
  | { type: "reorder"; from: number; to: number }
  | { type: "replace"; id: string; token: NewToken }
  | { type: "caret"; at: number }
  | { type: "select"; id: string | null }
  | { type: "set"; tokens: FormulaToken[]; resetHistory?: boolean }
  | { type: "clear" }
  | { type: "undo" }
  | { type: "redo" };

const make = (t: NewToken): FormulaToken => ({ id: uid("tk"), ...t }) as FormulaToken;

const isValueEnd = (t: FormulaToken | undefined) => !!t && (t.kind === "category" || t.kind === "number" || t.kind === "rparen");
const startsValue = (t: NewToken) => t.kind === "category" || t.kind === "number" || t.kind === "lparen";

function commit(s: State, tokens: FormulaToken[], caret: number, selectedId: string | null = null): State {
  return {
    tokens,
    caret: Math.max(0, Math.min(caret, tokens.length)),
    selectedId,
    past: [...s.past.slice(-49), s.tokens],
    future: [],
  };
}

function reducer(s: State, a: Action): State {
  switch (a.type) {
    case "insert": {
      const at = Math.max(0, Math.min(a.at ?? s.caret, s.tokens.length));
      const next = [...s.tokens];
      const inserted: FormulaToken[] = [];
      // Smart insert: dropping a value right after another value adds a "+" between them.
      if (a.smart !== false && startsValue(a.token) && isValueEnd(next[at - 1])) {
        inserted.push(make({ kind: "operator", op: "+" }));
      }
      const tok = make(a.token);
      inserted.push(tok);
      // ...and before a following value.
      if (a.smart !== false && (a.token.kind === "category" || a.token.kind === "number" || a.token.kind === "rparen") && next[at] && (next[at].kind === "category" || next[at].kind === "number" || next[at].kind === "lparen")) {
        inserted.push(make({ kind: "operator", op: "+" }));
      }
      next.splice(at, 0, ...inserted);
      // Caret lands right after the inserted token itself.
      return commit(s, next, at + inserted.indexOf(tok) + 1);
    }
    case "remove": {
      const idx = s.tokens.findIndex((t) => t.id === a.id);
      if (idx < 0) return s;
      const next = s.tokens.filter((t) => t.id !== a.id);
      return commit(s, next, idx);
    }
    case "backspace": {
      if (s.selectedId) return reducer(s, { type: "remove", id: s.selectedId });
      if (s.caret === 0) return s;
      const next = [...s.tokens];
      next.splice(s.caret - 1, 1);
      return commit(s, next, s.caret - 1);
    }
    case "delete": {
      if (s.selectedId) return reducer(s, { type: "remove", id: s.selectedId });
      if (s.caret >= s.tokens.length) return s;
      const next = [...s.tokens];
      next.splice(s.caret, 1);
      return commit(s, next, s.caret);
    }
    case "move": {
      const idx = s.tokens.findIndex((t) => t.id === a.id);
      const to = idx + a.dir;
      if (idx < 0 || to < 0 || to >= s.tokens.length) return s;
      const next = [...s.tokens];
      const [t] = next.splice(idx, 1);
      next.splice(to, 0, t);
      return commit(s, next, to + 1, a.id);
    }
    case "reorder": {
      if (a.from === a.to) return s;
      const next = [...s.tokens];
      const [t] = next.splice(a.from, 1);
      next.splice(a.to, 0, t);
      return commit(s, next, a.to + 1, null);
    }
    case "replace": {
      const idx = s.tokens.findIndex((t) => t.id === a.id);
      if (idx < 0) return s;
      const next = [...s.tokens];
      next[idx] = { ...make(a.token), id: a.id } as FormulaToken;
      return commit(s, next, s.caret, a.id);
    }
    case "caret":
      return { ...s, caret: Math.max(0, Math.min(a.at, s.tokens.length)), selectedId: null };
    case "select": {
      if (!a.id) return { ...s, selectedId: null };
      const idx = s.tokens.findIndex((t) => t.id === a.id);
      return { ...s, selectedId: s.selectedId === a.id ? null : a.id, caret: idx + 1 };
    }
    case "set":
      return a.resetHistory
        ? { tokens: a.tokens, caret: a.tokens.length, selectedId: null, past: [], future: [] }
        : commit(s, a.tokens, a.tokens.length);
    case "clear":
      return s.tokens.length ? commit(s, [], 0) : s;
    case "undo": {
      if (!s.past.length) return s;
      const prev = s.past[s.past.length - 1];
      return { tokens: prev, caret: prev.length, selectedId: null, past: s.past.slice(0, -1), future: [s.tokens, ...s.future] };
    }
    case "redo": {
      if (!s.future.length) return s;
      const [next, ...rest] = s.future;
      return { tokens: next, caret: next.length, selectedId: null, past: [...s.past, s.tokens], future: rest };
    }
  }
}

export function useFormulaEditor(initial: FormulaToken[] = []) {
  const [state, dispatch] = useReducer(reducer, {
    tokens: initial,
    caret: initial.length,
    selectedId: null,
    past: [],
    future: [],
  });
  const insert = useCallback((token: NewToken, at?: number) => dispatch({ type: "insert", token, at }), []);
  return {
    ...state,
    canUndo: state.past.length > 0,
    canRedo: state.future.length > 0,
    dispatch,
    insert,
    remove: (id: string) => dispatch({ type: "remove", id }),
    move: (id: string, dir: -1 | 1) => dispatch({ type: "move", id, dir }),
    reorder: (from: number, to: number) => dispatch({ type: "reorder", from, to }),
    replace: (id: string, token: NewToken) => dispatch({ type: "replace", id, token }),
    setCaret: (at: number) => dispatch({ type: "caret", at }),
    select: (id: string | null) => dispatch({ type: "select", id }),
    set: (tokens: FormulaToken[], resetHistory = false) => dispatch({ type: "set", tokens, resetHistory }),
    clear: () => dispatch({ type: "clear" }),
    undo: () => dispatch({ type: "undo" }),
    redo: () => dispatch({ type: "redo" }),
  };
}

export type FormulaEditor = ReturnType<typeof useFormulaEditor>;
