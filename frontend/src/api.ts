import type {
  AnalyzeResponse,
  CapacityResponse,
  EncodeResponse,
  ScanResponse,
  SuiteResponse,
} from './types'

const BASE = import.meta.env.VITE_API_BASE ?? ''

async function post<T>(path: string, body?: FormData): Promise<T> {
  const res = await fetch(`${BASE}${path}`, { method: 'POST', body })
  const text = await res.text()
  let data: unknown
  try {
    data = text ? JSON.parse(text) : {}
  } catch {
    throw new Error(`Server returned a non-JSON response (${res.status}).`)
  }
  if (!res.ok) {
    const detail = (data as { detail?: string }).detail
    throw new Error(detail ?? `Request failed with status ${res.status}.`)
  }
  return data as T
}

export const api = {
  capacity: (file: File) => {
    const fd = new FormData()
    fd.append('image', file)
    return post<CapacityResponse>('/api/capacity', fd)
  },

  encode: (file: File, message: string, password: string, format: string) => {
    const fd = new FormData()
    fd.append('image', file)
    fd.append('message', message)
    fd.append('output_format', format)
    if (password) fd.append('password', password)
    return post<EncodeResponse>('/api/encode', fd)
  },

  scan: (file: File, password: string) => {
    const fd = new FormData()
    fd.append('image', file)
    if (password) fd.append('password', password)
    return post<ScanResponse>('/api/scan', fd)
  },

  analyze: (file: File) => {
    const fd = new FormData()
    fd.append('image', file)
    return post<AnalyzeResponse>('/api/analyze', fd)
  },

  reliability: (repeats: number) =>
    post<SuiteResponse>(`/api/reliability/run?repeats=${repeats}`),

  health: async () => {
    const res = await fetch(`${BASE}/api/health`)
    if (!res.ok) throw new Error('Backend unreachable')
    return (await res.json()) as { status: string; version: string }
  },
}

export function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(2)} KB`
  return `${(bytes / (1024 * 1024)).toFixed(2)} MB`
}
