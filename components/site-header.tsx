"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { BrandMark } from "@/components/brand-mark";

const navItems = [
  { href: "/#capabilities", label: "Capabilities" },
  { href: "/#method", label: "Method" },
] as const;

export function SiteHeader() {
  const pathname = usePathname();
  const onDashboard = pathname.startsWith("/dashboard");

  return (
    <header
      className="sticky top-0 z-50 border-b border-line/80 bg-canvas/90 backdrop-blur-xl"
      style={{ viewTransitionName: "persistent-nav" }}
    >
      <div className="page-container flex h-16 items-center justify-between">
        <Link
          aria-label="Kakeibo home"
          href="/"
          transitionTypes={["nav-back"]}
          className="rounded-xl outline-none ring-indigo-action/30 focus-visible:ring-4"
        >
          <BrandMark />
        </Link>

        <nav aria-label="Primary navigation" className="flex items-center gap-1">
          {!onDashboard
            ? navItems.map((item) => (
                <Link
                  key={item.href}
                  href={item.href}
                  className="hidden rounded-lg px-3 py-2 text-sm font-medium text-muted transition-colors hover:bg-sage-50 hover:text-ink focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-indigo-action/20 sm:block"
                >
                  {item.label}
                </Link>
              ))
            : null}
          <Link
            href={onDashboard ? "/login" : "/login"}
            transitionTypes={onDashboard ? ["nav-back"] : ["nav-forward"]}
            className="ml-2 rounded-xl bg-slate-850 px-4 py-2 text-sm font-semibold text-white shadow-sm transition hover:-translate-y-0.5 hover:bg-slate-950 focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-sage-300"
          >
            {onDashboard ? "Sign out" : "App portal"}
          </Link>
        </nav>
      </div>
    </header>
  );
}
