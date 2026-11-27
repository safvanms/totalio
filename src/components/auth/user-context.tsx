"use client";

import { createContext, useContext } from "react";

export interface CurrentUser {
  id: string;
  email: string;
  name: string;
  /** Opened by the site admin ("Open their account"). */
  viaAdmin: boolean;
}

const UserContext = createContext<CurrentUser | null>(null);

export function UserProvider({ user, children }: { user: CurrentUser; children: React.ReactNode }) {
  return <UserContext.Provider value={user}>{children}</UserContext.Provider>;
}

/** The signed-in user. Only usable inside the authenticated app area. */
export function useUser(): CurrentUser {
  const u = useContext(UserContext);
  if (!u) throw new Error("useUser must be used inside the signed-in app");
  return u;
}

export function initials(name: string, email: string) {
  const src = name.trim() || email;
  const parts = src.split(/[\s@._-]+/).filter(Boolean);
  return ((parts[0]?.[0] ?? "") + (parts[1]?.[0] ?? "")).toUpperCase() || "?";
}
