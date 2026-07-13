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
  XCircleIcon
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
  { key: "stats", label: "Stats", icon: ChartBarIcon },
  { key: "users", label: "Users", icon: UsersIcon },
  { key: "sessions", label: "Sessions", icon: ClockIcon },
  { key: "logs", label: "Audit Logs", icon: DocumentTextIcon },
  { key: "ratelimits", label: "Rate Limits", icon: ShieldExclamationIcon }
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
    <div className="flex-1 p-4 sm:p-6 safe-bottom">
      <div className="glass-card max-w-5xl mx-auto space-y-6">
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-3">
            <a href="/" className="text-white/40 hover:text-white/60 transition-colors">
              <ArrowLeftIcon className="w-5 h-5" />
            </a>
            <h1 className="text-xl sm:text-2xl font-bold text-gradient">Admin</h1>
          </div>
          <span className="text-white/40 text-sm">{user.name}</span>
        </div>

        {/* Tabs */}
        <div className="flex space-x-1 bg-white/5 rounded-xl p-1 overflow-x-auto">
          {TABS.map(({ key, label, icon: Icon }) => (
            <button
              key={key}
              onClick={() => setTab(key)}
              className={`flex items-center space-x-1.5 px-3 py-2 rounded-lg text-sm whitespace-nowrap transition-colors ${
                tab === key ? "bg-primary text-white" : "text-white/50 hover:text-white/80"
              }`}
            >
              <Icon className="w-4 h-4" />
              <span className="hidden sm:inline">{label}</span>
            </button>
          ))}
        </div>

        {tab === "stats" && <StatsPanel token={token} />}
        {tab === "users" && <UsersPanel token={token} />}
        {tab === "sessions" && <SessionsPanel token={token} />}
        {tab === "logs" && <AuditLogsPanel token={token} />}
        {tab === "ratelimits" && <RateLimitsPanel token={token} />}
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

  return (
    <div className="grid grid-cols-2 sm:grid-cols-5 gap-3">
      {[
        { label: "Total Users", value: stats.total_users },
        { label: "Active Sessions", value: stats.active_sessions },
        { label: "Actions (24h)", value: stats.actions_24h },
        { label: "Failed Attempts", value: stats.failed_attempts_24h },
        { label: "Locked IPs", value: stats.active_lockouts }
      ].map(({ label, value }) => (
        <div key={label} className="bg-white/5 rounded-xl p-4 text-center">
          <div className="text-2xl font-bold text-primary">{value}</div>
          <div className="text-white/40 text-xs mt-1">{label}</div>
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
        <h2 className="text-white/60 text-sm font-semibold">Users</h2>
        <button onClick={() => setShowAdd(!showAdd)} className="btn-primary text-xs py-1.5 px-4">
          {showAdd ? "Cancel" : "Add User"}
        </button>
      </div>

      {showAdd && (
        <AddUserForm token={token} onDone={() => { setShowAdd(false); fetchUsers() }} />
      )}

      {error && <p className="text-danger text-sm">{error}</p>}

      <div className="space-y-2">
        {users.map(u => (
          <div key={u.id} className="bg-white/5 rounded-xl p-3 flex items-center justify-between">
            <div>
              <span className="text-white text-sm font-medium">{u.name}</span>
              <span className="text-white/30 text-xs ml-2">{u.role}</span>
            </div>
            <div className="flex space-x-2">
              <UserActions token={token} user={u} onDone={fetchUsers} />
            </div>
          </div>
        ))}
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
    <form onSubmit={handleSubmit} className="bg-white/5 rounded-xl p-4 space-y-3">
      <div className="grid grid-cols-1 sm:grid-cols-4 gap-3">
        <input
          value={name}
          onChange={e => setName(e.target.value)}
          placeholder="Name"
          className="bg-white/10 border border-white/10 rounded-lg px-3 py-2 text-white text-sm outline-none focus:border-primary"
          required
        />
        <input
          type="number"
          inputMode="numeric"
          pattern="[0-9]*"
          value={pin}
          onChange={e => setPin(e.target.value.slice(0, 8))}
          placeholder="PIN (4-8 digits)"
          className="bg-white/10 border border-white/10 rounded-lg px-3 py-2 text-white text-sm outline-none focus:border-primary"
          required
        />
        <select
          value={role}
          onChange={e => setRole(e.target.value)}
          className="bg-white/10 border border-white/10 rounded-lg px-3 py-2 text-white text-sm outline-none focus:border-primary"
        >
          <option value="user">User</option>
          <option value="admin">Admin</option>
          <option value="guest">Guest</option>
        </select>
        <button type="submit" disabled={loading} className="btn-primary text-xs py-1.5">
          Create
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
      <div className="flex items-center space-x-1">
        {mode === "pin" && (
          <input
            type="number"
            inputMode="numeric"
            pattern="[0-9]*"
            placeholder="New PIN"
            value={value}
            onChange={e => setValue(e.target.value.slice(0, 8))}
            className="bg-white/10 border border-white/10 rounded-lg px-2 py-1 text-white text-xs w-20 outline-none focus:border-primary"
          />
        )}
        {mode === "role" && (
          <select
            value={value}
            onChange={e => setValue(e.target.value)}
            className="bg-white/10 border border-white/10 rounded-lg px-2 py-1 text-white text-xs outline-none focus:border-primary"
          >
            <option value="">Select...</option>
            <option value="admin">Admin</option>
            <option value="user">User</option>
            <option value="guest">Guest</option>
          </select>
        )}
        <button onClick={handleAction} className="text-success text-xs px-1">OK</button>
        <button onClick={() => setMode("none")} className="text-white/30 text-xs px-1">✕</button>
        {error && <span className="text-danger text-xs">{error}</span>}
      </div>
    )
  }

  return (
    <>
      <button onClick={() => setMode("pin")} className="text-white/40 hover:text-primary text-xs transition-colors">
        <KeyIcon className="w-4 h-4" />
      </button>
      <button onClick={() => setMode("role")} className="text-white/40 hover:text-primary text-xs transition-colors">
        <UsersIcon className="w-4 h-4" />
      </button>
      <button onClick={() => setMode("delete")} className="text-white/40 hover:text-danger text-xs transition-colors">
        <TrashIcon className="w-4 h-4" />
      </button>
    </>
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
    <div className="space-y-2">
      <h2 className="text-white/60 text-sm font-semibold">Active Sessions</h2>
      {sessions.map(s => (
        <div key={s.jwt_id} className="bg-white/5 rounded-xl p-3 flex items-center justify-between text-sm">
          <div className="flex items-center space-x-3">
            <span className="text-white">{s.user_name}</span>
            <span className="text-white/30 text-xs">{s.ip || "—"}</span>
            <span className="text-white/20 text-xs">
              Expires {new Date(s.expires_at).toLocaleTimeString()}
            </span>
          </div>
          <button
            onClick={async () => { await api.invalidateSession(token, s.jwt_id); fetch() }}
            className="text-white/30 hover:text-danger transition-colors"
          >
            <XCircleIcon className="w-4 h-4" />
          </button>
        </div>
      ))}
      {sessions.length === 0 && (
        <p className="text-white/30 text-sm text-center py-4">No active sessions</p>
      )}
    </div>
  )
}

// --- Audit Logs Panel ---

function AuditLogsPanel({ token }: { token: string }) {
  const [logs, setLogs] = useState<AuditLogEntry[]>([])
  const [total, setTotal] = useState(0)
  const [offset, setOffset] = useState(0)
  const [filterSuccess, setFilterSuccess] = useState<number | undefined>(undefined)

  const fetch = useCallback(
    (newOffset?: number) => {
      api
        .getAuditLogs(token, {
          limit: 30,
          offset: newOffset ?? offset,
          success: filterSuccess
        })
        .then(d => {
          setLogs(d.logs)
          setTotal(d.total)
          setOffset(d.offset)
        })
        .catch(() => {})
    },
    [token, offset, filterSuccess]
  )

  useEffect(() => { fetch() }, [token])

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="text-white/60 text-sm font-semibold">
          Audit Logs ({total})
        </h2>
        <div className="flex space-x-2">
          <select
            value={filterSuccess === undefined ? "" : String(filterSuccess)}
            onChange={e => {
              const v = e.target.value === "" ? undefined : Number(e.target.value)
              setFilterSuccess(v)
              setOffset(0)
              setTimeout(() => fetch(0), 0)
            }}
            className="bg-white/10 border border-white/10 rounded-lg px-2 py-1 text-white text-xs outline-none focus:border-primary"
          >
            <option value="">All</option>
            <option value="1">Success</option>
            <option value="0">Failed</option>
          </select>
        </div>
      </div>

      <div className="space-y-1 max-h-96 overflow-y-auto">
        {logs.map(log => (
          <div
            key={log.id}
            className={`bg-white/5 rounded-lg p-2 text-xs flex items-center justify-between ${
              log.success ? "" : "border-l-2 border-danger"
            }`}
          >
            <div className="flex flex-col sm:flex-row sm:items-center sm:space-x-3">
              <span className="text-white/50 font-mono">
                {new Date(log.timestamp).toLocaleString()}
              </span>
              <span className="text-white">{log.user_name || "—"}</span>
              <span className="text-white/30">{log.action}</span>
              <span className="text-white/20">{log.ip}</span>
            </div>
            <span className={log.success ? "text-success" : "text-danger"}>
              {log.success ? "OK" : "FAIL"}
            </span>
          </div>
        ))}
      </div>

      <div className="flex justify-between">
        <button
          onClick={() => fetch(Math.max(0, offset - 30))}
          disabled={offset === 0}
          className="text-white/40 hover:text-white text-xs disabled:opacity-20"
        >
          Previous
        </button>
        <span className="text-white/30 text-xs">
          {offset + 1}–{Math.min(offset + 30, total)} of {total}
        </span>
        <button
          onClick={() => fetch(offset + 30)}
          disabled={offset + 30 >= total}
          className="text-white/40 hover:text-white text-xs disabled:opacity-20"
        >
          Next
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
    <div className="space-y-2">
      <div className="flex items-center justify-between">
        <h2 className="text-white/60 text-sm font-semibold">Rate Limits</h2>
        <button
          onClick={async () => { await api.clearRateLimits(token); fetch() }}
          className="text-white/30 hover:text-danger text-xs transition-colors"
        >
          Clear all
        </button>
      </div>
      {limits.map(l => (
        <div key={l.id} className="bg-white/5 rounded-xl p-3 flex items-center justify-between text-sm">
          <div className="flex items-center space-x-3">
            <span className="text-white font-mono text-xs">{l.key}</span>
            <span className="text-white/30 text-xs">{l.type}</span>
            <span className="text-white/20 text-xs">{l.attempts} attempts</span>
            {l.locked_until && new Date(l.locked_until) > new Date() && (
              <span className="text-amber-400 text-xs">
                Locked {Math.ceil((new Date(l.locked_until).getTime() - Date.now()) / 1000)}s
              </span>
            )}
          </div>
          <button
            onClick={async () => { await api.clearRateLimits(token, l.key); fetch() }}
            className="text-white/30 hover:text-danger transition-colors"
          >
            <XCircleIcon className="w-4 h-4" />
          </button>
        </div>
      ))}
      {limits.length === 0 && (
        <p className="text-white/30 text-sm text-center py-4">No rate limits active</p>
      )}
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
