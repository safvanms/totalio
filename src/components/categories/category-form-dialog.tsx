"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { Controller, useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Calculator, ListPlus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogBody, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/overlays";
import { Field, Input, Textarea } from "@/components/ui/primitives";
import { CategoryIcon } from "@/components/shared/common";
import { ColorPicker, IconPicker } from "@/components/shared/pickers";
import { useCategories, useCreateCategory, useUpdateCategory } from "@/hooks/use-data";
import { nextCategoryColor } from "@/lib/constants";
import { errorMessage } from "@/lib/api-client";
import { hexColor } from "@/lib/validation";
import { cn } from "@/lib/utils";
import { useDialogs } from "@/stores/dialog-store";

const formSchema = z.object({
  name: z.string().trim().min(1, "Name is required").max(60, "Name must be 60 characters or fewer"),
  description: z.string().max(240, "Keep the description under 240 characters").optional(),
  color: hexColor,
  icon: z.string().min(1, "Pick an icon"),
  type: z.enum(["NORMAL", "CALCULATED"]),
});
type FormValues = z.infer<typeof formSchema>;

export function CategoryFormDialog() {
  const router = useRouter();
  const { category: state, closeCategory } = useDialogs();
  const editing = state.category ?? null;
  const { data: categories = [] } = useCategories();
  const create = useCreateCategory();
  const update = useUpdateCategory();

  const form = useForm<FormValues>({
    resolver: zodResolver(formSchema),
    defaultValues: { name: "", description: "", color: "#257de0", icon: "tag", type: "NORMAL" },
  });

  useEffect(() => {
    if (!state.open) return;
    form.reset(
      editing
        ? { name: editing.name, description: editing.description ?? "", color: editing.color, icon: editing.icon, type: editing.type }
        : {
            name: "",
            description: "",
            color: nextCategoryColor(categories.map((c) => c.color)),
            icon: state.type === "CALCULATED" ? "calculator" : "tag",
            type: state.type ?? "NORMAL",
          },
    );
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [state.open, editing?.id]);

  const values = form.watch();
  const typeLocked = !!editing && editing.type === "NORMAL" && editing.expenseCount > 0;

  const onSubmit = form.handleSubmit(async (v) => {
    try {
      if (editing) {
        await update.mutateAsync({ id: editing.id, input: { ...v, description: v.description || null } });
        closeCategory();
      } else {
        const created = await create.mutateAsync({ ...v, description: v.description || null, formula: null });
        closeCategory();
        if (created.type === "CALCULATED") router.push(`/formula-builder?id=${created.id}`);
      }
    } catch (e) {
      const msg = errorMessage(e);
      if (/name/i.test(msg)) form.setError("name", { message: msg });
      else form.setError("root", { message: msg });
    }
  });

  return (
    <Dialog open={state.open} onOpenChange={(o) => !o && closeCategory()}>
      <DialogContent size="lg">
        <form onSubmit={onSubmit} className="flex min-h-0 flex-1 flex-col" noValidate>
          <DialogHeader>
            <DialogTitle>{editing ? "Edit category" : "New category"}</DialogTitle>
            <DialogDescription>
              {editing ? `${editing.code} · Update how this category looks and behaves.` : "Group related expenses, or combine categories with a formula."}
            </DialogDescription>
          </DialogHeader>
          <DialogBody className="space-y-5 pb-5">
            <div className="flex items-center gap-3 rounded-xl border bg-muted/30 p-3">
              <CategoryIcon icon={values.icon} color={values.color} size="lg" />
              <div className="min-w-0">
                <p className="truncate font-semibold">{values.name || "Category name"}</p>
                <p className="truncate text-xs text-muted-foreground">{values.type === "CALCULATED" ? "Calculated from a formula" : "Holds expense entries"}</p>
              </div>
            </div>

            <div className="grid gap-4 sm:grid-cols-2">
              <Field label="Name" htmlFor="cat-name" error={form.formState.errors.name?.message} required className="sm:col-span-2">
                <Input id="cat-name" autoFocus placeholder="e.g. Train Tickets" maxLength={60} aria-invalid={!!form.formState.errors.name} {...form.register("name")} />
              </Field>
              <Field label="Description" htmlFor="cat-desc" error={form.formState.errors.description?.message} className="sm:col-span-2">
                <Textarea id="cat-desc" rows={2} placeholder="Optional" maxLength={240} {...form.register("description")} />
              </Field>
            </div>

            <Field label="Category type" hint={typeLocked ? "This category already has expenses, so it can't become calculated." : undefined}>
              <Controller
                control={form.control}
                name="type"
                render={({ field }) => (
                  <div className="grid gap-2 sm:grid-cols-2" role="radiogroup">
                    {(
                      [
                        { v: "NORMAL", title: "Normal", desc: "Add expense entries manually", icon: ListPlus },
                        { v: "CALCULATED", title: "Calculated", desc: "Total derived from a formula", icon: Calculator },
                      ] as const
                    ).map((o) => (
                      <button
                        key={o.v}
                        type="button"
                        role="radio"
                        aria-checked={field.value === o.v}
                        disabled={typeLocked && o.v === "CALCULATED"}
                        onClick={() => field.onChange(o.v)}
                        className={cn(
                          "flex items-start gap-3 rounded-xl border p-3 text-left transition-colors hover:bg-accent/50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-50",
                          field.value === o.v && "border-primary bg-primary/5 ring-1 ring-primary",
                        )}
                      >
                        <o.icon className={cn("mt-0.5 h-5 w-5 shrink-0", field.value === o.v ? "text-primary" : "text-muted-foreground")} />
                        <span>
                          <span className="block text-sm font-medium">{o.title}</span>
                          <span className="block text-xs text-muted-foreground">{o.desc}</span>
                        </span>
                      </button>
                    ))}
                  </div>
                )}
              />
            </Field>

            <Field label="Colour">
              <Controller control={form.control} name="color" render={({ field }) => <ColorPicker value={field.value} onChange={field.onChange} />} />
            </Field>
            <Field label="Icon">
              <Controller
                control={form.control}
                name="icon"
                render={({ field }) => <IconPicker value={field.value} onChange={field.onChange} color={values.color} />}
              />
            </Field>

            {form.formState.errors.root && (
              <p role="alert" className="rounded-lg border border-destructive/30 bg-destructive/5 px-3 py-2 text-sm text-destructive">
                {form.formState.errors.root.message}
              </p>
            )}
          </DialogBody>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={closeCategory}>
              Cancel
            </Button>
            <Button type="submit" loading={form.formState.isSubmitting}>
              {editing ? "Save changes" : values.type === "CALCULATED" ? "Create & build formula" : "Create category"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
