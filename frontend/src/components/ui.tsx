import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import type { ReactNode } from 'react'

export function Card({
  title,
  subtitle,
  children,
  className = '',
}: {
  title?: string
  subtitle?: string
  children: ReactNode
  className?: string
}) {
  return (
    <section className={`card ${className}`}>
      {title && <h2 className="card-title">{title}</h2>}
      {subtitle && <p className="mb-4 text-sm text-slate-400">{subtitle}</p>}
      {children}
    </section>
  )
}

export function KV({ k, v }: { k: string; v: ReactNode }) {
  return (
    <div className="kv">
      <span className="kv-key">{k}</span>
      <span className="kv-val">{v}</span>
    </div>
  )
}

export function Badge({
  tone,
  children,
}: {
  tone: 'good' | 'bad' | 'warn' | 'info'
  children: ReactNode
}) {
  const tones = {
    good: 'bg-emerald-500/15 text-emerald-300 ring-1 ring-emerald-500/30',
    bad: 'bg-rose-500/15 text-rose-300 ring-1 ring-rose-500/30',
    warn: 'bg-amber-500/15 text-amber-300 ring-1 ring-amber-500/30',
    info: 'bg-cyan-500/15 text-cyan-300 ring-1 ring-cyan-500/30',
  }
  return <span className={`badge ${tones[tone]}`}>{children}</span>
}

export function ProgressBar({ percent, tone = 'neon' }: { percent: number; tone?: string }) {
  const clamped = Math.max(0, Math.min(100, percent))
  const color =
    tone === 'bad' ? 'bg-rose-400' : tone === 'warn' ? 'bg-amber-400' : 'bg-neon'
  return (
    <div className="h-2 w-full overflow-hidden rounded-full bg-white/10">
      <div
        className={`h-full rounded-full ${color} transition-all duration-500`}
        style={{ width: `${clamped}%` }}
      />
    </div>
  )
}

export function Spinner({ label }: { label?: string }) {
  return (
    <span className="inline-flex items-center gap-2 text-sm text-neon">
      <span className="h-4 w-4 animate-spin rounded-full border-2 border-neon/30 border-t-neon" />
      {label}
    </span>
  )
}

export function ErrorNote({ message }: { message: string }) {
  return (
    <div className="rounded-lg border border-rose-500/30 bg-rose-500/10 px-3 py-2 text-sm text-rose-200">
      {message}
    </div>
  )
}

export function DropZone({
  file,
  onFile,
  hint,
  accept = 'image/*',
}: {
  file: File | null
  onFile: (f: File | null) => void
  hint?: string
  accept?: string
}) {
  const [over, setOver] = useState(false)
  const inputRef = useRef<HTMLInputElement>(null)
  const preview = useMemo(() => (file ? URL.createObjectURL(file) : null), [file])

  useEffect(
    () => () => {
      if (preview) URL.revokeObjectURL(preview)
    },
    [preview],
  )

  const handleDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault()
      setOver(false)
      const dropped = e.dataTransfer.files?.[0]
      if (dropped) onFile(dropped)
    },
    [onFile],
  )

  return (
    <div>
      <div
        role="button"
        tabIndex={0}
        onClick={() => inputRef.current?.click()}
        onKeyDown={(e) => (e.key === 'Enter' || e.key === ' ') && inputRef.current?.click()}
        onDragOver={(e) => {
          e.preventDefault()
          setOver(true)
        }}
        onDragLeave={() => setOver(false)}
        onDrop={handleDrop}
        className={`flex cursor-pointer flex-col items-center justify-center gap-2 rounded-xl border-2 border-dashed px-4 py-8 text-center transition ${
          over ? 'border-neon bg-neon/5' : 'border-white/15 hover:border-neon/50'
        }`}
      >
        {preview ? (
          <img
            src={preview}
            alt="selected"
            className="max-h-44 rounded-lg border border-white/10 object-contain"
          />
        ) : (
          <div className="text-3xl text-neon/70">⬆</div>
        )}
        <p className="text-sm text-slate-300">
          {file ? file.name : 'Drag & drop an image here, or click to browse'}
        </p>
        {hint && <p className="text-xs text-slate-500">{hint}</p>}
        <input
          ref={inputRef}
          type="file"
          accept={accept}
          className="hidden"
          onChange={(e) => onFile(e.target.files?.[0] ?? null)}
        />
      </div>
      {file && (
        <button
          type="button"
          className="mt-2 text-xs text-slate-400 underline hover:text-neon"
          onClick={() => onFile(null)}
        >
          clear selection
        </button>
      )}
    </div>
  )
}
