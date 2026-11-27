"use client";

import { toast } from "sonner";
import { api, errorMessage } from "@/lib/api-client";

/**
 * Signs this browser into the user's account (a short, marked session) and
 * opens their dashboard. The app shows a banner with "Back to admin".
 */
export async function openAccount(userId: string) {
  try {
    await api(`/api/admin/users/${userId}`, { method: "PATCH", json: { action: "impersonate" } });
    window.location.assign("/dashboard");
  } catch (e) {
    toast.error(errorMessage(e));
  }
}
