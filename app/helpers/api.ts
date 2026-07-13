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

export async function getAlarmStatus() {
  return request("/api/alarm/status")
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

export function createSSEConnection(onMessage: (armed: boolean) => void) {
  const eventSource = new EventSource(`${API_BASE}/api/alarm/events`)

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
    eventSource.close()
  }

  return eventSource
}

export { API_BASE }
