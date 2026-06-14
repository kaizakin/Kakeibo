import type { ReactNode } from "react";
import Link from "next/link";
import { auth } from "@/src/lib/auth";
import {
  AuditIcon,
  CalendarIcon,
  CurrencyIcon,
  EyeIcon,
  ShieldIcon,
  ArrowRightIcon,
} from "@/components/icons";

const navItems = [
  { href: "/dashboard", label: "Overview", icon: EyeIcon },
  { href: "/dashboard/import", label: "Import CSV", icon: AuditIcon },
  { href: "/dashboard/balances", label: "Balances", icon: CurrencyIcon },
  { href: "/dashboard/audit", label: "Audit Trail", icon: CalendarIcon },
  { href: "/dashboard/members", label: "Members", icon: ShieldIcon },
] as const;

export default async function DashboardLayout({
  children,
}: {
  children: ReactNode;
}) {
  const session = await auth();

  return (
    <div className="page-container flex flex-1 gap-6 py-6 lg:py-8">
      <aside className="hidden w-60 shrink-0 lg:block">
        <div className="sticky top-24 rounded-2xl border border-line bg-white p-3 shadow-card">
          {/* User info */}
          {session?.user && (
            <div className="mb-3 flex items-center gap-3 rounded-xl bg-sage-50 p-3">
              {session.user.image ? (
                <img
                  src={session.user.image}
                  alt=""
                  className="size-9 rounded-xl object-cover"
                />
              ) : (
                <span className="grid size-9 place-items-center rounded-xl bg-sage-200 text-sage-800">
                  <ShieldIcon className="size-4" />
                </span>
              )}
              <div className="min-w-0">
                <p className="truncate text-sm font-semibold text-ink">
                  {session.user.name ?? "User"}
                </p>
                <p className="truncate text-xs text-muted">
                  {session.user.email}
                </p>
              </div>
            </div>
          )}

          {/* Group context */}
          <div className="mb-3 rounded-xl bg-canvas p-3">
            <p className="text-xs font-medium text-muted">Active group</p>
            <p className="mt-0.5 text-sm font-semibold text-ink">
              Pine Street House
            </p>
          </div>

          {/* Navigation */}
          <nav aria-label="Dashboard navigation">
            {navItems.map((item) => {
              const Icon = item.icon;
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  className="mt-1 flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium text-muted transition-colors hover:bg-sage-50 hover:text-ink"
                >
                  <Icon className="size-4" />
                  {item.label}
                </Link>
              );
            })}
          </nav>
        </div>
      </aside>
      <div className="min-w-0 flex-1">{children}</div>
    </div>
  );
}
