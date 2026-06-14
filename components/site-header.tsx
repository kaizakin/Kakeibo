"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { BrandMark } from "@/components/brand-mark";
import { signOutAction } from "@/src/app/actions/signout";

export function SiteHeader() {
  const pathname = usePathname();
  const onDashboard = pathname.startsWith("/dashboard");

  return (
    <header
      className="fixed left-1/2 top-4 z-50 w-full max-w-4xl -translate-x-1/2 px-4"
      style={{ viewTransitionName: "persistent-nav" }}
    >
      <div className="flex h-14 items-center justify-between rounded-[20px] bg-[#2a2a2a] px-4 shadow-lg ring-1 ring-white/10">
        <Link
          aria-label="Kakeibo home"
          href="/"
          transitionTypes={["nav-back"]}
          className="rounded-xl text-white outline-none ring-indigo-action/30 focus-visible:ring-4"
        >
          <BrandMark />
        </Link>

        <nav aria-label="Primary navigation" className="flex items-center gap-1">
          {onDashboard ? (
            <form action={signOutAction}>
              <button
                type="submit"
                className="ml-2 rounded-xl bg-white/10 px-4 py-1.5 text-sm font-medium text-white shadow-sm transition hover:-translate-y-0.5 hover:bg-white/20 focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-sage-300"
              >
                Sign out
              </button>
            </form>
          ) : (
            <Link
              href="/login"
              transitionTypes={["nav-forward"]}
              className="ml-2 rounded-xl bg-[#9353d3] px-4 py-1.5 text-sm font-medium text-white shadow-sm transition hover:-translate-y-0.5 hover:bg-[#a864ed] focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-purple-300"
            >
              Open Kakeibo
            </Link>
          )}
        </nav>
      </div>
    </header>
  );
}
