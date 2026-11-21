import type { Metadata, Viewport } from "next";
import { Hanken_Grotesk, Geist_Mono } from "next/font/google";
import "./globals.css";
import PwaRegister from "./pwa-register";
import OfflineBanner from "@/components/offline-banner";

const hankenGrotesk = Hanken_Grotesk({
  variable: "--font-hanken-grotesk",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "Bitewise | Calm Calorie & Nutrition",
  description: "A calm, precision view of your meals, macros, and daily targets.",
  manifest: "/manifest.webmanifest",
};

export const viewport: Viewport = {
  themeColor: "#13110e",
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html
      lang="en"
      suppressHydrationWarning
      className={`${hankenGrotesk.variable} ${geistMono.variable} h-full antialiased`}
    >
      <head>
        <script
          dangerouslySetInnerHTML={{
            __html: `(() => {
  let theme = "dark";
  try {
    const saved = localStorage.getItem("bitewise-theme");
    if (saved === "light" || saved === "dark") theme = saved;
  } catch {}
  document.documentElement.dataset.theme = theme;
  document.querySelector('meta[name="theme-color"]')?.setAttribute("content", theme === "dark" ? "#13110e" : "#faf7f2");
})()`,
          }}
        />
      </head>
      <body className="min-h-full flex flex-col"><PwaRegister /><OfflineBanner />{children}</body>
    </html>
  );
}
