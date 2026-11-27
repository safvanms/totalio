"use client";

import { Suspense, useState } from "react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { ThemeProvider, useTheme } from "next-themes";
import { Toaster } from "sonner";
import { TooltipProvider } from "@/components/ui/overlays";
import { NavigationProgress } from "@/components/layout/navigation-progress";

function ThemedToaster() {
  const { resolvedTheme } = useTheme();
  return (
    <Toaster
      theme={resolvedTheme === "dark" ? "dark" : "light"}
      position="bottom-right"
      richColors
      closeButton
      toastOptions={{ classNames: { toast: "!rounded-xl !text-sm" } }}
    />
  );
}

export function Providers({ children }: { children: React.ReactNode }) {
  const [client] = useState(
    () =>
      new QueryClient({
        defaultOptions: {
          queries: { staleTime: 30_000, refetchOnWindowFocus: false, retry: 1 },
          mutations: { retry: 0 },
        },
      }),
  );
  return (
    <ThemeProvider attribute="class" defaultTheme="system" enableSystem disableTransitionOnChange>
      <QueryClientProvider client={client}>
        <TooltipProvider delayDuration={250}>
          <Suspense fallback={null}>
            <NavigationProgress />
          </Suspense>
          {children}
          <ThemedToaster />
        </TooltipProvider>
      </QueryClientProvider>
    </ThemeProvider>
  );
}
