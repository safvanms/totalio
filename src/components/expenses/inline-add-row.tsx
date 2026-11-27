"use client";

import { useRef, useState } from "react";
import { Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/primitives";
import { useCreateExpenses } from "@/hooks/use-data";
import { useFormat } from "@/hooks/use-settings";
import { errorMessage } from "@/lib/api-client";
import { todayKey } from "@/lib/dates";
import { expenseInputSchema } from "@/lib/validation";

/**
 * Always-visible entry row under a category's expense list: type, Enter,
 * type the next one. Focus returns to "Particular" after each add, and the
 * date is kept so a batch for one day is fast to enter.
 */
export function InlineAddRow({ categoryId }: { categoryId: string }) {
  const [particular, setParticular] = useState("");
  const [amount, setAmount] = useState("");
  const [date, setDate] = useState(todayKey());
  const [error, setError] = useState<string | null>(null);
  const create = useCreateExpenses();
  const { currency } = useFormat();
  const ref = useRef<HTMLInputElement>(null);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    const parsed = expenseInputSchema.safeParse({ categoryId, particular, amount, expenseDate: date });
    if (!parsed.success) {
      setError(parsed.error.issues[0]?.message ?? "Check the values");
      return;
    }
    setError(null);
    try {
      await create.mutateAsync([parsed.data]);
      setParticular("");
      setAmount("");
      ref.current?.focus();
    } catch (err) {
      setError(errorMessage(err));
    }
  };

  return (
    <form onSubmit={submit} className="border-t bg-muted/30 px-4 py-3" aria-label="Quick add expense">
      <div className="grid grid-cols-2 gap-2 md:grid-cols-[minmax(0,1fr)_9rem_10rem_auto]">
        <Input
          ref={ref}
          className="col-span-2 md:col-span-1"
          placeholder="Particular, e.g. Return ticket"
          value={particular}
          maxLength={120}
          onChange={(e) => setParticular(e.target.value)}
          aria-label="Particular"
        />
        <div className="relative">
          <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-sm text-muted-foreground">{currency.symbol}</span>
          <Input
            className="tabular pl-9"
            inputMode="decimal"
            type="number"
            step="0.01"
            min="0"
            placeholder="Amount"
            value={amount}
            onChange={(e) => setAmount(e.target.value)}
            aria-label="Amount"
          />
        </div>
        <Input type="date" value={date} onChange={(e) => setDate(e.target.value)} aria-label="Date" />
        <Button type="submit" loading={create.isPending} className="col-span-2 md:col-span-1">
          {!create.isPending && <Plus />} Add
        </Button>
      </div>
      {error ? (
        <p role="alert" className="mt-2 text-xs text-destructive">
          {error}
        </p>
      ) : (
        <p className="mt-2 hidden text-xs text-muted-foreground md:block">Press Enter to add. The form stays open for the next entry.</p>
      )}
    </form>
  );
}
