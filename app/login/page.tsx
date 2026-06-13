"use client";

import type { FormEvent } from "react";
import { addTransitionType, useState, useTransition, ViewTransition } from "react";
import { motion, useReducedMotion } from "motion/react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { ArrowRightIcon, CheckIcon, LockIcon, ShieldIcon } from "@/components/icons";

interface LoginFields {
  email: string;
  password: string;
}

interface LoginErrors {
  email?: string;
  password?: string;
}

const emailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export default function LoginPage() {
  const router = useRouter();
  const reduceMotion = useReducedMotion();
  const [isRouting, startRouting] = useTransition();
  const [fields, setFields] = useState<LoginFields>({ email: "", password: "" });
  const [errors, setErrors] = useState<LoginErrors>({});

  function validate(values: LoginFields): LoginErrors {
    const nextErrors: LoginErrors = {};

    if (!emailPattern.test(values.email.trim())) {
      nextErrors.email = "Enter a valid email address.";
    }

    if (values.password.length < 8) {
      nextErrors.password = "Use at least 8 characters.";
    }

    return nextErrors;
  }

  function updateField(field: keyof LoginFields, value: string) {
    setFields((current) => ({ ...current, [field]: value }));
    setErrors((current) => ({ ...current, [field]: undefined }));
  }

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const nextErrors = validate(fields);
    setErrors(nextErrors);

    if (Object.keys(nextErrors).length > 0) {
      toast.error("Check the highlighted fields", {
        description: "The portal needs valid mock credentials to continue.",
      });
      return;
    }

    toast.success("Mock credentials accepted", {
      description: "Opening the protected dashboard shell.",
    });
    startRouting(() => {
      addTransitionType("nav-forward");
      router.push("/dashboard");
    });
  }

  return (
    <ViewTransition
      enter={{ "nav-forward": "nav-forward", "nav-back": "nav-back", default: "none" }}
      exit={{ "nav-forward": "nav-forward", "nav-back": "nav-back", default: "none" }}
      default="none"
    >
      <div className="page-container grid flex-1 items-center gap-10 py-12 lg:grid-cols-2 lg:py-20">
        <motion.section
          initial={reduceMotion ? false : { opacity: 0, x: -16 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ duration: 0.5, ease: [0.22, 1, 0.36, 1] }}
          className="hidden rounded-3xl bg-slate-850 p-10 text-white shadow-lift lg:block"
        >
          <span className="grid size-12 place-items-center rounded-2xl bg-sage-400 text-slate-950">
            <ShieldIcon className="size-6" />
          </span>
          <p className="mt-12 text-sm font-semibold uppercase tracking-[0.16em] text-sage-300">
            The app portal
          </p>
          <h1 className="text-balance mt-4 text-4xl font-semibold tracking-[-0.055em]">
            A calm workspace for complicated financial histories.
          </h1>
          <p className="mt-5 max-w-lg leading-7 text-sage-100/75">
            This authentication screen is a frontend shell. It demonstrates the
            guarded route experience without introducing accounts, sessions, or
            database logic yet.
          </p>
          <div className="mt-10 space-y-4 border-t border-white/10 pt-8">
            {[
              "Audit changes before they affect balances",
              "Keep every settlement traceable",
              "Respect membership windows by default",
            ].map((item) => (
              <div key={item} className="flex items-center gap-3 text-sm text-sage-100">
                <span className="grid size-6 place-items-center rounded-full bg-white/10 text-sage-300">
                  <CheckIcon className="size-3.5" />
                </span>
                {item}
              </div>
            ))}
          </div>
        </motion.section>

        <motion.section
          initial={reduceMotion ? false : { opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{
            delay: reduceMotion ? 0 : 0.08,
            duration: 0.5,
            ease: [0.22, 1, 0.36, 1],
          }}
          className="mx-auto w-full max-w-md"
        >
          <div className="mb-8">
            <p className="text-sm font-semibold uppercase tracking-[0.16em] text-sage-600">
              Welcome back
            </p>
            <h2 className="mt-3 text-3xl font-semibold tracking-[-0.045em] text-slate-950">
              Enter the portal
            </h2>
            <p className="mt-3 leading-7 text-muted">
              Use any valid email and an 8-character password for this mock flow.
            </p>
          </div>

          <form
            noValidate
            onSubmit={handleSubmit}
            className="rounded-3xl border border-line bg-white p-6 shadow-card sm:p-8"
          >
            <div>
              <label htmlFor="email" className="text-sm font-semibold text-ink">
                Email address
              </label>
              <input
                id="email"
                name="email"
                type="email"
                autoComplete="email"
                value={fields.email}
                onChange={(event) => updateField("email", event.target.value)}
                aria-invalid={Boolean(errors.email)}
                aria-describedby={errors.email ? "email-error" : undefined}
                placeholder="you@example.com"
                className="mt-2 w-full rounded-xl border bg-canvas px-4 py-3 text-sm text-ink outline-none transition placeholder:text-muted/65 focus:border-indigo-action focus:bg-white focus:ring-4 focus:ring-indigo-action/10 aria-invalid:border-amber-ink aria-invalid:bg-amber-soft"
              />
              <p id="email-error" className="mt-2 min-h-5 text-xs font-medium text-amber-ink">
                {errors.email ?? ""}
              </p>
            </div>

            <div className="mt-3">
              <label htmlFor="password" className="text-sm font-semibold text-ink">
                Password
              </label>
              <input
                id="password"
                name="password"
                type="password"
                autoComplete="current-password"
                value={fields.password}
                onChange={(event) => updateField("password", event.target.value)}
                aria-invalid={Boolean(errors.password)}
                aria-describedby={errors.password ? "password-error" : "password-hint"}
                placeholder="At least 8 characters"
                className="mt-2 w-full rounded-xl border bg-canvas px-4 py-3 text-sm text-ink outline-none transition placeholder:text-muted/65 focus:border-indigo-action focus:bg-white focus:ring-4 focus:ring-indigo-action/10 aria-invalid:border-amber-ink aria-invalid:bg-amber-soft"
              />
              <p
                id={errors.password ? "password-error" : "password-hint"}
                className={`mt-2 min-h-5 text-xs font-medium ${
                  errors.password ? "text-amber-ink" : "text-muted"
                }`}
              >
                {errors.password ?? "Mock credentials only. No data is submitted."}
              </p>
            </div>

            <motion.button
              type="submit"
              disabled={isRouting}
              whileHover={reduceMotion ? undefined : { y: -1 }}
              whileTap={reduceMotion ? undefined : { scale: 0.985 }}
              className="mt-5 inline-flex min-h-12 w-full items-center justify-center gap-2 rounded-xl bg-indigo-action px-5 py-3 text-sm font-semibold text-white shadow-lg shadow-indigo-action/15 transition-colors hover:bg-indigo-hover disabled:cursor-wait disabled:opacity-75 focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-indigo-action/25"
            >
              {isRouting ? (
                <>
                  <span className="size-4 animate-spin rounded-full border-2 border-white/35 border-t-white" />
                  Verifying mock access
                </>
              ) : (
                <>
                  <LockIcon className="size-4" />
                  Continue to dashboard
                  <ArrowRightIcon className="size-4" />
                </>
              )}
            </motion.button>
          </form>

          <p className="mt-6 text-center text-sm text-muted">
            Need context first?{" "}
            <Link
              href="/"
              transitionTypes={["nav-back"]}
              className="font-semibold text-sage-700 underline-offset-4 hover:underline focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-sage-200"
            >
              Return to the overview
            </Link>
          </p>
        </motion.section>
      </div>
    </ViewTransition>
  );
}
