"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  AuditIcon,
  CalendarIcon,
  CurrencyIcon,
  EyeIcon,
  ShieldIcon,
} from "@/components/icons";

const navItems = [
  { href: "/dashboard", label: "Overview", icon: EyeIcon },
  { href: "/dashboard/import", label: "Import CSV", icon: AuditIcon },
  { href: "/dashboard/balances", label: "Balances", icon: CurrencyIcon },
  { href: "/dashboard/audit", label: "Audit Trail", icon: CalendarIcon },
  { href: "/dashboard/members", label: "Members", icon: ShieldIcon },
] as const;

export function DashboardNav() {
  const pathname = usePathname();

  return (
    <nav aria-label="Dashboard navigation">
      {navItems.map((item) => {
        const Icon = item.icon;
        const isActive = pathname === item.href;
        
        return (
          <Link
            key={item.href}
            href={item.href}
            className={`mt-1 flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium transition-colors ${
              isActive
                ? "bg-purple-100 text-[#9353d3]"
                : "text-muted hover:bg-gray-100 hover:text-ink"
            }`}
          >
            <Icon className="size-4" />
            {item.label}
          </Link>
        );
      })}
    </nav>
  );
}
