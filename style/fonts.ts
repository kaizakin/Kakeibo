import localFont from "next/font/local";

export const euclid = localFont({
  src: [
    {
      path: "./font/Euclid-Circular-B-Regular.ttf",
      weight: "400",
      style: "normal"
    }
  ],
  variable: "--font-euclid"
})
