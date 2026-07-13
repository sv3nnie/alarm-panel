import type { Metadata, Viewport } from "next"
import { Inter } from "next/font/google"
import "./globals.css"

const inter = Inter({ subsets: ["latin"] })

export const metadata: Metadata = {
  title: "Alarm Panel",
  description: "Remote alarm system control panel",
  appleWebApp: {
    capable: true,
    title: "Alarm Panel",
    statusBarStyle: "black-translucent"
  }
}

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
  viewportFit: "cover",
  themeColor: "#020617"
}

export default function RootLayout({
  children
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="en">
      <body className={inter.className}>
        <div className="min-h-dvh bg-gradient-to-br from-dark-deeper via-dark to-dark-deeper flex flex-col">
          {children}
        </div>
      </body>
    </html>
  )
}
