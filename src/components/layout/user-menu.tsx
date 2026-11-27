"use client";

import { useState } from "react";
import Link from "next/link";
import { LogOut, UserRound } from "lucide-react";
import { toast } from "sonner";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/overlays";
import { initials, useUser } from "@/components/auth/user-context";
import { api, errorMessage } from "@/lib/api-client";

export async function signOut(reason = "signedout") {
  await api("/api/auth/logout", { method: "POST" });
  // Full navigation clears every cached query from this account.
  window.location.assign(`/login?reason=${reason}`);
}

export function UserMenu() {
  const user = useUser();
  const [busy, setBusy] = useState(false);
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <button
          type="button"
          aria-label={`Account menu for ${user.name}`}
          className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-indigo-500 to-violet-600 text-[13px] font-semibold text-white shadow-sm ring-2 ring-background transition-transform hover:scale-105 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring sm:h-9 sm:w-9"
        >
          {initials(user.name, user.email)}
        </button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-64">
        <div className="px-2.5 py-2">
          <p className="truncate text-sm font-medium" title={user.name}>
            {user.name}
          </p>
          <p className="truncate text-xs text-muted-foreground" title={user.email}>
            {user.email}
          </p>
        </div>
        <DropdownMenuSeparator />
        <DropdownMenuItem asChild>
          <Link href="/settings#account">
            <UserRound /> Account settings
          </Link>
        </DropdownMenuItem>
        <DropdownMenuItem
          disabled={busy}
          onSelect={async (e) => {
            e.preventDefault();
            setBusy(true);
            try {
              await signOut();
            } catch (err) {
              toast.error(errorMessage(err));
              setBusy(false);
            }
          }}
        >
          <LogOut /> {busy ? "Signing out…" : "Sign out"}
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
