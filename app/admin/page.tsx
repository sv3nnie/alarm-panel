"use client"

import { useState, useEffect, useCallback } from "react"
import {
  ArrowLeftIcon,
  UsersIcon,
  KeyIcon,
  ClockIcon,
  DocumentTextIcon,
  ShieldExclamationIcon,
  ChartBarIcon,
  TrashIcon,
  XCircleIcon,
  CheckCircleIcon,
  ExclamationTriangleIcon
} from "@heroicons/react/24/outline"
import * as api from "../helpers/api"
import type {
  AdminUser,
  AdminSession,
  AuditLogEntry,
  RateLimitEntry,
  AdminStats
} from "../helpers/api"

type Tab = "stats" | "users" | "sessions" | "logs" | "ratelimits"

const TABS: { key: Tab; label: string; icon: React.ElementType }[] = [
  { key: "stats", label: "Overzicht", icon: ChartBarIcon },
  { key: "users", label: "Gebruikers", icon: UsersIcon },
  { key: "sessions", label: "Sessies", icon: ClockIcon },
  { key: "logs", label: "Logboek", icon: DocumentTextIcon },
  { key: "ratelimits", label: "Blokkades", icon: ShieldExclamationIcon }
]

function getToken(): string {
  if (typeof window === "undefined") return ""
  const stored = localStorage.getItem("alarm_session")
  if (!stored) return ""
  try {
    const session = JSON.parse(stored)
    if (new Date(session.expires_at).getTime() > Date.now()) {
      return session.token
    }
  } catch {}
  return ""
}

function getUser(): { name: string; role: string } | null {
  if (typeof window === "undefined") return null
  const stored = localStorage.getItem("alarm_session")
  if (!stored) return null
  try {
    const session = JSON.parse(stored)
    if (new Date(session.expires_at).getTime() > Date.now() && session.user.role === "admin") {
      return session.user
    }
  } catch {}
  return null
}

export default function AdminPage() {
  const [tab, setTab] = useState<Tab>("stats")
  const [user, setUser] = useState<{ name: string; role: string } | null>(null)
  const [token, setToken] = useState("")
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const t = getToken()
    const u = getUser()
    if (!t || !u) {
      window.location.href = "/"
      return
    }
    setToken(t)
    setUser(u)
    setLoading(false)
  }, [])

  if (loading) {
    return (
      <div className="flex-1 flex items-center justify-center">
        <div className="animate-spin h-8 w-8 border-2 border-primary border-t-transparent rounded-full" />
      </div>
    )
  }

  if (!user) return null

  return (
    <div className="min-h-dvh flex flex-col safe-bottom">
      <header className="flex items-center justify-between px-5 py-4 border-b border-slate-200 bg-white shrink-0">
        <div className="flex items-center gap-3">
          <a href="/" className="text-slate-400 hover:text-slate-600 transition-colors" aria-label="Terug">
            <ArrowLeftIcon className="w-5 h-5" />
          </a>
          <h1 className="text-lg font-semibold text-slate-900">Beheer</h1>
        </div>
        <span className="text-slate-500 text-sm">{user.name}</span>
      </header>

      <div className="flex-1 flex flex-col min-h-0 max-w-5xl w-full mx-auto p-4 sm:p-6 space-y-4">
        <div className="flex gap-1 border-b border-slate-200 overflow-x-auto shrink-0">
          {TABS.map(({ key, label, icon: Icon }) => (
            <button
              key={key}
              onClick={() => setTab(key)}
              className={`flex items-center gap-1.5 px-3.5 py-2.5 text-sm font-medium whitespace-nowrap border-b-2 -mb-px transition-colors ${
                tab === key
                  ? "border-primary text-primary"
                  : "border-transparent text-slate-500 hover:text-slate-800"
              }`}
            >
              <Icon className="w-4 h-4" />
              <span>{label}</span>
            </button>
          ))}
        </div>

        <div className="flex-1 min-h-0 overflow-y-auto">
          {tab === "stats" && <StatsPanel token={token} />}
          {tab === "users" && <UsersPanel token={token} />}
          {tab === "sessions" && <SessionsPanel token={token} />}
          {tab === "logs" && <AuditLogsPanel token={token} />}
          {tab === "ratelimits" && <RateLimitsPanel token={token} />}
        </div>
      </div>
    </div>
  )
}

// --- Stats Panel ---

