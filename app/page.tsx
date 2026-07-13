"use client"

import { useState, useEffect, useCallback, useRef } from "react"
import { ShieldCheckIcon, ShieldExclamationIcon, ArrowRightOnRectangleIcon, LockClosedIcon, UserIcon } from "@heroicons/react/24/outline"
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

export default function Home() {
  const [session, setSession] = useState<Session | null>(null)
  const [alarm, setAlarm] = useState<AlarmState>({ armed: false, loading: true, actionInProgress: false })
  const [error, setError] = useState<string | null>(null)
  const eventSourceRef = useRef<EventSource | null>(null)

  // Polling fallback
  const pollAlarmState = useCallback(async () => {
    try {
      const data = await api.getAlarmStatus()
      setAlarm(prev => ({ ...prev, armed: data.armed, loading: false }))
    } catch {
      setAlarm(prev => ({ ...prev, loading: false }))
    }
  }, [])

  // SSE connection for real-time sync
  useEffect(() => {
    pollAlarmState()

    const es = api.createSSEConnection((armed) => {
      setAlarm(prev => ({ ...prev, armed, loading: false }))
    })

    eventSourceRef.current = es

    // Fallback polling every 10s if SSE drops
    const pollInterval = setInterval(pollAlarmState, 10000)

    return () => {
      es.close()
      clearInterval(pollInterval)
    }
  }, [pollAlarmState])

  // On new session, re-poll
  useEffect(() => {
    if (session) {
      pollAlarmState()
    }
  }, [session, pollAlarmState])

  // Session timeout check
  useEffect(() => {
    if (!session) return

    const expiresAt = new Date(session.expires_at).getTime()
    const now = Date.now()
    const timeout = expiresAt - now

    if (timeout <= 0) {
      setSession(null)
      setError("Session expired. Please enter your PIN again.")
      return
    }

    const timer = setTimeout(() => {
      setSession(null)
      setError("Session expired. Please enter your PIN again.")
    }, timeout)

    return () => clearTimeout(timer)
  }, [session])

  const handleLogout = () => {
    if (eventSourceRef.current) {
      eventSourceRef.current.close()
    }
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
        setError("Session expired. Please sign in again.")
      } else {
        setError(err.message || "Failed to arm alarm")
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
        setError("Session expired. Please sign in again.")
      } else {
        setError(err.message || "Failed to disarm alarm")
      }
      setAlarm(prev => ({ ...prev, actionInProgress: false }))
    }
  }

  if (!session) {
    return <PinEntry onAuthenticated={setSession} initialError={error} />
  }

  const timeRemaining = session.expires_at
    ? Math.max(0, Math.floor((new Date(session.expires_at).getTime() - Date.now()) / 60000))
    : 0

  return (
    <div className="flex-1 flex flex-col items-center justify-center p-6">
      {/* Header */}
      <div className="glass-card max-w-md w-full text-center space-y-8">
        <div className="space-y-2">
          <h1 className="text-2xl font-bold text-gradient">Alarm Panel</h1>
          <p className="text-white/40 text-sm">
            Signed in as {session.user.name} · Session expires in {timeRemaining}m
          </p>
        </div>

        {/* Status indicator */}
        <div className="flex flex-col items-center space-y-4">
          <div className={`p-6 rounded-full ${alarm.armed ? "bg-danger/10" : "bg-success/10"}`}>
            {alarm.armed ? (
              <ShieldExclamationIcon className="w-16 h-16 text-danger animate-pulse" />
            ) : (
              <ShieldCheckIcon className="w-16 h-16 text-success" />
            )}
          </div>

          <div className="flex items-center space-x-2">
            <div className={`status-dot ${alarm.armed ? "status-dot-armed" : "status-dot-disarmed"}`} />
            <span className={`text-xl font-semibold ${alarm.armed ? "text-danger" : "text-success"}`}>
              {alarm.armed ? "ARMED" : "DISARMED"}
            </span>
          </div>
        </div>

        {/* Action buttons */}
        <div className="flex space-x-4 justify-center">
          {!alarm.armed ? (
            <button
              onClick={handleArm}
              disabled={alarm.actionInProgress}
              className="btn-danger flex items-center space-x-2 text-lg"
            >
              <LockClosedIcon className="w-5 h-5" />
              <span>{alarm.actionInProgress ? "Arming..." : "Arm Alarm"}</span>
            </button>
          ) : (
            <button
              onClick={handleDisarm}
              disabled={alarm.actionInProgress}
              className="btn-success flex items-center space-x-2 text-lg"
            >
              <LockClosedIcon className="w-5 h-5" />
              <span>{alarm.actionInProgress ? "Disarming..." : "Disarm Alarm"}</span>
            </button>
          )}
        </div>

        {/* Error display */}
        {error && (
          <div className="bg-danger/10 border border-danger/20 rounded-xl p-3">
            <p className="text-danger text-sm">{error}</p>
          </div>
        )}

        {/* Logout */}
        <button
          onClick={handleLogout}
          className="text-white/30 hover:text-white/60 text-sm flex items-center space-x-1 mx-auto transition-colors"
        >
          <ArrowRightOnRectangleIcon className="w-4 h-4" />
          <span>Sign out</span>
        </button>
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

  useEffect(() => {
    const interval = setInterval(() => {
      if (lockoutUntil > 0 && Date.now() >= lockoutUntil) {
        setLockoutUntil(0)
        setError(null)
      }
    }, 1000)
    return () => clearInterval(interval)
  }, [lockoutUntil])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (loading || lockoutUntil > 0) return

    if (!name.trim()) {
      setError("Please enter your name")
      return
    }

    if (pin.length < 4) {
      setError("Please enter your PIN (4-8 digits)")
      return
    }

    setLoading(true)
    setError(null)

    try {
      const data = await api.verifyPin(name.trim(), pin)
      onAuthenticated({
        token: data.token,
        user: data.user,
        expires_at: data.expires_at
      })
    } catch (err: any) {
      const msg = err.message || "Verification failed"
      setError(msg)

      if (msg.includes("Too many")) {
        const match = msg.match(/(\d+)\s*seconds/)
        if (match) {
          setLockoutUntil(Date.now() + parseInt(match[1]) * 1000)
        }
      }

      setPin("")
    } finally {
      setLoading(false)
    }
  }

  const lockoutRemaining = lockoutUntil > 0
    ? Math.max(0, Math.ceil((lockoutUntil - Date.now()) / 1000))
    : 0

  return (
    <div className="flex-1 flex flex-col items-center justify-center p-6">
      <div className="glass-card max-w-sm w-full text-center space-y-6">
        <div className="space-y-2">
          <div className="bg-white/5 p-4 rounded-full inline-block">
            <LockClosedIcon className="w-10 h-10 text-primary" />
          </div>
          <h1 className="text-2xl font-bold text-gradient">Alarm Panel</h1>
          <p className="text-white/40 text-sm">Enter your credentials to continue</p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <div className="relative">
              <UserIcon className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-white/30" />
              <input
                type="text"
                value={name}
                onChange={e => setName(e.target.value)}
                placeholder="Name"
                className="w-full bg-white/5 border border-white/10 rounded-xl py-3 pl-10 pr-4 text-white
                         outline-none focus:border-primary transition-colors"
                autoFocus
              />
            </div>

            <input
              type="password"
              inputMode="numeric"
              pattern="[0-9]*"
              maxLength={8}
              value={pin}
              onChange={e => setPin(e.target.value.replace(/\D/g, "").slice(0, 8))}
              placeholder="PIN"
              className="w-full bg-white/5 border border-white/10 rounded-xl py-3 px-4 text-white
                       text-center text-2xl tracking-[0.5em] font-mono
                       outline-none focus:border-primary transition-colors"
            />
          </div>

          {lockoutUntil > 0 ? (
            <div className="bg-amber-500/10 border border-amber-500/20 rounded-xl p-3">
              <p className="text-amber-400 text-sm">
                Locked out · Try again in {lockoutRemaining}s
              </p>
            </div>
          ) : error ? (
            <div className="bg-danger/10 border border-danger/20 rounded-xl p-3">
              <p className="text-danger text-sm">{error}</p>
            </div>
          ) : null}

          <button
            type="submit"
            disabled={loading || lockoutUntil > 0}
            className="btn-primary w-full flex items-center justify-center space-x-2"
          >
            {loading ? (
              <svg className="animate-spin h-5 w-5" viewBox="0 0 24 24">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
              </svg>
            ) : (
              <span>Verify PIN</span>
            )}
          </button>
        </form>
      </div>
    </div>
  )
}
