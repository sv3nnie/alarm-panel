const API_BASE = process.env.NEXT_PUBLIC_API_URL || "https://api.poggers.win"

interface ApiOptions {
  token?: string
}

async function request(path: string, options: RequestInit & ApiOptions = {}) {
  const { token, ...fetchOptions } = options

  const headers: Record<string, string> = {
    "Content-Type": "application/json",
    ...(fetchOptions.headers as Record<string, string> || {})
  }

  if (token) {
    headers["Authorization"] = `Bearer ${token}`
  }

  const res = await fetch(`${API_BASE}${path}`, {
    ...fetchOptions,
    headers
  })

  const data = await res.json()

  if (!res.ok) {
    throw new Error(data.error || `Request failed with status ${res.status}`)
  }

  return data
}

export async function getAlarmStatus(token: string) {
  return request("/api/alarm/status", { token })
}

export async function armAlarm(token: string) {
  return request("/api/alarm/arm", {
    method: "POST",
    token
  })
}

export async function disarmAlarm(token: string) {
  return request("/api/alarm/disarm", {
    method: "POST",
    token
  })
}

export async function verifyPin(name: string, pin: string) {
  return request("/api/auth/pin", {
    method: "POST",
    body: JSON.stringify({ name, pin })
  })
}

export type SSEStatus = "connecting" | "open" | "closed"

const SSE_RECONNECT_DELAY_MS = 5000

export function createSSEConnection(
  token: string,
  onMessage: (armed: boolean) => void,
  onStatusChange?: (status: SSEStatus) => void
) {
  let stopped = false
  let reconnectTimer: ReturnType<typeof setTimeout> | null = null
  let eventSource: EventSource | null = null

  const connect = () => {
    if (stopped) return
    onStatusChange?.("connecting")

    eventSource = new EventSource(`${API_BASE}/api/alarm/events?token=${encodeURIComponent(token)}`)

    eventSource.onopen = () => {
      onStatusChange?.("open")
    }

    eventSource.onmessage = (event) => {
      try {
        const data = JSON.parse(event.data)
        if (data.armed !== undefined) {
          onMessage(data.armed)
        }
      } catch {
        // ignore parse errors
      }
    }

    eventSource.onerror = () => {
      eventSource?.close()
      onStatusChange?.("closed")
      if (!stopped) {
        reconnectTimer = setTimeout(connect, SSE_RECONNECT_DELAY_MS)
      }
    }
  }

  connect()

  return {
    close: () => {
      stopped = true
      if (reconnectTimer) clearTimeout(reconnectTimer)
      eventSource?.close()
    }
  }
}

export { API_BASE }

// --- Admin ---

export interface AdminUser {
  id: number
  name: string
  role: string
  created_at: string
}

export interface AdminSession {
  id: number
  jwt_id: string
  user_id: number
  user_name: string
  expires_at: string
  ip: string
  user_agent: string
  created_at: string
}

export interface AuditLogEntry {
  id: number
  timestamp: string
  user_id: number | null
  user_name: string | null
  ip: string | null
  country: string | null
  user_agent: string | null
  endpoint: string | null
  action: string | null
  success: number
  old_state: string | null
  new_state: string | null
  response_time_ms: number | null
}

export interface RateLimitEntry {
  id: number
  key: string
  type: string
  attempts: number
  locked_until: string | null
}

export interface AdminStats {
  total_users: number
  active_sessions: number
  actions_24h: number
  failed_attempts_24h: number
  active_lockouts: number
}

export async function getAdminStats(token: string) {
  return request("/api/admin/stats", { token }) as Promise<AdminStats>
}

export async function getAdminUsers(token: string) {
  return request("/api/admin/users", { token }) as Promise<{ users: AdminUser[] }>
}

export async function createUser(token: string, name: string, pin: string, role: string) {
  return request("/api/admin/users", {
    method: "POST",
    token,
    body: JSON.stringify({ name, pin, role })
  })
}

export async function deleteUser(token: string, userId: number) {
  return request(`/api/admin/users/${userId}`, { method: "DELETE", token })
}

export async function setUserPin(token: string, userId: number, pin: string) {
  return request(`/api/admin/users/${userId}/pin`, {
    method: "PUT",
    token,
    body: JSON.stringify({ pin })
  })
}

export async function setUserRole(token: string, userId: number, role: string) {
  return request(`/api/admin/users/${userId}/role`, {
    method: "PUT",
    token,
    body: JSON.stringify({ role })
  })
}

export async function getAdminSessions(token: string) {
  return request("/api/admin/sessions", { token }) as Promise<{
    sessions: AdminSession[]
  }>
}

export async function invalidateSession(token: string, jwtId: string) {
  return request(`/api/admin/sessions/${jwtId}`, { method: "DELETE", token })
}

export async function getAuditLogs(
  token: string,
  params?: { limit?: number; offset?: number; user_id?: number; success?: number }
) {
  const qs = new URLSearchParams()
  if (params?.limit) qs.set("limit", String(params.limit))
  if (params?.offset) qs.set("offset", String(params.offset))
  if (params?.user_id !== undefined) qs.set("user_id", String(params.user_id))
  if (params?.success !== undefined) qs.set("success", String(params.success))
  const query = qs.toString()
  return request(`/api/admin/audit-logs${query ? `?${query}` : ""}`, { token }) as Promise<{
    logs: AuditLogEntry[]
    total: number
    limit: number
    offset: number
  }>
}

export async function getRateLimits(token: string) {
  return request("/api/admin/rate-limits", { token }) as Promise<{
    limits: RateLimitEntry[]
  }>
}

export async function clearRateLimits(token: string, key?: string) {
  const qs = key ? `?key=${encodeURIComponent(key)}` : ""
  return request(`/api/admin/rate-limits${qs}`, { method: "DELETE", token })
}