function StatsPanel({ token }: { token: string }) {
  const [stats, setStats] = useState<AdminStats | null>(null)

  useEffect(() => {
    api.getAdminStats(token).then(setStats).catch(() => {})
  }, [token])

  if (!stats) return <Loading />

  const cards = [
    { label: "Gebruikers", value: stats.total_users, icon: UsersIcon },
    { label: "Actieve sessies", value: stats.active_sessions, icon: ClockIcon },
    { label: "Acties (24u)", value: stats.actions_24h, icon: ChartBarIcon },
    { label: "Mislukt (24u)", value: stats.failed_attempts_24h, icon: ExclamationTriangleIcon },
    { label: "Geblokkeerd", value: stats.active_lockouts, icon: ShieldExclamationIcon }
  ]

  return (
    <div className="grid grid-cols-2 sm:grid-cols-5 gap-3">
      {cards.map(({ label, value, icon: Icon }) => (
        <div key={label} className="card p-4">
          <Icon className="w-5 h-5 text-primary mb-2" />
          <div className="text-2xl font-bold text-slate-900">{value}</div>
          <div className="text-slate-500 text-xs mt-0.5">{label}</div>
        </div>
      ))}
    </div>
  )
}

// --- Users Panel ---

function UsersPanel({ token }: { token: string }) {
  const [users, setUsers] = useState<AdminUser[]>([])
  const [showAdd, setShowAdd] = useState(false)
  const [error, setError] = useState("")

  const fetchUsers = useCallback(() => {
    api.getAdminUsers(token).then(d => setUsers(d.users)).catch(() => {})
  }, [token])

  useEffect(() => { fetchUsers() }, [fetchUsers])

  return (
    <div className="space-y-4">
      <div className="flex justify-between items-center">
        <h2 className="text-slate-900 text-sm font-semibold">Gebruikers</h2>
        <button onClick={() => setShowAdd(!showAdd)} className="btn-primary text-xs py-1.5 px-4">
          {showAdd ? "Annuleren" : "Toevoegen"}
        </button>
      </div>

      {showAdd && (
        <AddUserForm token={token} onDone={() => { setShowAdd(false); fetchUsers() }} />
      )}

      {error && <p className="text-danger text-sm">{error}</p>}

      <div className="card divide-y divide-slate-100">
        {users.map(u => (
          <div key={u.id} className="p-3.5 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <span className="text-slate-900 text-sm font-medium">{u.name}</span>
              <span className={`badge ${u.role === "admin" ? "badge-primary" : "badge-neutral"}`}>
                {u.role}
              </span>
            </div>
            <div className="flex items-center gap-3">
              <UserActions token={token} user={u} onDone={fetchUsers} />
            </div>
          </div>
        ))}
        {users.length === 0 && (
          <p className="text-slate-400 text-sm text-center py-6">Geen gebruikers</p>
        )}
      </div>
    </div>
  )
}

function AddUserForm({
  token,
  onDone
}: {
  token: string
  onDone: () => void
}) {
  const [name, setName] = useState("")
  const [pin, setPin] = useState("")
  const [role, setRole] = useState("user")
  const [error, setError] = useState("")
  const [loading, setLoading] = useState(false)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)
    try {
      await api.createUser(token, name, pin, role)
      onDone()
    } catch (err: any) {
      setError(err.message)
    }
    setLoading(false)
  }

  return (
    <form onSubmit={handleSubmit} className="card p-4 space-y-3">
      <div className="grid grid-cols-1 sm:grid-cols-4 gap-3">
          <input
            value={name}
            onChange={e => setName(e.target.value)}
            placeholder="Naam"
          className="bg-slate-50 border border-slate-200 rounded-lg px-3 py-2 text-slate-900 text-sm outline-none focus:border-primary focus:ring-2 focus:ring-primary/20"
          required
        />
          <input
            type="number"
            inputMode="numeric"
            pattern="[0-9]*"
            value={pin}
            onChange={e => setPin(e.target.value.slice(0, 8))}
            placeholder="Pincode (4-8 cijfers)"
          className="bg-slate-50 border border-slate-200 rounded-lg px-3 py-2 text-slate-900 text-sm outline-none focus:border-primary focus:ring-2 focus:ring-primary/20"
          required
        />
        <select
          value={role}
          onChange={e => setRole(e.target.value)}
          className="bg-slate-50 border border-slate-200 rounded-lg px-3 py-2 text-slate-900 text-sm outline-none focus:border-primary focus:ring-2 focus:ring-primary/20"
        >
          <option value="user">Gebruiker</option>
          <option value="admin">Beheerder</option>
          <option value="guest">Gast</option>
        </select>
        <button type="submit" disabled={loading} className="btn-primary text-xs py-1.5">
          Aanmaken
        </button>
      </div>
      {error && <p className="text-danger text-xs">{error}</p>}
    </form>
  )
}

