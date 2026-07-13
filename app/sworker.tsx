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
      // Only show on touch devices (phones/tablets), not desktop
      if (!window.matchMedia("(pointer: coarse)").matches) return
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
      <div className="card max-w-md mx-auto p-4 flex items-center justify-between">
        <div className="flex items-center space-x-3">
          <img src="/icon-192.svg" alt="" className="w-10 h-10 rounded-xl" />
          <div>
            <p className="text-slate-900 dark:text-slate-100 text-sm font-medium">Alarmpaneel</p>
            <p className="text-slate-500 dark:text-slate-400 text-xs">Voeg toe aan beginscherm</p>
          </div>
        </div>
        <div className="flex items-center space-x-2">
          <button
            onClick={() => setShowPrompt(false)}
            className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 text-xs px-2"
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
