import type { Metadata, Viewport } from "next";
import { Geist, Geist_Mono, Hind_Siliguri } from "next/font/google";
import "./globals.css";
import { Toaster } from "@/components/ui/toaster";
import { PwaRegister } from "@/components/pwa-register";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

const hindSiliguri = Hind_Siliguri({
  variable: "--font-bengali",
  subsets: ["bengali"],
  weight: ["300", "400", "500", "600", "700"],
});

export const metadata: Metadata = {
  title: "গেম জোন | বাংলা গেমিং প্ল্যাটফর্ম",
  description:
    "অফলাইনেও খেলা যায় এমন বাংলা গেম হাব PWA — টার্বো রেসিং, বাংলা কুইজ আরও অনেক কিছু। Android-এ ইনস্টল করে খেলুন!",
  keywords: ["গেম", "বাংলা গেম", "PWA", "রেসিং গেম", "কুইজ", "অফলাইন গেম"],
  applicationName: "গেম জোন",
  manifest: "/manifest.json",
  icons: {
    icon: [
      { url: "/icons/favicon-64.png", sizes: "64x64", type: "image/png" },
      { url: "/icons/icon-192.png", sizes: "192x192", type: "image/png" },
    ],
    apple: "/icons/apple-touch-icon.png",
  },
  appleWebApp: {
    capable: true,
    statusBarStyle: "black-translucent",
    title: "গেম জোন",
  },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
  viewportFit: "cover",
  themeColor: "#0c0a09",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="bn" className="dark" suppressHydrationWarning>
      <body
        className={`${geistSans.variable} ${geistMono.variable} ${hindSiliguri.variable} antialiased bg-background text-foreground [font-family:var(--font-geist-sans),var(--font-bengali),system-ui,sans-serif]`}
      >
        {children}
        <Toaster />
        <PwaRegister />
      </body>
    </html>
  );
}
