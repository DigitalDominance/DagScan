import type React from "react"
import type { Metadata } from "next"
import { Inter, Orbitron, Rajdhani } from "next/font/google"
import "./globals.css"

const inter = Inter({
  subsets: ["latin"],
  weight: ["300", "400", "500", "600", "700", "800", "900"],
  variable: "--font-inter",
})

const orbitron = Orbitron({
  subsets: ["latin"],
  weight: ["400", "500", "600", "700", "800", "900"],
  variable: "--font-orbitron",
})

const rajdhani = Rajdhani({
  subsets: ["latin"],
  weight: ["300", "400", "500", "600", "700"],
  variable: "--font-rajdhani",
})

export const metadata: Metadata = {
  title: "DagScan - Kaspa EVM Explorer",
  description:
    "Explore the Kaspa EVM ecosystem with DagScan - Your gateway to BlockDAG transactions, blocks, and addresses",
  keywords: ["Kaspa", "EVM", "Blockchain", "Explorer", "BlockDAG", "Cryptocurrency", "DeFi", "Web3"],
  authors: [{ name: "KASPER", url: "https://x.com/kaspercoin" }],
  creator: "KASPER",
  publisher: "DagScan",
  formatDetection: {
    email: false,
    address: false,
    telephone: false,
  },
  metadataBase: new URL("https://dagscan.xyz"),
  alternates: {
    canonical: "/",
  },
  openGraph: {
    type: "website",
    locale: "en_US",
    url: "https://dagscan.xyz",
    title: "DagScan - Kaspa EVM Explorer",
    description:
      "Explore the Kaspa EVM ecosystem with DagScan - Your gateway to BlockDAG transactions, blocks, and addresses",
    siteName: "DagScan",
    images: [
      {
        url: "/android-chrome-512x512.png",
        width: 512,
        height: 512,
        alt: "DagScan - Kaspa EVM Explorer",
      },
      {
        url: "/android-chrome-192x192.png",
        width: 192,
        height: 192,
        alt: "DagScan Logo",
      },
    ],
  },
  twitter: {
    card: "summary_large_image",
    title: "DagScan - Kaspa EVM Explorer",
    description:
      "Explore the Kaspa EVM ecosystem with DagScan - Your gateway to BlockDAG transactions, blocks, and addresses",
    creator: "@kaspercoin",
    images: ["/android-chrome-512x512.png"],
  },
  robots: {
    index: true,
    follow: true,
    googleBot: {
      index: true,
      follow: true,
      "max-video-preview": -1,
      "max-image-preview": "large",
      "max-snippet": -1,
    },
  },
  verification: {
    google: "your-google-verification-code", // Replace with actual verification code
  },
  category: "technology",
    generator: 'v0.dev'
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="en" className={`${inter.variable} ${orbitron.variable} ${rajdhani.variable}`}>
      <head>
        {/* Favicon and Icons */}
        <link rel="icon" href="/favicon.ico" sizes="any" />
        <link rel="icon" href="/favicon-16x16.png" type="image/png" sizes="16x16" />
        <link rel="icon" href="/favicon-32x32.png" type="image/png" sizes="32x32" />
        <link rel="apple-touch-icon" href="/apple-touch-icon.png" />
        <link rel="manifest" href="/site.webmanifest" />

        {/* Theme and Browser Configuration */}
        <meta name="theme-color" content="#8b5cf6" />
        <meta name="msapplication-TileColor" content="#8b5cf6" />
        <meta name="msapplication-config" content="/browserconfig.xml" />

        {/* PWA Meta Tags */}
        <meta name="application-name" content="DagScan" />
        <meta name="apple-mobile-web-app-capable" content="yes" />
        <meta name="apple-mobile-web-app-status-bar-style" content="black-translucent" />
        <meta name="apple-mobile-web-app-title" content="DagScan" />
        <meta name="mobile-web-app-capable" content="yes" />

        {/* Additional SEO Meta Tags */}
        <meta name="viewport" content="width=device-width, initial-scale=1, shrink-to-fit=no" />
        <meta httpEquiv="X-UA-Compatible" content="IE=edge" />
        <meta name="referrer" content="origin-when-cross-origin" />

        {/* Preconnect to external domains for performance */}
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />

        {/* DNS Prefetch for API endpoints */}
        <link rel="dns-prefetch" href="https://rpc.kasplextest.xyz" />
        <link rel="dns-prefetch" href="https://frontend.kasplextest.xyz" />

        {/* Structured Data for Search Engines */}
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{
            __html: JSON.stringify({
              "@context": "https://schema.org",
              "@type": "WebApplication",
              name: "DagScan",
              description:
                "Explore the Kaspa EVM ecosystem with DagScan - Your gateway to BlockDAG transactions, blocks, and addresses",
              url: "https://dagscan.xyz",
              applicationCategory: "FinanceApplication",
              operatingSystem: "Any",
              offers: {
                "@type": "Offer",
                price: "0",
                priceCurrency: "USD",
              },
              author: {
                "@type": "Person",
                name: "KASPER",
                url: "https://x.com/kaspercoin",
              },
            }),
          }}
        />
      </head>
      <body className="font-inter antialiased">{children}</body>
    </html>
  )
}
