"use client";

import { useState } from "react";
import { Download, FileSpreadsheet, FileText, Sheet } from "lucide-react";
import { toast } from "sonner";
import { Button, type ButtonProps } from "@/components/ui/button";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuLabel, DropdownMenuTrigger } from "@/components/ui/overlays";
import { runExport, type ExportFormat, type ExportTable } from "@/lib/export";
import { useFormat } from "@/hooks/use-settings";
import { errorMessage } from "@/lib/api-client";

/**
 * Export dropdown. `getTables` may be async (e.g. fetch all filtered rows
 * from the server before exporting).
 */
export function ExportMenu({
  getTables,
  filename,
  heading,
  label = "Export",
  disabled,
  variant = "outline",
  size = "sm",
}: {
  getTables: () => ExportTable[] | Promise<ExportTable[]>;
  filename: string;
  heading?: string;
  label?: string;
  disabled?: boolean;
  variant?: ButtonProps["variant"];
  size?: ButtonProps["size"];
}) {
  const { money, currency } = useFormat();
  const [busy, setBusy] = useState(false);

  const run = async (format: ExportFormat) => {
    setBusy(true);
    try {
      const tables = await getTables();
      if (!tables.length || tables.every((t) => !t.rows.length)) {
        toast.info("Nothing to export for the current filters.");
        return;
      }
      const stamp = new Date().toISOString().slice(0, 10);
      await runExport(format, tables, `${filename}-${stamp}`, { formatMoney: (n) => money(n), currencySymbol: currency.symbol, heading });
      toast.success(`Exported ${format.toUpperCase()}`);
    } catch (e) {
      toast.error(`Export failed: ${errorMessage(e)}`);
    } finally {
      setBusy(false);
    }
  };

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant={variant} size={size} loading={busy} disabled={disabled}>
          {!busy && <Download />}
          {label}
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end">
        <DropdownMenuLabel>Download as</DropdownMenuLabel>
        <DropdownMenuItem onClick={() => run("csv")}>
          <FileText /> CSV (.csv)
        </DropdownMenuItem>
        <DropdownMenuItem onClick={() => run("xlsx")}>
          <FileSpreadsheet /> Excel (.xlsx)
        </DropdownMenuItem>
        <DropdownMenuItem onClick={() => run("pdf")}>
          <Sheet /> PDF (.pdf)
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
