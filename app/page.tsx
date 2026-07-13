"use client"

import { useState, useEffect, useCallback, useRef } from "react"
import {
  ShieldCheckIcon,
  ShieldExclamationIcon,
  ArrowRightOnRectangleIcon,
  LockClosedIcon,
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

export default function Home() {
  const [session, setSession] = useState<Session | null>(() => {
    if (typeof window !== "undefined") {
      const stored = localStorage.getItem("alarm_session")
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
    localStorage.removeItem("alarm_session")
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
    <div className="flex-1 flex flex-col items-center justify-center p-4 sm:p-6 safe-bottom">
      <div className="glass-card max-w-md w-full text-center space-y-6 sm:space-y-8">
        <div className="space-y-2">
          <h1 className="text-xl sm:text-2xl font-bold text-gradient">
            Alarmpaneel
          </h1>
          <p className="text-white/40 text-xs sm:text-sm">
            {session.user.name} &middot; Sessie verloopt over {timeRemaining}m
          </p>
        </div>

        <div className="flex flex-col items-center space-y-4">
          <div
            className={`p-5 sm:p-6 rounded-full transition-colors duration-500 ${
              alarm.armed ? "bg-danger/10" : "bg-success/10"
            }`}
          >
            {alarm.armed ? (
              <ShieldExclamationIcon className="w-14 h-14 sm:w-16 sm:h-16 text-danger animate-pulse" />
            ) : (
              <ShieldCheckIcon className="w-14 h-14 sm:w-16 sm:h-16 text-success" />
            )}
          </div>

          <div className="flex items-center space-x-2">
            <div
              className={`status-dot ${alarm.armed ? "status-dot-armed" : "status-dot-disarmed"}`}
            />
            <span
              className={`text-lg sm:text-xl font-semibold ${alarm.armed ? "text-danger" : "text-success"}`}
            >
              {alarm.armed ? "INGESCHAKELD" : "UITGESCHAKELD"}
            </span>
          </div>
        </div>

        <div className="flex flex-col sm:flex-row sm:space-x-4 justify-center space-y-3 sm:space-y-0 px-2">
          {!alarm.armed ? (
            <button
              onClick={handleArm}
              disabled={alarm.actionInProgress}
              className="btn-danger flex items-center justify-center space-x-2"
            >
              <LockClosedIcon className="w-5 h-5" />
              <span>{alarm.actionInProgress ? "Bezig..." : "Inschakelen"}</span>
            </button>
          ) : (
            <button
              onClick={handleDisarm}
              disabled={alarm.actionInProgress}
              className="btn-success flex items-center justify-center space-x-2"
            >
              <LockClosedIcon className="w-5 h-5" />
              <span>{alarm.actionInProgress ? "Bezig..." : "Uitschakelen"}</span>
            </button>
          )}
        </div>

        {error && (
          <div className="bg-danger/10 border border-danger/20 rounded-xl p-3">
            <p className="text-danger text-xs sm:text-sm">{error}</p>
          </div>
        )}

        <div className="flex flex-col items-center space-y-2">
          {session.user.role === "admin" && (
            <a href="/admin" className="text-primary/60 hover:text-primary text-sm transition-colors">
              Beheer
            </a>
          )}
          <button
            onClick={handleLogout}
            className="text-white/30 hover:text-white/60 text-sm flex items-center space-x-1 mx-auto transition-colors"
          >
            <ArrowRightOnRectangleIcon className="w-4 h-4" />
            <span>Uitloggen</span>
          </button>
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
  const [pin, setPin] = useState("")
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(initialError)
  const [lockoutUntil, setLockoutUntil] = useState<number>(0)
  const inputRef = useRef<HTMLInputElement>(null)
  const nameRef = useRef<HTMLInputElement>(null)
  const pinRef = useRef("")

  useEffect(() => {
    const interval = setInterval(() => {
      if (lockoutUntil > 0 && Date.now() >= lockoutUntil) {
        setLockoutUntil(0)
        setError(null)
      }
    }, 1000)
    return () => clearInterval(interval)
  }, [lockoutUntil])

  useEffect(() => {
    nameRef.current?.focus()
  }, [])

  const doSubmit = async (currentPin: string, currentName: string) => {
    if (loading || lockoutUntil > 0) return

    if (!currentName.trim()) {
      setError("Vul je naam in")
      nameRef.current?.focus()
      return
    }

    if (currentPin.length < PIN_LENGTH) {
      setError("Vul je pincode in")
      inputRef.current?.focus()
      return
    }

    setLoading(true)
    setError(null)

    try {
      const data = await api.verifyPin(currentName.trim(), currentPin)
      setPin("")
      pinRef.current = ""
      const session = {
        token: data.token,
        user: data.user,
        expires_at: data.expires_at
      }
      localStorage.setItem("alarm_session", JSON.stringify(session))
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
      inputRef.current?.focus()
    } finally {
      setLoading(false)
    }
  }

  const handlePinChange = (value: string) => {
    const digits = value.replace(/\D/g, "").slice(0, PIN_LENGTH)
    pinRef.current = digits
    setPin(digits)
    if (digits.length === PIN_LENGTH && name.trim()) {
      doSubmit(digits, name.trim())
    }
  }

  const handleNameKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter") {
      e.preventDefault()
      inputRef.current?.focus()
    }
  }

  const handlePinKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && pinRef.current.length === PIN_LENGTH && name.trim()) {
      doSubmit(pinRef.current, name.trim())
    } else if (e.key === "Backspace" && pinRef.current.length === 0) {
      e.preventDefault()
      nameRef.current?.focus()
    }
  }

  const lockoutRemaining = lockoutUntil > 0
    ? Math.max(0, Math.ceil((lockoutUntil - Date.now()) / 1000))
    : 0

  return (
    <div className="flex-1 flex flex-col items-center justify-center p-4 sm:p-6 safe-bottom">
      <div className="glass-card max-w-sm w-full text-center space-y-5 sm:space-y-6">
        <div className="space-y-2">
          <div className="bg-white/5 p-4 rounded-full inline-block">
            <LockClosedIcon className="w-8 h-8 sm:w-10 sm:h-10 text-primary" />
          </div>
          <h1 className="text-xl sm:text-2xl font-bold text-gradient">
            Alarmpaneel
          </h1>
          <p className="text-white/40 text-xs sm:text-sm">
            Voer je gegevens in om verder te gaan
          </p>
        </div>

        <div className="space-y-4">
          <div className="relative">
            <UserIcon className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-white/30" />
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
              className="w-full bg-white/5 border border-white/10 rounded-xl py-3 pl-10 pr-4 text-white
                       outline-none focus:border-primary transition-colors text-base"
            />
          </div>

          <div className="space-y-3">
            <div
              className="flex justify-center gap-2 sm:gap-3 cursor-pointer"
              onClick={() => inputRef.current?.focus()}
            >
              {Array.from({ length: PIN_LENGTH }).map((_, i) => {
                const filled = i < pin.length
                const active = i === pin.length
                return (
                  <div
                    key={i}
                    className={`pin-digit ${filled ? "pin-digit-filled" : ""} ${active ? "pin-digit-active" : ""} cursor-pointer`}
                  >
                    {filled ? "\u2022" : ""}
                  </div>
                )
              })}
            </div>

            <input
              ref={inputRef}
              type="number"
              inputMode="numeric"
              pattern="[0-9]*"
              maxLength={PIN_LENGTH}
              value={pin}
              onChange={e => handlePinChange(e.target.value)}
              onKeyDown={handlePinKeyDown}
              onBlur={() => setTimeout(() => inputRef.current?.focus(), 0)}
              autoComplete="off"
              autoCorrect="off"
              className="absolute opacity-0 w-0 h-0 pointer-events-none"
              aria-label="Pincode"
            />
          </div>
        </div>

        {lockoutUntil > 0 ? (
          <div className="bg-amber-500/10 border border-amber-500/20 rounded-xl p-3">
            <p className="text-amber-400 text-sm">
              Geblokkeerd &middot; Probeer opnieuw over {lockoutRemaining}s
            </p>
          </div>
        ) : error ? (
          <div className="bg-danger/10 border border-danger/20 rounded-xl p-3">
            <p className="text-danger text-sm">{error}</p>
          </div>
        ) : null}

        <button
          onClick={() => doSubmit(pinRef.current, name.trim())}
          disabled={loading || lockoutUntil > 0 || pin.length < PIN_LENGTH || !name.trim()}
          className="btn-primary w-full flex items-center justify-center space-x-2"
        >
          {loading ? (
            <svg className="animate-spin h-5 w-5" viewBox="0 0 24 24">
              <circle
                className="opacity-25"
                cx="12"
                cy="12"
                r="10"
                stroke="currentColor"
                strokeWidth="4"
                fill="none"
              />
              <path
                className="opacity-75"
                fill="currentColor"
                d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"
              />
            </svg>
          ) : (
            <span>Verifieer pincode</span>
          )}
        </button>
      </div>
    </div>
  )
}
