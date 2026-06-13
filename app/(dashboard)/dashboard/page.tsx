"use client";

import { ViewTransition } from "react";
import { motion, useReducedMotion } from "motion/react";
import { AuditIcon, CalendarIcon, CheckIcon, EyeIcon, ShieldIcon } from "@/components/icons";

interface SummaryCard {
  label: string;
  value: string;
  note: string;
  tone: string;
  icon: typeof AuditIcon;
}

const summaries: readonly SummaryCard[] = [
  {
    label: "Audit status",
    value: "Ready to review",
    note: "Mock workspace state",
    tone: "bg-amber-soft text-amber-ink",
    icon: AuditIcon,
  },
  {
    label: "Debt trail",
    value: "Fully traceable",
    note: "No magic numbers",
    tone: "bg-indigo-soft text-indigo-action",
    icon: EyeIcon,
  },
  {
    label: "Group timeline",
    value: "Window-aware",
    note: "Membership-ready shell",
    tone: "bg-sage-100 text-sage-700",
    icon: CalendarIcon,
  },
] as const;

export default function DashboardPage() {
  const reduceMotion = useReducedMotion();

  return (
    <ViewTransition
      enter={{ "nav-forward": "nav-forward", default: "none" }}
      exit={{ "nav-back": "nav-back", default: "none" }}
      default="none"
    >
      <motion.div
        initial={reduceMotion ? false : { opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.45, ease: [0.22, 1, 0.36, 1] }}
      >
        <div className="flex flex-col justify-between gap-5 sm:flex-row sm:items-end">
          <div>
            <div className="inline-flex items-center gap-2 rounded-full border border-sage-200 bg-sage-50 px-3 py-1.5 text-xs font-semibold text-sage-700">
              <ShieldIcon className="size-3.5" />
              Mock protected route
            </div>
            <h1 className="mt-4 text-3xl font-semibold tracking-[-0.045em] text-slate-950 sm:text-4xl">
              Financial clarity center
            </h1>
            <p className="mt-3 max-w-2xl leading-7 text-muted">
              The structural dashboard is ready for future audit workflows. No
              balances, uploads, or mutations are connected in this phase.
            </p>
          </div>
          <div className="rounded-xl border border-line bg-white px-4 py-3 text-sm shadow-card">
            <p className="text-xs font-medium uppercase tracking-[0.12em] text-muted">
              Workspace
            </p>
            <p className="mt-1 font-semibold text-ink">Pine Street house</p>
          </div>
        </div>

        <div className="mt-8 grid gap-4 md:grid-cols-3">
          {summaries.map((summary, index) => {
            const Icon = summary.icon;

            return (
              <motion.article
                key={summary.label}
                initial={reduceMotion ? false : { opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: reduceMotion ? 0 : 0.08 + index * 0.06 }}
                className="rounded-2xl border border-line bg-white p-5 shadow-card"
              >
                <span className={`grid size-10 place-items-center rounded-xl ${summary.tone}`}>
                  <Icon className="size-4.5" />
                </span>
                <p className="mt-5 text-xs font-semibold uppercase tracking-[0.12em] text-muted">
                  {summary.label}
                </p>
                <p className="mt-2 font-semibold tracking-tight text-ink">{summary.value}</p>
                <p className="mt-1 text-sm text-muted">{summary.note}</p>
              </motion.article>
            );
          })}
        </div>

        <section className="mt-6 rounded-3xl border border-line bg-white p-6 shadow-card sm:p-8">
          <div className="flex flex-col justify-between gap-4 border-b border-line pb-6 sm:flex-row sm:items-center">
            <div>
              <p className="text-sm font-semibold text-ink">Phase 1 readiness</p>
              <p className="mt-1 text-sm text-muted">
                Frontend contracts established before financial logic begins.
              </p>
            </div>
            <span className="inline-flex w-fit items-center gap-2 rounded-full bg-sage-100 px-3 py-1.5 text-xs font-semibold text-sage-700">
              <CheckIcon className="size-3.5" />
              Foundation complete
            </span>
          </div>
          <div className="mt-6 grid gap-4 sm:grid-cols-3">
            {[
              ["Design system", "Light-only tokens and responsive layout"],
              ["Portal shell", "Validated mock authentication flow"],
              ["Route structure", "Dashboard group ready for a future guard"],
            ].map(([title, description]) => (
              <div key={title} className="rounded-2xl bg-canvas p-4">
                <p className="text-sm font-semibold text-ink">{title}</p>
                <p className="mt-2 text-sm leading-6 text-muted">{description}</p>
              </div>
            ))}
          </div>
        </section>
      </motion.div>
    </ViewTransition>
  );
}
