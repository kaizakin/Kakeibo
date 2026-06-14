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
  sage: "bg-[#9353d3]/10 text-[#9353d3]",
  indigo: "bg-gray-100 text-gray-800",
  amber: "bg-black text-white",
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
          <div className="absolute left-1/2 top-8 -z-10 size-[34rem] -translate-x-1/2 rounded-full bg-[#9353d3]/10 blur-3xl" />

          <div className="page-container grid min-h-[calc(100svh-4rem)] items-start pt-16 gap-14 py-20 lg:grid-cols-1 lg:py-24">
            <motion.div
              initial={reduceMotion ? false : { opacity: 0, y: 18 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.55, ease: [0.22, 1, 0.36, 1] }}
              className="col-span-full mx-auto max-w-4xl pt-32 text-center"
            >
              <div className="mb-7 mx-auto inline-flex items-center gap-2 rounded-full border border-[#e5e7eb] bg-white px-3 py-1.5 text-xs font-medium text-gray-600 shadow-sm">
                <div className="size-1.5 rounded-full bg-[#9353d3]" />
                Financial context, reconstructed
              </div>
              <h1 className="mx-auto text-balance max-w-4xl text-5xl font-medium leading-[1.1] tracking-[-0.02em] text-[#1a1a1a] sm:text-6xl lg:text-[5rem]">
                Messy shared finances, <br className="hidden sm:block" />
                <span className="text-gray-400">made explainable.</span>
              </h1>
              <p className="mx-auto mt-8 max-w-2xl text-lg leading-relaxed text-gray-500 sm:text-[1.1rem]">
                Kakeibo is not another expense log. It is an intelligent data
                auditing and debt settlement machine built to untangle
                corrupted histories and produce balances everyone can trust.
              </p>

              <div className="mt-10 flex flex-col justify-center gap-4 sm:flex-row sm:items-center">
                <motion.button
                  type="button"
                  onClick={openPortal}
                  disabled={isRouting}
                  whileHover={reduceMotion ? undefined : { scale: 1.02 }}
                  whileTap={reduceMotion ? undefined : { scale: 0.98 }}
                  className="group inline-flex min-h-[3.25rem] items-center justify-center gap-2 rounded-2xl bg-[#1f1f1f] px-6 py-3 text-sm font-medium text-white shadow-md transition-all hover:bg-black disabled:cursor-wait disabled:opacity-80 focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-black/20"
                >
                  {isRouting ? (
                    <>
                      <span className="size-4 animate-spin rounded-full border-2 border-white/35 border-t-white" />
                      Opening portal
                    </>
                  ) : (
                    <>
                      Enter Kakeibo
                    </>
                  )}
                </motion.button>
                <a
                  href="#capabilities"
                  className="inline-flex min-h-[3.25rem] items-center justify-center rounded-2xl border border-gray-200 bg-white px-6 py-3 text-sm font-medium text-gray-700 shadow-sm transition-colors hover:bg-gray-50 hover:text-gray-900 focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-gray-200"
                >
                  Explore the engine
                </a>
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
              className="col-span-full relative mx-auto mt-16 w-full max-w-4xl"
            >
              <div className="absolute -inset-4 -z-10 rounded-[2rem] bg-gradient-to-br from-gray-100 via-white to-gray-50 blur-xl" />
              <div className="rounded-3xl border border-gray-200 bg-white p-4 shadow-lg sm:p-6 text-left">
                <div className="flex items-center justify-between border-b border-gray-100 pb-5">
                  <div>
                    <p className="text-xs font-semibold uppercase tracking-[0.14em] text-gray-500">
                      Audit snapshot
                    </p>
                    <p className="mt-1 text-lg font-medium tracking-tight text-gray-900">
                      Pine Street house
                    </p>
                  </div>
                  <span className="rounded-full border border-gray-200 bg-gray-50 px-3 py-1 text-xs font-medium text-gray-700">
                    3 anomalies found
                  </span>
                </div>

                <div className="space-y-3 py-5">
                  {[
                    {
                      label: "Duplicate utility payment",
                      meta: "Mar 18 · Exact amount match",
                      tone: "bg-gray-100 text-gray-700",
                    },
                    {
                      label: "Membership window conflict",
                      meta: "Apr 02 · Review participant",
                      tone: "bg-gray-100 text-gray-700",
                    },
                    {
                      label: "Malformed currency value",
                      meta: "Apr 11 · Safely quarantined",
                      tone: "bg-gray-100 text-gray-700",
                    },
                  ].map((item, index) => (
                    <motion.div
                      key={item.label}
                      initial={reduceMotion ? false : { opacity: 0, y: 8 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ delay: reduceMotion ? 0 : 0.35 + index * 0.08 }}
                      className="flex items-center gap-3 rounded-2xl border border-gray-100 bg-gray-50/50 p-3"
                    >
                      <span
                        className={`grid size-9 shrink-0 place-items-center rounded-xl ${item.tone}`}
                      >
                        <AuditIcon className="size-4" />
                      </span>
                      <span className="min-w-0">
                        <span className="block truncate text-sm font-medium text-gray-900">
                          {item.label}
                        </span>
                        <span className="mt-0.5 block text-xs text-gray-500">
                          {item.meta}
                        </span>
                      </span>
                    </motion.div>
                  ))}
                </div>

                <div className="rounded-2xl bg-gray-900 p-4 text-white">
                  <div className="flex items-end justify-between gap-4">
                    <div>
                      <p className="text-xs font-medium text-gray-400">
                        Reconciled balance
                      </p>
                      <p className="mt-1 text-2xl font-medium tracking-tight">
                        Fully explained
                      </p>
                    </div>
                    <span className="grid size-10 shrink-0 place-items-center rounded-full bg-[#9353d3] text-white">
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
            <p className="text-sm font-semibold uppercase tracking-[0.16em] text-gray-500">
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
                  initial={reduceMotion ? false : { opacity: 0, y: 14 }}
                  whileInView={{ opacity: 1, y: 0 }}
                  viewport={{ once: true, amount: 0.25 }}
                  transition={{ duration: 0.45, delay: index * 0.05 }}
                  className="rounded-[2rem] bg-white p-8 border border-gray-100"
                >
                  <div className="mb-6 grid size-10 place-items-center rounded-full bg-[#9353d3]/10 text-[#9353d3]">
                    <Icon className="size-5" />
                  </div>
                  <h3 className="text-xl font-medium text-[#1a1a1a]">
                    {feature.title}
                  </h3>
                  <p className="mt-4 leading-relaxed text-gray-500">
                    {feature.description}
                  </p>
                  <p className="mt-6 border-t border-gray-100 pt-5 text-sm font-semibold text-[#9353d3]">
                    {feature.detail}
                  </p>
                </motion.article>
              );
            })}
          </div>
        </section>

        <section className="page-container pb-24 sm:pb-28">
          <div className="relative overflow-hidden rounded-3xl bg-slate-850 px-6 py-12 text-center text-white shadow-lift sm:px-12 sm:py-16">
            <div className="absolute inset-0 bg-[radial-gradient(circle_at_top_right,rgba(147,83,211,0.32),transparent_42%)]" />
            <div className="relative mx-auto max-w-2xl">
              <p className="text-sm font-semibold uppercase tracking-[0.16em] text-gray-400">
                Clarity compounds
              </p>
              <h2 className="text-balance mt-4 text-3xl font-semibold tracking-[-0.045em] sm:text-5xl">
                Build a settlement everyone can verify.
              </h2>
              <p className="mx-auto mt-5 max-w-xl leading-7 text-gray-300">
                Start with the portal shell and see how a complex financial
                history becomes a clear, reviewable story.
              </p>
              <motion.button
                type="button"
                onClick={openPortal}
                disabled={isRouting}
                whileHover={reduceMotion ? undefined : { scale: 1.02 }}
                whileTap={reduceMotion ? undefined : { scale: 0.98 }}
                className="mt-8 inline-flex min-h-12 items-center justify-center gap-2 rounded-2xl bg-white px-6 py-3 text-sm font-semibold text-slate-950 shadow-lg transition-colors hover:bg-gray-200 disabled:cursor-wait disabled:opacity-80 focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-gray-300/50"
              >
                {isRouting ? "Opening Kakeibo…" : "Open Kakeibo"}
                {isRouting ? null : <ArrowRightIcon className="size-4" />}
              </motion.button>
            </div>
          </div>
        </section>
      </div>
    </ViewTransition>
  );
}
