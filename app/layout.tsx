import type { Metadata } from "next";
import localFont from "next/font/local";
import { Toaster } from "sonner";
import { SiteHeader } from "@/components/site-header";
import "./globals.css";

const fantasqueSans = localFont({
  variable: "--font-fantasque-sans",
  display: "swap",
  src: [
    {
      path: "../style/font/FantasqueSansMNerdFont-Regular.ttf",
      weight: "400",
      style: "normal",
    },
    {
      path: "../style/font/FantasqueSansMNerdFontPropo-Bold.ttf",
      weight: "700",
      style: "normal",
    },
  ],
});

const fantasqueMono = localFont({
  variable: "--font-fantasque-mono",
  display: "swap",
  src: "../style/font/FantasqueSansMNerdFont-Regular.ttf",
});

export const metadata: Metadata = {
  title: {
    default: "Kakeibo - Financial clarity for shared lives",
    template: "%s | Kakeibo",
  },
  description:
    "Audit messy shared-expense records, explain every balance, and settle debt with confidence.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="en"
      className={`${fantasqueSans.variable} ${fantasqueMono.variable} h-full antialiased`}
    >
      <body className="flex min-h-full flex-col">
        <SiteHeader />
        <main className="flex flex-1 flex-col">{children}</main>
        <Toaster
          position="bottom-right"
          toastOptions={{
            classNames: {
              toast: "toast",
              title: "toast-title",
              description: "toast-description",
            },
          }}
        />
      </body>
    </html>
  );
}
