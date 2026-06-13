import localFont from "next/font/local";

export const fantasqueSans = localFont({
  variable: "--font-fantasque-sans",
  display: "swap",
  src: [
    {
      path: "./font/FantasqueSansMNerdFont-Regular.ttf",
      weight: "400",
      style: "normal",
    },
    {
      path: "./font/FantasqueSansMNerdFontPropo-Bold.ttf",
      weight: "700",
      style: "normal",
    },
  ],
});

export const fantasqueMono = localFont({
  variable: "--font-fantasque-mono",
  display: "swap",
  src: "./font/FantasqueSansMNerdFont-Regular.ttf",
});
