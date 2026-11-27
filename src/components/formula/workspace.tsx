"use client";

import { useState } from "react";
import { useDraggable, useDroppable } from "@dnd-kit/core";
import { SortableContext, rectSortingStrategy, useSortable } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { ArrowLeft, ArrowRight, Eraser, Hash, MousePointerClick, Redo2, Trash2, Undo2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/primitives";
import { Hint, Popover, PopoverContent, PopoverTrigger } from "@/components/ui/overlays";
import { OPERATOR_GLYPHS, OPERATOR_LABELS, OPERATORS, type FormulaToken, type Operator } from "@/lib/formula/tokens";
import { cn } from "@/lib/utils";
import { TokenChip } from "./token-chip";
import type { FormulaEditor, NewToken } from "./use-formula-editor";
import type { Category } from "@/lib/types";

/* Operator palette ---------------------------------------------------- */

function PaletteButton({ id, token, label, children, onAdd }: { id: string; token: NewToken; label: string; children: React.ReactNode; onAdd: () => void }) {
  const { attributes, listeners, setNodeRef, isDragging } = useDraggable({ id, data: { source: "palette", token } });
  return (
    <Hint label={`${label} — click or drag`}>
      <button
        ref={setNodeRef}
        type="button"
        {...attributes}
        {...listeners}
        onClick={onAdd}
        aria-label={label}
        className={cn(
          "flex h-11 min-w-11 touch-none items-center justify-center rounded-xl border bg-card px-3 text-lg font-semibold text-foreground shadow-sm transition-all hover:-translate-y-0.5 hover:border-primary/50 hover:text-primary hover:shadow-card-hover focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring active:translate-y-0 sm:h-10 sm:min-w-10",
          isDragging && "opacity-40",
        )}
      >
        {children}
      </button>
    </Hint>
  );
}

function NumberButton({ onAdd }: { onAdd: (n: number) => void }) {
  const [open, setOpen] = useState(false);
  const [v, setV] = useState("");
  const n = Number(v);
  const valid = v.trim() !== "" && Number.isFinite(n) && n >= 0 && n <= 1e12;
  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button variant="outline" className="h-11 rounded-xl px-3 sm:h-10" aria-label="Add a number">
          <Hash /> <span className="hidden xs:inline">Number</span>
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-64" align="start">
        <form
          onSubmit={(e) => {
            e.preventDefault();
            if (!valid) return;
            onAdd(Math.round(n * 1e6) / 1e6);
            setV("");
            setOpen(false);
          }}
          className="space-y-2"
        >
          <p className="text-sm font-medium">Add a constant</p>
          <p className="text-xs text-muted-foreground">e.g. multiply by 1.18 for tax, or divide by 12.</p>
          <Input autoFocus inputMode="decimal" type="number" step="any" min="0" value={v} onChange={(e) => setV(e.target.value)} placeholder="0" aria-label="Number value" />
          <Button type="submit" size="sm" className="w-full" disabled={!valid}>
            Add number
          </Button>
        </form>
      </PopoverContent>
    </Popover>
  );
}

export function OperatorPalette({ editor }: { editor: FormulaEditor }) {
  return (
    <div className="flex flex-wrap items-center gap-2" aria-label="Operators">
      {OPERATORS.map((op) => (
        <PaletteButton key={op} id={`pal:${op}`} token={{ kind: "operator", op }} label={OPERATOR_LABELS[op]} onAdd={() => editor.insert({ kind: "operator", op })}>
          {OPERATOR_GLYPHS[op]}
        </PaletteButton>
      ))}
      <span className="mx-0.5 hidden h-6 w-px bg-border xs:block" aria-hidden />
      <PaletteButton id="pal:(" token={{ kind: "lparen" }} label="Open parenthesis" onAdd={() => editor.insert({ kind: "lparen" })}>
        (
      </PaletteButton>
      <PaletteButton id="pal:)" token={{ kind: "rparen" }} label="Close parenthesis" onAdd={() => editor.insert({ kind: "rparen" })}>
        )
      </PaletteButton>
      <NumberButton onAdd={(value) => editor.insert({ kind: "number", value })} />
      <div className="ml-auto flex items-center gap-1">
        <Hint label="Undo (Ctrl+Z)">
          <Button variant="ghost" size="icon" onClick={editor.undo} disabled={!editor.canUndo} aria-label="Undo">
            <Undo2 />
          </Button>
        </Hint>
        <Hint label="Redo (Ctrl+Y)">
          <Button variant="ghost" size="icon" onClick={editor.redo} disabled={!editor.canRedo} aria-label="Redo">
            <Redo2 />
          </Button>
        </Hint>
        <Hint label="Clear formula">
          <Button variant="ghost" size="icon" onClick={editor.clear} disabled={!editor.tokens.length} aria-label="Clear formula" className="hover:text-destructive">
            <Eraser />
          </Button>
        </Hint>
      </div>
    </div>
  );
}

