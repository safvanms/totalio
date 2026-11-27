import { redirect } from "next/navigation";
import { BarChart3, Calculator, ShieldCheck, Wallet } from "lucide-react";
import { getCurrentUser } from "@/lib/server/auth";

export const dynamic = "force-dynamic";

const FEATURES = [
  { icon: BarChart3, title: "See where your money goes", text: "Dashboards and reports built from your own expenses." },
  { icon: Calculator, title: "Combine categories with formulas", text: "Drag-and-drop calculated categories that update themselves." },
  { icon: ShieldCheck, title: "Private to you", text: "Your data is only visible when you're signed in." },
];

export default async function AuthLayout({ children }: { children: React.ReactNode }) {
  if (await getCurrentUser()) redirect("/dashboard");
  return (
    <div className="grid min-h-dvh lg:grid-cols-[minmax(0,1fr)_minmax(0,1.1fr)]">
      <aside className="relative hidden overflow-hidden bg-gradient-to-br from-indigo-600 via-violet-600 to-violet-800 p-10 text-white lg:flex lg:flex-col xl:p-14">
        <div className="absolute -right-24 -top-24 h-96 w-96 rounded-full bg-white/10 blur-3xl" aria-hidden />
        <div className="absolute -bottom-32 -left-16 h-96 w-96 rounded-full bg-emerald-400/20 blur-3xl" aria-hidden />
        <div className="relative flex items-center gap-2.5">
          <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-white/15 ring-1 ring-white/25">
            <Wallet className="h-5 w-5" />
          </span>
          <span className="text-xl font-semibold tracking-tight">Totalio</span>
        </div>
        <div className="relative mt-auto max-w-md">
          <h2 className="text-balance text-3xl font-semibold leading-tight tracking-tight xl:text-4xl">Every expense, totalled the way you think.</h2>
          <ul className="mt-8 space-y-5">
            {FEATURES.map((f) => (
              <li key={f.title} className="flex gap-3.5">
                <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-white/15 ring-1 ring-white/20">
                  <f.icon className="h-[18px] w-[18px]" />
                </span>
                <span>
                  <span className="block text-sm font-semibold">{f.title}</span>
                  <span className="block text-sm text-white/75">{f.text}</span>
                </span>
              </li>
            ))}
          </ul>
        </div>
        <p className="relative mt-12 text-xs text-white/60">© {new Date().getFullYear()} Totalio</p>
      </aside>
      <main className="flex min-w-0 items-center justify-center px-4 py-10 sm:px-8">
        <div className="w-full max-w-[400px]">
          <div className="mb-8 flex items-center gap-2.5 lg:hidden">
            <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-gradient-to-br from-indigo-500 via-violet-500 to-violet-600 text-white shadow-glow">
              <Wallet className="h-[18px] w-[18px]" />
            </span>
            <span className="text-[17px] font-semibold tracking-tight">
              Total<span className="text-primary">io</span>
            </span>
          </div>
          {children}
        </div>
      </main>
    </div>
  );
}
