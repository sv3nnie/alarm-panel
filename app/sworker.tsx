"use client"

import { useEffect, useState } from "react"

export function SWorker() {
  const [installPrompt, setInstallPrompt] = useState<any>(null)
  const [showPrompt, setShowPrompt] = useState(false)

  useEffect(() => {
    if ("serviceWorker" in navigator) {
      navigator.serviceWorker.register("/sw.js").catch(() => {})
    }

    const handler = (e: Event) => {
      e.preventDefault()
      setInstallPrompt(e)
      setShowPrompt(true)
    }

    window.addEventListener("beforeinstallprompt", handler)

    // Check if already installed
    if (window.matchMedia("(display-mode: standalone)").matches) {
      setShowPrompt(false)
    }

    return () => window.removeEventListener("beforeinstallprompt", handler)
  }, [])

  const handleInstall = async () => {
    if (!installPrompt) return
    installPrompt.prompt()
    const result = await installPrompt.userChoice
    if (result.outcome === "accepted") {
      setShowPrompt(false)
    }
  }

  if (!showPrompt) return null

  return (
    <div className="fixed bottom-0 left-0 right-0 z-50 p-4 safe-bottom">
      <div className="glass max-w-md mx-auto p-4 flex items-center justify-between">
        <div className="flex items-center space-x-3">
          <img src="/icon-192.svg" alt="" className="w-10 h-10 rounded-xl" />
          <div>
            <p className="text-white text-sm font-medium">Alarmpaneel</p>
            <p className="text-white/40 text-xs">Voeg toe aan beginscherm</p>
          </div>
        </div>
        <div className="flex items-center space-x-2">
          <button
            onClick={() => setShowPrompt(false)}
            className="text-white/30 hover:text-white/60 text-xs px-2"
          >
            Later
          </button>
          <button onClick={handleInstall} className="btn-primary text-xs py-2 px-4">
            Installeer
          </button>
        </div>
      </div>
    </div>
  )
}
