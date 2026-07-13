import type { Metadata, Viewport } from "next"
import { Inter } from "next/font/google"
import "./globals.css"
import { SWorker } from "./sworker"

const inter = Inter({ subsets: ["latin"] })

export const metadata: Metadata = {
  title: "Alarmpaneel",
  description: "Bedien je alarmsysteem op afstand",
  manifest: "/manifest.json",
  appleWebApp: {
    capable: true,
    title: "Alarmpaneel",
    statusBarStyle: "black-translucent"
  }
}

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
  viewportFit: "cover",
  themeColor: "#ffffff"
}

export default function RootLayout({
  children
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="nl">
      <head>
        <link rel="icon" type="image/svg+xml" href="/icon-192.svg" />
        <link rel="apple-touch-icon" href="/icon-192.svg" />
      </head>
      <body className={inter.className}>
        <SWorker />
        <div className="min-h-dvh bg-slate-50 flex flex-col">
          {children}
        </div>
      </body>
    </html>
  )
}
