"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Eye, MoreHorizontal, Pencil, Plus, Sigma, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger } from "@/components/ui/overlays";
import { ConfirmDialog } from "@/components/shared/confirm-dialog";
import { useCategories, useDeleteCategory } from "@/hooks/use-data";
import { useDialogs } from "@/stores/dialog-store";
import { pluralize } from "@/lib/utils";
import type { Category } from "@/lib/types";

/** Delete confirmation that explains consequences and blocks deletes that would break formulas. */
export function DeleteCategoryDialog({
  category,
  open,
  onOpenChange,
  onDeleted,
}: {
  category: Category;
  open: boolean;
  onOpenChange: (o: boolean) => void;
  onDeleted?: () => void;
}) {
  const { data: all = [] } = useCategories();
  const del = useDeleteCategory();
  const dependents = all.filter((c) => category.dependentIds.includes(c.id));
  const blocked = dependents.length > 0;
  return (
    <ConfirmDialog
      open={open}
      onOpenChange={onOpenChange}
      title={blocked ? `Can't delete "${category.name}"` : `Delete "${category.name}"?`}
      confirmLabel={blocked ? "OK" : "Delete category"}
      destructive={!blocked}
      loading={del.isPending}
      description={
        blocked ? (
          <>
            It is used in the formula of{" "}
            {dependents.map((d, i) => (
              <span key={d.id}>
                {i > 0 && ", "}
                <Link href={`/formula-builder?id=${d.id}`} className="font-medium text-primary underline-offset-2 hover:underline">
                  {d.name}
                </Link>
              </span>
            ))}
            . Remove it from those formulas first.
          </>
        ) : category.type === "NORMAL" && category.expenseCount > 0 ? (
          <>
            This also permanently deletes its <strong className="text-foreground">{pluralize(category.expenseCount, "expense entry", "expense entries")}</strong>. This can&apos;t be undone.
          </>
        ) : (
          "This can't be undone."
        )
      }
      onConfirm={async () => {
        if (blocked) return onOpenChange(false);
        await del.mutateAsync(category);
        onOpenChange(false);
        onDeleted?.();
      }}
    />
  );
}

export function CategoryActions({ category, align = "end" }: { category: Category; align?: "start" | "end" }) {
  const router = useRouter();
  const { openCategory, openExpense, openQuickAdd } = useDialogs();
  const [confirm, setConfirm] = useState(false);
  return (
    <>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button variant="ghost" size="icon-sm" aria-label={`Actions for ${category.name}`} onClick={(e) => e.stopPropagation()}>
            <MoreHorizontal />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align={align} onClick={(e) => e.stopPropagation()}>
          <DropdownMenuItem asChild>
            <Link href={`/categories/${category.id}`}>
              <Eye /> View details
            </Link>
          </DropdownMenuItem>
          <DropdownMenuItem onClick={() => openCategory({ category })}>
            <Pencil /> Edit category
          </DropdownMenuItem>
          {category.type === "NORMAL" ? (
            <>
              <DropdownMenuItem onClick={() => openExpense({ categoryId: category.id })}>
                <Plus /> Add expense
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => openQuickAdd(category.id)}>
                <Plus /> Quick add several
              </DropdownMenuItem>
            </>
          ) : (
            <DropdownMenuItem onClick={() => router.push(`/formula-builder?id=${category.id}`)}>
              <Sigma /> Edit formula
            </DropdownMenuItem>
          )}
          <DropdownMenuSeparator />
          <DropdownMenuItem destructive onClick={() => setConfirm(true)}>
            <Trash2 /> Delete
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
      <DeleteCategoryDialog category={category} open={confirm} onOpenChange={setConfirm} />
    </>
  );
}