/* Workspace ----------------------------------------------------------- */

function SortableToken({
  token,
  editor,
  category,
  value,
  formatValue,
  invalid,
}: {
  token: FormulaToken;
  editor: FormulaEditor;
  category?: Category;
  value?: number | null;
  formatValue: (n: number | null | undefined) => string;
  invalid: boolean;
}) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id: token.id, data: { source: "workspace" } });
  return (
    <TokenChip
      ref={setNodeRef}
      token={token}
      category={category}
      value={value}
      formatValue={formatValue}
      selected={editor.selectedId === token.id}
      invalid={invalid}
      dragging={isDragging}
      style={{ transform: CSS.Translate.toString(transform), transition }}
      className="cursor-grab touch-none active:cursor-grabbing"
      {...attributes}
      {...listeners}
      role="button"
      aria-pressed={editor.selectedId === token.id}
      onClick={(e) => {
        e.stopPropagation();
        editor.select(token.id);
      }}
    />
  );
}

function CaretSlot({ index, editor, active }: { index: number; editor: FormulaEditor; active: boolean }) {
  return (
    <button
      type="button"
      tabIndex={-1}
      aria-label={`Set insertion point at position ${index}`}
      onClick={(e) => {
        e.stopPropagation();
        editor.setCaret(index);
      }}
      className="group -mx-1 flex h-12 w-4 shrink-0 items-center justify-center"
    >
      <span
        className={cn(
          "h-8 w-[3px] rounded-full transition-colors",
          active ? "animate-pulse bg-primary" : "bg-transparent group-hover:bg-primary/30",
        )}
      />
    </button>
  );
}

export function FormulaWorkspace({
  editor,
  categoriesById,
  values,
  formatValue,
  errorIndex,
  resultLabel,
}: {
  editor: FormulaEditor;
  categoriesById: Map<string, Category>;
  values: Map<string, number | null>;
  formatValue: (n: number | null | undefined) => string;
  errorIndex: number | null;
  resultLabel: React.ReactNode;
}) {
  const { setNodeRef, isOver, active } = useDroppable({ id: "workspace" });
  const draggingExternal = !!active && active.data.current?.source !== "workspace";

  const onKeyDown = (e: React.KeyboardEvent) => {
    const mod = e.ctrlKey || e.metaKey;
    if (mod && e.key.toLowerCase() === "z") {
      e.preventDefault();
      return e.shiftKey ? editor.redo() : editor.undo();
    }
    if (mod && e.key.toLowerCase() === "y") {
      e.preventDefault();
      return editor.redo();
    }
    if (mod) return;
    const ops: Record<string, Operator> = { "+": "+", "-": "-", "*": "*", x: "*", "/": "/" };
    if (ops[e.key]) {
      e.preventDefault();
      return editor.insert({ kind: "operator", op: ops[e.key] });
    }
    switch (e.key) {
      case "(":
        e.preventDefault();
        return editor.insert({ kind: "lparen" });
      case ")":
        e.preventDefault();
        return editor.insert({ kind: "rparen" });
      case "ArrowLeft":
        e.preventDefault();
        return editor.setCaret(editor.caret - 1);
      case "ArrowRight":
        e.preventDefault();
        return editor.setCaret(editor.caret + 1);
      case "Home":
        e.preventDefault();
        return editor.setCaret(0);
      case "End":
        e.preventDefault();
        return editor.setCaret(editor.tokens.length);
      case "Backspace":
        e.preventDefault();
        return editor.dispatch({ type: "backspace" });
      case "Delete":
        e.preventDefault();
        return editor.dispatch({ type: "delete" });
      case "Escape":
        return editor.select(null);
    }
  };

  return (
    <div
      ref={setNodeRef}
      tabIndex={0}
      onKeyDown={onKeyDown}
      onClick={() => editor.setCaret(editor.tokens.length)}
      aria-label="Formula workspace. Use arrow keys to move the insertion point, operator keys to insert, Backspace to delete."
      className={cn(
        "relative min-h-[9.5rem] rounded-2xl border-2 border-dashed p-3 outline-none transition-colors focus-visible:border-primary/60 sm:p-4",
        "bg-[radial-gradient(hsl(var(--border))_1px,transparent_1px)] [background-size:16px_16px]",
        draggingExternal ? "border-primary/50 bg-primary/[0.03]" : "border-border",
        isOver && draggingExternal && "border-primary bg-primary/[0.06]",
      )}
    >
      {editor.tokens.length === 0 ? (
        <div className="flex min-h-[7.5rem] flex-col items-center justify-center gap-2 text-center">
          <MousePointerClick className="h-6 w-6 text-primary/70" />
          <p className="text-sm font-medium">{isOver ? "Drop to add" : "Drag categories here"}</p>
          <p className="max-w-xs text-xs text-muted-foreground">
            Or tap <span className="font-semibold text-foreground">+</span> next to a category. Add operators from the toolbar to combine them.
          </p>
        </div>
      ) : (
        <SortableContext items={editor.tokens.map((t) => t.id)} strategy={rectSortingStrategy}>
          <div className="flex min-w-0 flex-wrap items-center gap-x-2 gap-y-3">
            {editor.tokens.map((t, i) => (
              <div key={t.id} className="flex min-w-0 max-w-full items-center">
                <CaretSlot index={i} editor={editor} active={editor.caret === i && !editor.selectedId} />
                <SortableToken
                  token={t}
                  editor={editor}
                  category={t.kind === "category" ? categoriesById.get(t.categoryId) : undefined}
                  value={t.kind === "category" ? values.get(t.categoryId) : undefined}
                  formatValue={formatValue}
                  invalid={errorIndex === i}
                />
              </div>
            ))}
            <CaretSlot index={editor.tokens.length} editor={editor} active={editor.caret === editor.tokens.length && !editor.selectedId} />
          </div>
        </SortableContext>
      )}
      <div className="mt-4 flex min-w-0 items-center gap-2 border-t border-dashed pt-3 text-sm">{resultLabel}</div>
    </div>
  );
}

