import type { Metadata } from "next";
import { Toaster } from "sonner";
import { SiteHeader } from "@/components/site-header";
import { euclid } from "@/style/fonts";
import "./globals.css";

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
      className={`${euclid.className} h-full antialiased`}
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
