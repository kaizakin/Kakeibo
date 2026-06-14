import { redirect } from "next/navigation";
import { auth, signIn } from "@/src/lib/auth";
import Link from "next/link";
import { ArrowRightIcon, CheckIcon, ShieldIcon } from "@/components/icons";

export const metadata = {
  title: "Sign in",
};

export default async function LoginPage() {
  // If already authenticated, redirect to dashboard
  const session = await auth();
  if (session?.user) {
    redirect("/dashboard");
  }

  return (
    <div className="page-container flex flex-1 items-center justify-center px-4 py-12 lg:py-20">
      {/* Sign in panel */}
      <section className="w-full max-w-md">
        <div className="mb-8 text-center">
          <p className="text-sm font-semibold uppercase tracking-[0.16em] text-[#9353d3]">
            Welcome
          </p>
          <h2 className="mt-3 text-3xl font-semibold tracking-[-0.045em] text-[#1a1a1a]">
            Sign in to Kakeibo
          </h2>
          <p className="mt-3 leading-7 text-gray-500">
            Use your Google account to access the expense management dashboard.
          </p>
        </div>

        <div className="rounded-3xl border border-gray-100 bg-white p-6 shadow-sm sm:p-8">
          <form
            action={async () => {
              "use server";
              await signIn("google", { redirectTo: "/dashboard" });
            }}
          >
            <button
              type="submit"
              className="inline-flex min-h-12 w-full items-center justify-center gap-3 rounded-xl border border-gray-200 bg-white px-5 py-3 text-sm font-semibold text-[#1a1a1a] shadow-sm transition-colors hover:bg-gray-50 focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-gray-100"
            >
              <svg className="size-5" viewBox="0 0 24 24" aria-hidden="true">
                <path
                  d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 0 1-2.2 3.32v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.1z"
                  fill="#4285F4"
                />
                <path
                  d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
                  fill="#34A853"
                />
                <path
                  d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"
                  fill="#FBBC05"
                />
                <path
                  d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"
                  fill="#EA4335"
                />
              </svg>
              Continue with Google
            </button>
          </form>

          <div className="mt-6 flex items-center gap-3">
            <div className="h-px flex-1 bg-gray-100" />
            <span className="text-xs font-medium text-gray-400">Secure OAuth 2.0</span>
            <div className="h-px flex-1 bg-gray-100" />
          </div>

          <p className="mt-5 text-center text-sm leading-6 text-gray-500">
            Your account data is managed through Google&apos;s secure
            authentication. We only access your name and email.
          </p>
        </div>

        <p className="mt-6 text-center text-sm text-gray-500">
          Need context first?{" "}
          <Link
            href="/"
            className="font-semibold text-[#9353d3] underline-offset-4 hover:underline focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-purple-200"
          >
            Return to the overview
          </Link>
        </p>
      </section>
    </div>
  );
}