/* Selection actions --------------------------------------------------- */

export function SelectionBar({ editor, categoriesById }: { editor: FormulaEditor; categoriesById: Map<string, Category> }) {
  const idx = editor.tokens.findIndex((t) => t.id === editor.selectedId);
  const token = idx >= 0 ? editor.tokens[idx] : null;
  const [num, setNum] = useState("");
  if (!token) {
    return (
      <p className="text-xs text-muted-foreground">
        <span className="hidden md:inline">Drag blocks to reorder. </span>Tap a block to move, replace or remove it. The blinking bar marks where new items are inserted.
      </p>
    );
  }
  const name =
    token.kind === "category"
      ? categoriesById.get(token.categoryId)?.name ?? "Category"
      : token.kind === "operator"
        ? OPERATOR_LABELS[token.op]
        : token.kind === "number"
          ? `Number ${token.value}`
          : token.kind === "lparen"
            ? "Opening parenthesis"
            : "Closing parenthesis";
  return (
    <div className="flex flex-wrap items-center gap-2 rounded-xl border bg-muted/40 p-2 animate-fade-in">
      <span className="min-w-0 flex-1 truncate px-1 text-sm">
        <span className="text-muted-foreground">Selected:</span> <span className="font-medium">{name}</span>
      </span>
      {token.kind === "operator" && (
        <div className="flex gap-1" aria-label="Replace operator">
          {OPERATORS.map((op) => (
            <Button
              key={op}
              size="icon-sm"
              variant={token.op === op ? "default" : "outline"}
              onClick={() => editor.replace(token.id, { kind: "operator", op })}
              aria-label={`Change to ${OPERATOR_LABELS[op]}`}
            >
              <span className="text-base">{OPERATOR_GLYPHS[op]}</span>
            </Button>
          ))}
        </div>
      )}
      {token.kind === "number" && (
        <form
          className="flex gap-1"
          onSubmit={(e) => {
            e.preventDefault();
            const n = Number(num);
            if (num.trim() !== "" && Number.isFinite(n) && n >= 0) editor.replace(token.id, { kind: "number", value: n });
            setNum("");
          }}
        >
          <Input className="h-10 w-24 sm:h-8" type="number" step="any" min="0" placeholder={String(token.value)} value={num} onChange={(e) => setNum(e.target.value)} aria-label="New value" />
          <Button type="submit" size="sm" variant="outline" className="sm:h-8">
            Set
          </Button>
        </form>
      )}
      <div className="flex gap-1">
        <Button size="icon-sm" variant="outline" onClick={() => editor.move(token.id, -1)} disabled={idx === 0} aria-label="Move left">
          <ArrowLeft />
        </Button>
        <Button size="icon-sm" variant="outline" onClick={() => editor.move(token.id, 1)} disabled={idx === editor.tokens.length - 1} aria-label="Move right">
          <ArrowRight />
        </Button>
        <Button size="icon-sm" variant="outline" className="hover:border-destructive/50 hover:text-destructive" onClick={() => editor.remove(token.id)} aria-label="Remove">
          <Trash2 />
        </Button>
      </div>
    </div>
  );
}
