"use client"

import { useState, useEffect, useCallback, useRef } from "react"
import {
  ShieldCheckIcon,
  CheckCircleIcon,
  LockClosedIcon,
  ArrowRightOnRectangleIcon,
  Cog6ToothIcon,
  BackspaceIcon,
  UserIcon
} from "@heroicons/react/24/outline"
import * as api from "./helpers/api"

interface User {
  id: number
  name: string
  role: string
}

interface Session {
  token: string
  user: User
  expires_at: string
}

interface AlarmState {
  armed: boolean
  loading: boolean
  actionInProgress: boolean
}

const PIN_LENGTH = 4
const SESSION_KEY = "alarm_session"
const USERNAME_KEY = "alarm_username"

export default function Home() {
  const [session, setSession] = useState<Session | null>(() => {
    if (typeof window !== "undefined") {
      const stored = localStorage.getItem(SESSION_KEY)
      if (stored) {
        try {
          const parsed = JSON.parse(stored)
          if (new Date(parsed.expires_at).getTime() > Date.now()) return parsed
        } catch {}
      }
    }
    return null
  })
  const [alarm, setAlarm] = useState<AlarmState>({
    armed: false,
    loading: true,
    actionInProgress: false
  })
  const [error, setError] = useState<string | null>(null)
  const eventSourceRef = useRef<EventSource | null>(null)

  const pollAlarmState = useCallback(async (token: string) => {
    try {
      const data = await api.getAlarmStatus(token)
      setAlarm(prev => ({ ...prev, armed: data.armed, loading: false }))
    } catch {
      setAlarm(prev => ({ ...prev, loading: false }))
    }
  }, [])

  useEffect(() => {
    if (!session) {
      setAlarm({ armed: false, loading: true, actionInProgress: false })
      return
    }

    pollAlarmState(session.token)

    const es = api.createSSEConnection(session.token, armed => {
      setAlarm(prev => ({ ...prev, armed, loading: false }))
    })

    eventSourceRef.current = es

    const pollInterval = setInterval(() => pollAlarmState(session.token), 10000)
    return () => {
      es.close()
      clearInterval(pollInterval)
    }
  }, [session, pollAlarmState])

  useEffect(() => {
    if (!session) return
    const expiresAt = new Date(session.expires_at).getTime()
    const timeout = expiresAt - Date.now()
    if (timeout <= 0) {
      setSession(null)
      setError("Sessie verlopen. Voer je pincode opnieuw in.")
      return
    }
    const timer = setTimeout(() => {
      setSession(null)
      setError("Sessie verlopen. Voer je pincode opnieuw in.")
    }, timeout)
    return () => clearTimeout(timer)
  }, [session])

  const handleLogout = () => {
    if (eventSourceRef.current) eventSourceRef.current.close()
    localStorage.removeItem(SESSION_KEY)
    setSession(null)
    setError(null)
  }

  const handleArm = async () => {
    if (!session) return
    setAlarm(prev => ({ ...prev, actionInProgress: true }))
    setError(null)
    try {
      await api.armAlarm(session.token)
      setAlarm(prev => ({ ...prev, armed: true, actionInProgress: false }))
    } catch (err: any) {
      if (err.message?.includes("401")) {
        setSession(null)
        setError("Sessie verlopen. Log opnieuw in.")
      } else {
        setError(err.message || "Inschakelen mislukt")
      }
      setAlarm(prev => ({ ...prev, actionInProgress: false }))
    }
  }

  const handleDisarm = async () => {
    if (!session) return
    setAlarm(prev => ({ ...prev, actionInProgress: true }))
    setError(null)
    try {
      await api.disarmAlarm(session.token)
      setAlarm(prev => ({ ...prev, armed: false, actionInProgress: false }))
    } catch (err: any) {
      if (err.message?.includes("401")) {
        setSession(null)
        setError("Sessie verlopen. Log opnieuw in.")
      } else {
        setError(err.message || "Uitschakelen mislukt")
      }
      setAlarm(prev => ({ ...prev, actionInProgress: false }))
    }
  }

  if (!session) {
    return <PinEntry onAuthenticated={setSession} initialError={error} />
  }

  const timeRemaining = session.expires_at
    ? Math.max(
        0,
        Math.floor((new Date(session.expires_at).getTime() - Date.now()) / 60000)
      )
    : 0

  return (
    <div className="flex-1 flex flex-col safe-bottom">
      <header className="flex items-center justify-between px-5 py-4 border-b border-slate-200 bg-white shrink-0">
        <div className="flex items-center gap-2.5">
          <div className="bg-primary text-white rounded-xl p-1.5">
            <ShieldCheckIcon className="w-5 h-5" />
          </div>
          <span className="font-semibold text-slate-900">Alarmpaneel</span>
        </div>
        <div className="flex items-center gap-4">
          {session.user.role === "admin" && (
            <a
              href="/admin"
              aria-label="Beheer"
              className="text-slate-400 hover:text-slate-600 transition-colors"
            >
              <Cog6ToothIcon className="w-5 h-5" />
            </a>
          )}
          <button
            onClick={handleLogout}
            aria-label="Uitloggen"
            className="text-slate-400 hover:text-slate-600 transition-colors"
          >
            <ArrowRightOnRectangleIcon className="w-5 h-5" />
          </button>
        </div>
      </header>

      <div className="flex-1 flex flex-col p-5 sm:p-6 max-w-md w-full mx-auto">
        <div className="flex-1 flex flex-col items-center justify-center space-y-5 text-center">
          {alarm.loading ? (
            <span className="animate-spin h-8 w-8 border-2 border-primary border-t-transparent rounded-full" />
          ) : (
            <>
              <div className={`p-6 rounded-full ${alarm.armed ? "bg-primary/10" : "bg-success/10"}`}>
                {alarm.armed ? (
                  <LockClosedIcon className="w-12 h-12 text-primary" />
                ) : (
                  <CheckCircleIcon className="w-12 h-12 text-success" />
                )}
              </div>
              <div className="space-y-1.5">
                <span className={`badge ${alarm.armed ? "badge-primary" : "badge-success"}`}>
                  <span className={`w-2 h-2 rounded-full ${alarm.armed ? "bg-primary" : "bg-success"}`} />
                  {alarm.armed ? "Ingeschakeld" : "Uitgeschakeld"}
                </span>
                <p className="text-slate-500 text-sm">
                  {alarm.armed ? "Het systeem bewaakt je woning" : "Je bent veilig thuis"}
                </p>
              </div>
            </>
          )}
        </div>

        <div className="space-y-3">
          {error && (
            <div className="bg-danger/10 border border-danger/20 rounded-xl p-3">
              <p className="text-danger-dark text-sm text-center">{error}</p>
            </div>
          )}

          {!alarm.armed ? (
            <button
              onClick={handleArm}
              disabled={alarm.actionInProgress || alarm.loading}
              className="btn-primary w-full flex items-center justify-center gap-2"
            >
              <LockClosedIcon className="w-5 h-5" />
              <span>{alarm.actionInProgress ? "Bezig..." : "Inschakelen"}</span>
            </button>
          ) : (
            <button
              onClick={handleDisarm}
              disabled={alarm.actionInProgress || alarm.loading}
              className="btn-success w-full flex items-center justify-center gap-2"
            >
              <CheckCircleIcon className="w-5 h-5" />
              <span>{alarm.actionInProgress ? "Bezig..." : "Uitschakelen"}</span>
            </button>
          )}

          <p className="text-center text-slate-400 text-xs">
            {session.user.name} &middot; sessie verloopt over {timeRemaining}m
          </p>
        </div>
      </div>
    </div>
  )
}