function UserActions({
  token,
  user,
  onDone
}: {
  token: string
  user: AdminUser
  onDone: () => void
}) {
  const [mode, setMode] = useState<"none" | "pin" | "role" | "delete">("none")
  const [value, setValue] = useState("")
  const [error, setError] = useState("")

  const handleAction = async () => {
    try {
      if (mode === "pin") await api.setUserPin(token, user.id, value)
      if (mode === "role") await api.setUserRole(token, user.id, value)
      if (mode === "delete") await api.deleteUser(token, user.id)
      setMode("none")
      onDone()
    } catch (err: any) {
      setError(err.message)
    }
  }

  if (mode !== "none") {
    return (
      <div className="flex items-center gap-1.5">
        {mode === "pin" && (
          <input
            type="number"
            inputMode="numeric"
            pattern="[0-9]*"
            placeholder="Nieuwe pincode"
            value={value}
            onChange={e => setValue(e.target.value.slice(0, 8))}
            className="bg-slate-50 border border-slate-200 rounded-lg px-2 py-1 text-slate-900 text-xs w-24 outline-none focus:border-primary"
          />
        )}
        {mode === "role" && (
          <select
            value={value}
            onChange={e => setValue(e.target.value)}
            className="bg-slate-50 border border-slate-200 rounded-lg px-2 py-1 text-slate-900 text-xs outline-none focus:border-primary"
          >
            <option value="">Kies...</option>
            <option value="admin">Beheerder</option>
            <option value="user">Gebruiker</option>
            <option value="guest">Gast</option>
          </select>
        )}
        {mode === "delete" && (
          <span className="text-slate-500 text-xs">Weet je het zeker?</span>
        )}
        <button onClick={handleAction} className="text-success hover:text-success-dark text-xs font-medium px-1">
          OK
        </button>
        <button onClick={() => setMode("none")} className="text-slate-400 hover:text-slate-600 text-xs px-1">
          Annuleren
        </button>
        {error && <span className="text-danger text-xs">{error}</span>}
      </div>
    )
  }

  return (
    <div className="flex items-center gap-3">
      <button onClick={() => setMode("pin")} className="text-slate-400 hover:text-primary transition-colors" aria-label="Pincode wijzigen">
        <KeyIcon className="w-4 h-4" />
      </button>
      <button onClick={() => setMode("role")} className="text-slate-400 hover:text-primary transition-colors" aria-label="Rol wijzigen">
        <UsersIcon className="w-4 h-4" />
      </button>
      <button onClick={() => setMode("delete")} className="text-slate-400 hover:text-danger transition-colors" aria-label="Verwijderen">
        <TrashIcon className="w-4 h-4" />
      </button>
    </div>
  )
}

// --- Sessions Panel ---

function SessionsPanel({ token }: { token: string }) {
  const [sessions, setSessions] = useState<AdminSession[]>([])

  const fetch = useCallback(() => {
    api.getAdminSessions(token).then(d => setSessions(d.sessions)).catch(() => {})
  }, [token])

  useEffect(() => { fetch() }, [fetch])

  return (
    <div className="space-y-4">
      <h2 className="text-slate-900 text-sm font-semibold">Actieve sessies</h2>
      <div className="card divide-y divide-slate-100">
        {sessions.map(s => (
          <div key={s.jwt_id} className="p-3.5 flex items-center justify-between text-sm">
            <div className="flex flex-col sm:flex-row sm:items-center gap-1 sm:gap-3">
              <span className="text-slate-900 font-medium">{s.user_name}</span>
              <span className="text-slate-400 text-xs font-mono">{s.ip || "—"}</span>
              <span className="text-slate-400 text-xs">
                Verloopt om {new Date(s.expires_at).toLocaleTimeString()}
              </span>
            </div>
            <button
              onClick={async () => { await api.invalidateSession(token, s.jwt_id); fetch() }}
              className="text-slate-400 hover:text-danger transition-colors"
              aria-label="Sessie beëindigen"
            >
              <XCircleIcon className="w-4 h-4" />
            </button>
          </div>
        ))}
        {sessions.length === 0 && (
          <p className="text-slate-400 text-sm text-center py-6">Geen actieve sessies</p>
        )}
      </div>
    </div>
  )
}

// --- Audit Logs Panel ---

