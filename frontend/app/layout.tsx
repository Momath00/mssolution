import type { Metadata, Viewport } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";

import ToastHost from "@/components/Toast";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

const siteUrl = "https://mssolutioninformatique.com";
const siteName = "MS Solution Informatique";
const siteDescription = "Plateformes web sur mesure pour les entreprises : sites vitrines, portails clients et outils de gestion conçus et maintenus par MS Solution Informatique.";

export const metadata: Metadata = {
  metadataBase: new URL(siteUrl),
  title: {
    default: siteName,
    template: `%s — ${siteName}`,
  },
  description: siteDescription,
  appleWebApp: {
    title: "MS Solution",
    statusBarStyle: "black-translucent",
  },
  verification: {
    google: "e6oUc4U24Z6mjbq4mzzQslolLbE0d3We0ncrCjn6a6A",
  },
  alternates: {
    canonical: "/",
  },
  robots: {
    index: true,
    follow: true,
  },
  openGraph: {
    type: "website",
    locale: "fr_CA",
    url: siteUrl,
    siteName,
    title: siteName,
    description: siteDescription,
    images: [{ url: "/logo-icon-trimmed.png", width: 512, height: 512, alt: siteName }],
  },
  twitter: {
    card: "summary",
    title: siteName,
    description: siteDescription,
    images: ["/logo-icon-trimmed.png"],
  },
};

export const viewport: Viewport = {
  themeColor: "#1a1440",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="fr"
      className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}
    >
      <body className="min-h-full flex flex-col">
        {children}
        <ToastHost />
      </body>
    </html>
  );
}
