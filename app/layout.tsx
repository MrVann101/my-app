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
  title: "Bitewise | Nordic Calorie & Nutrition",
  description: "A calm, precision view of your meals, macros, and daily targets.",
  manifest: "/manifest.webmanifest",
};

export const viewport: Viewport = { themeColor: "#0b1320" };

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html
      lang="en"
      data-theme="dark"
      className={`${hankenGrotesk.variable} ${geistMono.variable} h-full antialiased`}
    >
      <body className="min-h-full flex flex-col"><PwaRegister /><OfflineBanner />{children}</body>
    </html>
  );
}
