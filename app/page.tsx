"use client";

import { addTransitionType, useTransition, ViewTransition } from "react";
import { motion, useReducedMotion } from "motion/react";
import { useRouter } from "next/navigation";
import {
  ArrowRightIcon,
  AuditIcon,
  CalendarIcon,
  CheckIcon,
  CurrencyIcon,
  EyeIcon,
  SparkIcon,
} from "@/components/icons";

interface Feature {
  title: string;
  description: string;
  detail: string;
  icon: typeof AuditIcon;
  tone: "sage" | "indigo" | "amber";
}

const features: readonly Feature[] = [
  {
    title: "Two-Pass Anomaly Detection Engine",
    description:
      "Surface duplicates, corrupt formats, and date violations before they distort a single balance.",
    detail: "Detect first. Resolve deliberately.",
    icon: AuditIcon,
    tone: "sage",
  },
  {
    title: "Granular Debt Audit Trails",
    description:
      "Trace every amount from original expense to final settlement, with zero unexplained magic numbers.",
    detail: "Every cent has a reason.",
    icon: EyeIcon,
    tone: "indigo",
  },
  {
    title: "Temporal Group Management",
    description:
      "Respect move-in and move-out windows so people only inherit costs from the time they were actually there.",
    detail: "Membership is a timeline.",
    icon: CalendarIcon,
    tone: "amber",
  },
  {
    title: "Multi-Currency Resolution",
    description:
      "Resolve cross-border expenses with deterministic conversion rules and precision-safe calculations.",
    detail: "Consistent across currencies.",
    icon: CurrencyIcon,
    tone: "sage",
  },
] as const;

const toneClasses = {
  sage: "bg-sage-100 text-sage-700",
  indigo: "bg-indigo-soft text-indigo-action",
  amber: "bg-amber-soft text-amber-ink",
} as const;