function AuditLogsPanel({ token }: { token: string }) {
  const [logs, setLogs] = useState<AuditLogEntry[]>([])
  const [total, setTotal] = useState(0)
  const [offset, setOffset] = useState(0)
  const [filterSuccess, setFilterSuccess] = useState<number | undefined>(undefined)

  const doFetch = (newOffset: number, filter?: number) => {
    api
      .getAuditLogs(token, {
        limit: 30,
        offset: newOffset,
        success: filter
      })
      .then(d => {
        setLogs(d.logs)
        setTotal(d.total)
        setOffset(d.offset)
      })
      .catch(() => {})
  }

  useEffect(() => { doFetch(0, undefined) }, [token])

  return (
    <div className="flex flex-col min-h-0 h-full space-y-3">
      <div className="flex items-center justify-between shrink-0">
        <h2 className="text-slate-900 text-sm font-semibold">
          Logboek ({total})
        </h2>
        <select
          value={filterSuccess === undefined ? "" : String(filterSuccess)}
          onChange={e => {
            const v = e.target.value === "" ? undefined : Number(e.target.value)
            setFilterSuccess(v)
            setOffset(0)
            doFetch(0, v)
          }}
          className="bg-slate-50 border border-slate-200 rounded-lg px-2 py-1.5 text-slate-900 text-xs outline-none focus:border-primary"
        >
          <option value="">Alles</option>
          <option value="1">Gelukt</option>
          <option value="0">Mislukt</option>
        </select>
      </div>

      <div className="card divide-y divide-slate-100 flex-1 min-h-0 overflow-y-auto">
        {logs.map(log => (
          <div
            key={log.id}
            className={`p-2.5 text-xs flex items-center justify-between gap-2 ${
              log.success ? "" : "bg-danger/5"
            }`}
          >
            <div className="flex flex-col sm:flex-row sm:items-center gap-1 sm:gap-3 min-w-0">
              <span className="text-slate-400 font-mono shrink-0">
                {new Date(log.timestamp).toLocaleString()}
              </span>
              <span className="text-slate-900 font-medium">{log.user_name || "—"}</span>
              <span className="text-slate-500">{log.action}</span>
              <span className="text-slate-400">{log.ip}</span>
            </div>
            <span className={`badge shrink-0 py-0.5 px-2 ${log.success ? "badge-success" : "badge-danger"}`}>
              {log.success ? (
                <CheckCircleIcon className="w-3.5 h-3.5" />
              ) : (
                <XCircleIcon className="w-3.5 h-3.5" />
              )}
              {log.success ? "OK" : "FAIL"}
            </span>
          </div>
        ))}
        {logs.length === 0 && (
          <p className="text-slate-400 text-sm text-center py-6">Geen logboekvermeldingen</p>
        )}
      </div>

      <div className="flex justify-between items-center shrink-0">
        <button
          onClick={() => doFetch(Math.max(0, offset - 30), filterSuccess)}
          disabled={offset === 0}
          className="text-slate-500 hover:text-slate-900 text-xs font-medium disabled:opacity-30 disabled:pointer-events-none"
        >
          Vorige
        </button>
        <span className="text-slate-400 text-xs">
          {offset + 1}–{Math.min(offset + 30, total)} van {total}
        </span>
        <button
          onClick={() => doFetch(offset + 30, filterSuccess)}
          disabled={offset + 30 >= total}
          className="text-slate-500 hover:text-slate-900 text-xs font-medium disabled:opacity-30 disabled:pointer-events-none"
        >
          Volgende
        </button>
      </div>
    </div>
  )
}

// --- Rate Limits Panel ---

function RateLimitsPanel({ token }: { token: string }) {
  const [limits, setLimits] = useState<RateLimitEntry[]>([])

  const fetch = useCallback(() => {
    api.getRateLimits(token).then(d => setLimits(d.limits)).catch(() => {})
  }, [token])

  useEffect(() => { fetch() }, [fetch])

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="text-slate-900 text-sm font-semibold">Blokkades</h2>
        <button
          onClick={async () => { await api.clearRateLimits(token); fetch() }}
          className="text-slate-500 hover:text-danger text-xs font-medium transition-colors"
        >
          Alles wissen
        </button>
      </div>
      <div className="card divide-y divide-slate-100">
        {limits.map(l => (
          <div key={l.id} className="p-3.5 flex items-center justify-between text-sm">
            <div className="flex flex-wrap items-center gap-3">
              <span className="text-slate-900 font-mono text-xs">{l.key}</span>
              <span className="badge badge-neutral">{l.type}</span>
              <span className="text-slate-400 text-xs">{l.attempts} pogingen</span>
              {l.locked_until && new Date(l.locked_until) > new Date() && (
                <span className="badge bg-amber-50 text-amber-700">
                  Geblokkeerd {Math.ceil((new Date(l.locked_until).getTime() - Date.now()) / 1000)}s
                </span>
              )}
            </div>
            <button
              onClick={async () => { await api.clearRateLimits(token, l.key); fetch() }}
              className="text-slate-400 hover:text-danger transition-colors"
              aria-label="Blokkade opheffen"
            >
              <XCircleIcon className="w-4 h-4" />
            </button>
          </div>
        ))}
        {limits.length === 0 && (
          <p className="text-slate-400 text-sm text-center py-6">Geen blokkades</p>
        )}
      </div>
    </div>
  )
}

// --- Shared ---

function Loading() {
  return (
    <div className="flex justify-center py-8">
      <div className="animate-spin h-6 w-6 border-2 border-primary border-t-transparent rounded-full" />
    </div>
  )
}
