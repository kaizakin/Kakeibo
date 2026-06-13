import type { ReactNode } from "react";
import { AuditIcon, CalendarIcon, EyeIcon, ShieldIcon } from "@/components/icons";

const workspaceItems = [
  { label: "Overview", icon: EyeIcon, active: true },
  { label: "Audit queue", icon: AuditIcon, active: false },
  { label: "Timeline", icon: CalendarIcon, active: false },
] as const;

export default function DashboardLayout({ children }: { children: ReactNode }) {
  return (
    <div className="page-container flex flex-1 gap-6 py-6 lg:py-8">
      <aside className="hidden w-60 shrink-0 lg:block">
        <div className="sticky top-24 rounded-2xl border border-line bg-white p-3 shadow-card">
          <div className="mb-3 flex items-center gap-3 rounded-xl bg-sage-50 p-3">
            <span className="grid size-9 place-items-center rounded-xl bg-sage-200 text-sage-800">
              <ShieldIcon className="size-4" />
            </span>
            <div>
              <p className="text-xs font-medium text-muted">Protected shell</p>
              <p className="text-sm font-semibold text-ink">Pine Street</p>
            </div>
          </div>
          <nav aria-label="Workspace">
            {workspaceItems.map((item) => {
              const Icon = item.icon;

              return (
                <div
                  key={item.label}
                  title={`${item.label} — static in Phase 1`}
                  className={`mt-1 flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium ${
                    item.active
                      ? "bg-slate-850 text-white"
                      : "text-muted"
                  }`}
                >
                  <Icon className="size-4" />
                  {item.label}
                </div>
              );
            })}
          </nav>
        </div>
      </aside>
      <div className="min-w-0 flex-1">{children}</div>
    </div>
  );
}
