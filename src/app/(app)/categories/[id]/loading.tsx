import { CategoryDetailSkeleton } from "@/components/categories/category-detail-skeleton";

/** Shown instantly when a category is opened, while the page loads. */
export default function Loading() {
  return <CategoryDetailSkeleton />;
}