function PinEntry({
  onAuthenticated,
  initialError
}: {
  onAuthenticated: (session: Session) => void
  initialError: string | null
}) {
  const [name, setName] = useState("")
  const [editingName, setEditingName] = useState(true)
  const [pin, setPin] = useState("")
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(initialError)
  const [lockoutUntil, setLockoutUntil] = useState<number>(0)
  const nameRef = useRef<HTMLInputElement>(null)
  const pinRef = useRef("")

  useEffect(() => {
    const stored = localStorage.getItem(USERNAME_KEY)
    if (stored) {
      setName(stored)
      setEditingName(false)
    }
  }, [])

  useEffect(() => {
    if (editingName) nameRef.current?.focus()
  }, [editingName])

  useEffect(() => {
    const interval = setInterval(() => {
      if (lockoutUntil > 0 && Date.now() >= lockoutUntil) {
        setLockoutUntil(0)
        setError(null)
      }
    }, 1000)
    return () => clearInterval(interval)
  }, [lockoutUntil])

  const doSubmit = useCallback(async (currentPin: string, currentName: string) => {
    setLoading(true)
    setError(null)

    try {
      const data = await api.verifyPin(currentName, currentPin)
      setPin("")
      pinRef.current = ""
      localStorage.setItem(USERNAME_KEY, data.user.name)
      const session = {
        token: data.token,
        user: data.user,
        expires_at: data.expires_at
      }
      localStorage.setItem(SESSION_KEY, JSON.stringify(session))
      onAuthenticated(session)
    } catch (err: any) {
      const msg = err.message || "Verificatie mislukt"
      setError(msg)

      if (msg.includes("Too many")) {
        const match = msg.match(/(\d+)\s*seconds/)
        if (match) setLockoutUntil(Date.now() + parseInt(match[1]) * 1000)
      }

      setPin("")
      pinRef.current = ""
    } finally {
      setLoading(false)
    }
  }, [onAuthenticated])

  const handleDigit = useCallback((digit: string) => {
    if (loading || lockoutUntil > 0 || editingName) return
    const next = (pinRef.current + digit).slice(0, PIN_LENGTH)
    pinRef.current = next
    setPin(next)
    if (next.length === PIN_LENGTH) {
      if (!name.trim()) {
        setError("Vul je naam in")
        setEditingName(true)
        return
      }
      doSubmit(next, name.trim())
    }
  }, [loading, lockoutUntil, editingName, name, doSubmit])

  const handleBackspace = useCallback(() => {
    if (loading || lockoutUntil > 0) return
    const next = pinRef.current.slice(0, -1)
    pinRef.current = next
    setPin(next)
  }, [loading, lockoutUntil])

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (document.activeElement === nameRef.current) return
      if (/^[0-9]$/.test(e.key)) {
        e.preventDefault()
        handleDigit(e.key)
      } else if (e.key === "Backspace") {
        e.preventDefault()
        handleBackspace()
      } else if (e.key === "Enter" && pinRef.current.length === PIN_LENGTH && name.trim() && !editingName) {
        doSubmit(pinRef.current, name.trim())
      }
    }
    window.addEventListener("keydown", handler)
    return () => window.removeEventListener("keydown", handler)
  }, [handleDigit, handleBackspace, doSubmit, name, editingName])

  const handleSwitchUser = () => {
    localStorage.removeItem(USERNAME_KEY)
    setName("")
    setEditingName(true)
    setPin("")
    pinRef.current = ""
    setError(null)
  }

  const handleNameKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && name.trim()) {
      e.preventDefault()
      setEditingName(false)
    }
  }

  const lockoutRemaining = lockoutUntil > 0
    ? Math.max(0, Math.ceil((lockoutUntil - Date.now()) / 1000))
    : 0

  return (
    <div className="flex-1 flex flex-col items-center justify-center p-5 sm:p-6 safe-bottom">
      <div className="card-padded max-w-sm w-full space-y-6">
        <div className="text-center space-y-2">
          <div className="bg-primary text-white rounded-2xl p-3 inline-flex">
            <ShieldCheckIcon className="w-7 h-7" />
          </div>
          <h1 className="text-xl font-bold text-slate-900">Alarmpaneel</h1>
          <p className="text-slate-500 text-sm">
            {editingName ? "Voer je naam in om te beginnen" : "Voer je pincode in"}
          </p>
        </div>

        {editingName ? (
          <div className="relative">
            <UserIcon className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-400" />
            <input
              ref={nameRef}
              type="text"
              value={name}
              onChange={e => setName(e.target.value)}
              onKeyDown={handleNameKeyDown}
              placeholder="Naam"
              autoComplete="off"
              autoCorrect="off"
              autoCapitalize="off"
              spellCheck={false}
              className="w-full bg-slate-50 border border-slate-200 rounded-xl py-3.5 pl-10 pr-4 text-slate-900
                       placeholder:text-slate-400 outline-none focus:border-primary focus:ring-2 focus:ring-primary/20
                       transition-all text-base"
            />
          </div>
        ) : (
          <div className="flex items-center justify-between bg-slate-50 border border-slate-200 rounded-xl px-4 py-3">
            <div className="flex items-center gap-2 min-w-0">
              <UserIcon className="w-4 h-4 text-slate-400 shrink-0" />
              <span className="text-slate-700 font-medium text-sm truncate">{name}</span>
            </div>
            <button
              onClick={handleSwitchUser}
              className="text-primary hover:text-primary-dark text-xs font-medium shrink-0"
            >
              Wisselen
            </button>
          </div>
        )}

        {lockoutUntil > 0 ? (
          <div className="bg-amber-50 border border-amber-200 rounded-xl p-3">
            <p className="text-amber-700 text-sm text-center">
              Geblokkeerd &middot; probeer opnieuw over {lockoutRemaining}s
            </p>
          </div>
        ) : error ? (
          <div className="bg-danger/10 border border-danger/20 rounded-xl p-3">
            <p className="text-danger-dark text-sm text-center">{error}</p>
          </div>
        ) : null}

        {editingName ? (
          <button
            onClick={() => name.trim() && setEditingName(false)}
            disabled={!name.trim()}
            className="btn-primary w-full"
          >
            Doorgaan
          </button>
        ) : (
          <div className="space-y-4">
            <div className="flex justify-center gap-3">
              {Array.from({ length: PIN_LENGTH }).map((_, i) => (
                <div key={i} className={`pin-dot ${i < pin.length ? "pin-dot-filled" : ""}`} />
              ))}
            </div>

            <Keypad onDigit={handleDigit} onBackspace={handleBackspace} disabled={loading || lockoutUntil > 0} />

            {loading && (
              <div className="flex justify-center">
                <span className="animate-spin h-5 w-5 border-2 border-primary border-t-transparent rounded-full" />
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  )
}

function Keypad({
  onDigit,
  onBackspace,
  disabled
}: {
  onDigit: (digit: string) => void
  onBackspace: () => void
  disabled?: boolean
}) {
  const keys = ["1", "2", "3", "4", "5", "6", "7", "8", "9", "", "0", "backspace"]

  return (
    <div className="grid grid-cols-3 gap-3" role="group" aria-label="Cijferpaneel">
      {keys.map((key, i) => {
        if (key === "") return <div key={i} />
        if (key === "backspace") {
          return (
            <button
              key={i}
              type="button"
              onClick={onBackspace}
              disabled={disabled}
              aria-label="Verwijder cijfer"
              className="keypad-btn text-slate-400"
            >
              <BackspaceIcon className="w-6 h-6" />
            </button>
          )
        }
        return (
          <button
            key={i}
            type="button"
            onClick={() => onDigit(key)}
            disabled={disabled}
            aria-label={`Cijfer ${key}`}
            className="keypad-btn"
          >
            {key}
          </button>
        )
      })}
    </div>
  )
}