export default function HomePage() {
  const router = useRouter();
  const [isRouting, startRouting] = useTransition();
  const reduceMotion = useReducedMotion();

  function openPortal() {
    startRouting(() => {
      addTransitionType("nav-forward");
      router.push("/login");
    });
  }

  return (
    <ViewTransition
      enter={{ "nav-back": "nav-back", default: "none" }}
      exit={{ "nav-forward": "nav-forward", default: "none" }}
      default="none"
    >
      <div className="overflow-hidden">
        <section className="relative isolate border-b border-line">
          <div className="fine-grid absolute inset-0 -z-20" />
          <div className="absolute left-1/2 top-8 -z-10 size-[34rem] -translate-x-1/2 rounded-full bg-sage-200/35 blur-3xl" />

          <div className="page-container grid min-h-[calc(100svh-4rem)] items-center gap-14 py-20 lg:grid-cols-[1.08fr_0.92fr] lg:py-24">
            <motion.div
              initial={reduceMotion ? false : { opacity: 0, y: 18 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.55, ease: [0.22, 1, 0.36, 1] }}
            >
              <div className="mb-7 inline-flex items-center gap-2 rounded-full border border-sage-200 bg-white/80 px-3 py-1.5 text-xs font-semibold uppercase tracking-[0.15em] text-sage-700 shadow-sm">
                <SparkIcon className="size-3.5" />
                Financial context, reconstructed
              </div>
              <h1 className="text-balance max-w-3xl text-5xl font-semibold leading-[1.02] tracking-[-0.065em] text-slate-950 sm:text-6xl lg:text-7xl">
                Messy shared finances, made{" "}
                <span className="text-sage-600">explainable.</span>
              </h1>
              <p className="mt-7 max-w-2xl text-lg leading-8 text-muted sm:text-xl">
                Kakeibo is not another expense log. It is an intelligent data
                auditing and debt settlement machine built to untangle
                corrupted histories and produce balances everyone can trust.
              </p>

              <div className="mt-9 flex flex-col gap-3 sm:flex-row sm:items-center">
                <motion.button
                  type="button"
                  onClick={openPortal}
                  disabled={isRouting}
                  whileHover={reduceMotion ? undefined : { y: -2 }}
                  whileTap={reduceMotion ? undefined : { scale: 0.98 }}
                  className="group inline-flex min-h-13 items-center justify-center gap-2 rounded-2xl bg-indigo-action px-6 py-3.5 text-sm font-semibold text-white shadow-lg shadow-indigo-action/20 transition-colors hover:bg-indigo-hover disabled:cursor-wait disabled:opacity-80 focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-indigo-action/25"
                >
                  {isRouting ? (
                    <>
                      <span className="size-4 animate-spin rounded-full border-2 border-white/35 border-t-white" />
                      Opening portal
                    </>
                  ) : (
                    <>
                      Enter the app portal
                      <ArrowRightIcon className="size-4 transition-transform group-hover:translate-x-0.5" />
                    </>
                  )}
                </motion.button>
                <a
                  href="#capabilities"
                  className="rounded-xl px-5 py-3 text-center text-sm font-semibold text-sage-700 transition-colors hover:bg-sage-100 focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-sage-200"
                >
                  Explore the engine
                </a>
              </div>

              <div className="mt-9 flex flex-wrap gap-x-5 gap-y-2 text-sm text-muted">
                {["Audit-first", "Precision-safe", "Timeline-aware"].map(
                  (label) => (
                    <span key={label} className="inline-flex items-center gap-1.5">
                      <span className="grid size-5 place-items-center rounded-full bg-sage-100 text-sage-700">
                        <CheckIcon className="size-3" />
                      </span>
                      {label}
                    </span>
                  ),
                )}
              </div>
            </motion.div>

            <motion.div
              initial={reduceMotion ? false : { opacity: 0, x: 24 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{
                delay: reduceMotion ? 0 : 0.12,
                duration: 0.6,
                ease: [0.22, 1, 0.36, 1],
              }}
              className="relative mx-auto w-full max-w-lg"
            >
              <div className="absolute -inset-4 -z-10 rounded-[2rem] bg-gradient-to-br from-sage-200/60 via-white to-indigo-soft blur-xl" />
              <div className="rounded-3xl border border-white bg-white/90 p-4 shadow-lift backdrop-blur sm:p-6">
                <div className="flex items-center justify-between border-b border-line pb-5">
                  <div>
                    <p className="text-xs font-semibold uppercase tracking-[0.14em] text-muted">
                      Audit snapshot
                    </p>
                    <p className="mt-1 text-lg font-semibold tracking-tight text-ink">
                      Pine Street house
                    </p>
                  </div>
                  <span className="rounded-full border border-amber-line bg-amber-soft px-3 py-1 text-xs font-semibold text-amber-ink">
                    3 anomalies found
                  </span>
                </div>

                <div className="space-y-3 py-5">
                  {[
                    {
                      label: "Duplicate utility payment",
                      meta: "Mar 18 · Exact amount match",
                      tone: "bg-amber-soft text-amber-ink",
                    },
                    {
                      label: "Membership window conflict",
                      meta: "Apr 02 · Review participant",
                      tone: "bg-indigo-soft text-indigo-action",
                    },
                    {
                      label: "Malformed currency value",
                      meta: "Apr 11 · Safely quarantined",
                      tone: "bg-sage-100 text-sage-700",
                    },
                  ].map((item, index) => (
                    <motion.div
                      key={item.label}
                      initial={reduceMotion ? false : { opacity: 0, y: 8 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ delay: reduceMotion ? 0 : 0.35 + index * 0.08 }}
                      className="flex items-center gap-3 rounded-2xl border border-line bg-canvas/70 p-3"
                    >
                      <span
                        className={`grid size-9 shrink-0 place-items-center rounded-xl ${item.tone}`}
                      >
                        <AuditIcon className="size-4" />
                      </span>
                      <span className="min-w-0">
                        <span className="block truncate text-sm font-semibold text-ink">
                          {item.label}
                        </span>
                        <span className="mt-0.5 block text-xs text-muted">
                          {item.meta}
                        </span>
                      </span>
                    </motion.div>
                  ))}
                </div>

                <div className="rounded-2xl bg-slate-850 p-4 text-white">
                  <div className="flex items-end justify-between gap-4">
                    <div>
                      <p className="text-xs font-medium text-sage-200">
                        Reconciled balance
                      </p>
                      <p className="mt-1 text-2xl font-semibold tracking-tight">
                        Fully explained
                      </p>
                    </div>
                    <span className="grid size-10 shrink-0 place-items-center rounded-full bg-sage-400 text-slate-950">
                      <CheckIcon className="size-5" />
                    </span>
                  </div>
                </div>
              </div>
            </motion.div>
          </div>
        </section>

        <section id="capabilities" className="page-container scroll-mt-24 py-24 sm:py-28">
          <div className="max-w-2xl">
            <p className="text-sm font-semibold uppercase tracking-[0.16em] text-sage-600">
              Designed for difficult histories
            </p>
            <h2 className="text-balance mt-4 text-3xl font-semibold tracking-[-0.045em] text-slate-950 sm:text-5xl">
              From unreliable records to defensible settlements.
            </h2>
            <p className="mt-5 text-lg leading-8 text-muted">
              Kakeibo treats every balance as a conclusion that must be proven,
              not merely displayed.
            </p>
          </div>

          <div className="mt-12 grid gap-5 md:grid-cols-2">
            {features.map((feature, index) => {
              const Icon = feature.icon;

              return (
                <motion.article
                  key={feature.title}
                  id={index === 0 ? "method" : undefined}
                  initial={reduceMotion ? false : { opacity: 0, y: 14 }}
                  whileInView={{ opacity: 1, y: 0 }}
                  viewport={{ once: true, amount: 0.25 }}
                  transition={{ duration: 0.45, delay: index * 0.05 }}
                  whileHover={reduceMotion ? undefined : { y: -4 }}
                  className="scroll-mt-24 rounded-3xl border border-line bg-white p-6 shadow-card transition-shadow hover:shadow-lift sm:p-8"
                >
                  <div
                    className={`grid size-12 place-items-center rounded-2xl ${toneClasses[feature.tone]}`}
                  >
                    <Icon className="size-5" />
                  </div>
                  <h3 className="mt-6 text-xl font-semibold tracking-[-0.025em] text-ink">
                    {feature.title}
                  </h3>
                  <p className="mt-3 leading-7 text-muted">{feature.description}</p>
                  <p className="mt-6 border-t border-line pt-5 text-sm font-semibold text-sage-700">
                    {feature.detail}
                  </p>
                </motion.article>
              );
            })}
          </div>
        </section>

        <section className="page-container pb-24 sm:pb-28">
          <div className="relative overflow-hidden rounded-3xl bg-slate-850 px-6 py-12 text-center text-white shadow-lift sm:px-12 sm:py-16">
            <div className="absolute inset-0 bg-[radial-gradient(circle_at_top_right,rgba(114,164,126,0.32),transparent_42%)]" />
            <div className="relative mx-auto max-w-2xl">
              <p className="text-sm font-semibold uppercase tracking-[0.16em] text-sage-300">
                Clarity compounds
              </p>
              <h2 className="text-balance mt-4 text-3xl font-semibold tracking-[-0.045em] sm:text-5xl">
                Build a settlement everyone can verify.
              </h2>
              <p className="mx-auto mt-5 max-w-xl leading-7 text-sage-100/80">
                Start with the portal shell and see how a complex financial
                history becomes a clear, reviewable story.
              </p>
              <motion.button
                type="button"
                onClick={openPortal}
                disabled={isRouting}
                whileHover={reduceMotion ? undefined : { scale: 1.02 }}
                whileTap={reduceMotion ? undefined : { scale: 0.98 }}
                className="mt-8 inline-flex min-h-12 items-center justify-center gap-2 rounded-2xl bg-white px-6 py-3 text-sm font-semibold text-slate-950 shadow-lg transition-colors hover:bg-sage-50 disabled:cursor-wait disabled:opacity-80 focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-sage-300/50"
              >
                {isRouting ? "Opening portal…" : "Open the app portal"}
                {isRouting ? null : <ArrowRightIcon className="size-4" />}
              </motion.button>
            </div>
          </div>
        </section>
      </div>
    </ViewTransition>
  );
}
