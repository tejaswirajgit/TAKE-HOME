import type { Metadata, Viewport } from "next";
import { Inter, Fraunces, JetBrains_Mono } from "next/font/google";
import "./globals.css";

// Type ramp: Inter for reading, Fraunces for the question itself (a warm
// serif reads like a person asking), JetBrains Mono for eyebrows + counters.
const sans = Inter({ subsets: ["latin"], variable: "--font-sans" });
const display = Fraunces({
  subsets: ["latin"],
  variable: "--font-display",
  axes: ["opsz", "SOFT", "WONK"],
});
const mono = JetBrains_Mono({ subsets: ["latin"], variable: "--font-mono" });

export const metadata: Metadata = {
  title: "Hair & Scalp Intake",
  description: "A 16-question clinic intake that fills itself — tap or speak, in English or Hindi.",
};

// No maximumScale: patients must be able to pinch-zoom.
export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  themeColor: "#f5f5f0",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={`${sans.variable} ${display.variable} ${mono.variable}`}>
      <body className="font-sans">{children}</body>
    </html>
  );
}
