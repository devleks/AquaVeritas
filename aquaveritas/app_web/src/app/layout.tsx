import type { Metadata } from "next";
import { Geist, Geist_Mono, Newsreader } from "next/font/google";
import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

const newsreader = Newsreader({
  variable: "--font-newsreader",
  subsets: ["latin"],
  weight: ["300", "400", "500", "600"],
  style: ["normal", "italic"],
  display: "swap",
});

export const metadata: Metadata = {
  metadataBase: new URL("https://aquaveritas.dev"),
  title: "AquaVeritas — orbital freshwater intelligence",
  description:
    "Fine-tuned LFM2.5-VL classifies Sentinel-2 imagery of Earth's freshwater bodies. Lake Chad lost 90% of its surface in sixty years. We watched it happen.",
  openGraph: {
    title: "AquaVeritas",
    description:
      "Orbital freshwater intelligence. Fine-tuned LFM2.5-VL on Sentinel-2 imagery.",
    type: "website",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="en"
      className={`${geistSans.variable} ${geistMono.variable} ${newsreader.variable} h-full`}
    >
      <body className="min-h-full flex flex-col">{children}</body>
    </html>
  );
}
