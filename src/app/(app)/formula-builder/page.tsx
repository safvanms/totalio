"use client";

import { Suspense } from "react";
import { useSearchParams } from "next/navigation";
import { FormulaBuilder } from "@/components/formula/formula-builder";
import { Skeleton } from "@/components/ui/primitives";

function BuilderRoute() {
  const id = useSearchParams().get("id");
  return <FormulaBuilder initialId={id} />;
}

export default function FormulaBuilderPage() {
  return (
    <Suspense fallback={<Skeleton className="h-96 rounded-2xl" />}>
      <BuilderRoute />
    </Suspense>
  );
}
