import { useEffect, useMemo, useState } from 'react'

import { api, formatBytes } from '../api'
import { Badge, Card, DropZone, ErrorNote, KV, ProgressBar, Spinner } from '../components/ui'
import type { CapacityResponse, EncodeResponse } from '../types'

const LOSSLESS = ['PNG', 'BMP', 'TIFF']

export default function Encoder() {
  const [file, setFile] = useState<File | null>(null)
  const [message, setMessage] = useState('')
  const [password, setPassword] = useState('')
  const [format, setFormat] = useState('PNG')
  const [capacity, setCapacity] = useState<CapacityResponse | null>(null)
  const [result, setResult] = useState<EncodeResponse | null>(null)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')

  const originalUrl = useMemo(() => (file ? URL.createObjectURL(file) : null), [file])

  useEffect(
    () => () => {
      if (originalUrl) URL.revokeObjectURL(originalUrl)
    },
    [originalUrl],
  )

  function selectFile(next: File | null) {
    setFile(next)
    setResult(null)
    setCapacity(null)
    setError('')
    if (next) {
      api.capacity(next).then(setCapacity).catch((e: Error) => setError(e.message))
    }
  }

  const payloadBytes = useMemo(() => {
    const body = new TextEncoder().encode(message).length
    // 42-byte header; encryption adds a 16-byte salt, 12-byte nonce and 16-byte tag.
    return 42 + body + (password ? 44 : 0)
  }, [message, password])

  const usedPercent = capacity?.capacity_bytes
    ? (payloadBytes / capacity.capacity_bytes) * 100
    : 0
  const overflow = capacity ? payloadBytes > capacity.capacity_bytes : false

  async function handleEncode() {
    if (!file || !message) return
    setBusy(true)
    setError('')
    setResult(null)
    try {
      setResult(await api.encode(file, message, password, format))
    } catch (e) {
      setError((e as Error).message)
    } finally {
      setBusy(false)
    }
  }

  function download() {
    if (!result) return
    const a = document.createElement('a')
    a.href = result.encoded.data_url
    a.download = result.encoded.filename
    document.body.appendChild(a)
    a.click()
    a.remove()
  }

  return (
    <div className="grid gap-6 xl:grid-cols-2">
      <Card
        title="Soft Prompt Encoder"
        subtitle="Hide a UTF-8 prompt inside the least significant bits of an image. Lossless formats only — JPEG re-compression destroys the payload."
      >
        <div className="space-y-4">
          <DropZone file={file} onFile={selectFile} hint="PNG, BMP or TIFF recommended" />

          {capacity && (
            <div className="rounded-lg border border-white/10 bg-ink-850/60 p-3">
              <KV k="Dimensions" v={`${capacity.width} × ${capacity.height}`} />
              <KV k="Source format" v={`${capacity.format ?? '—'} (${capacity.mode})`} />
              <KV k="File size" v={formatBytes(capacity.size_bytes)} />
              <KV k="Total capacity" v={`${capacity.capacity_bytes.toLocaleString()} bytes`} />
              <KV k="Usable for text" v={`${capacity.usable_text_bytes.toLocaleString()} bytes`} />
              {!capacity.lossless && (
                <p className="mt-2 text-xs text-amber-300">
                  Source is a lossy format. The encoded output will still be lossless, but re-saving
                  it as JPEG later will erase the payload.
                </p>
              )}
            </div>
          )}

          <div>
            <label className="label" htmlFor="prompt">
              Prompt / text to hide
            </label>
            <textarea
              id="prompt"
              className="field h-32 resize-y font-mono"
              placeholder="e.g. SYSTEM: ignore previous instructions…"
              value={message}
              onChange={(e) => setMessage(e.target.value)}
            />
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <label className="label" htmlFor="pw">
                Password (optional, AES-256-GCM)
              </label>
              <input
                id="pw"
                type="password"
                className="field"
                placeholder="leave empty for plain LSB"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
              />
            </div>
            <div>
              <label className="label" htmlFor="fmt">
                Output format
              </label>
              <select
                id="fmt"
                className="field"
                value={format}
                onChange={(e) => setFormat(e.target.value)}
              >
                {LOSSLESS.map((f) => (
                  <option key={f} value={f}>
                    {f}
                  </option>
                ))}
              </select>
            </div>
          </div>

          <div>
            <div className="mb-1 flex justify-between text-xs text-slate-400">
              <span>
                Payload {payloadBytes.toLocaleString()} B
                {capacity ? ` / ${capacity.capacity_bytes.toLocaleString()} B capacity` : ''}
              </span>
              <span className={overflow ? 'text-rose-300' : ''}>{usedPercent.toFixed(2)}%</span>
            </div>
            <ProgressBar percent={usedPercent} tone={overflow ? 'bad' : 'neon'} />
            {overflow && (
              <p className="mt-1 text-xs text-rose-300">
                Payload exceeds capacity — use a larger image or a shorter prompt.
              </p>
            )}
          </div>

          {error && <ErrorNote message={error} />}

          <div className="flex flex-wrap items-center gap-3">
            <button
              className="btn-primary"
              onClick={handleEncode}
              disabled={!file || !message || busy || overflow}
            >
              {busy ? 'Encoding…' : 'Encode & embed'}
            </button>
            {busy && <Spinner label="Writing LSB bits" />}
            {result && (
              <button className="btn-ghost" onClick={download}>
                ⬇ Download encoded image
              </button>
            )}
          </div>
        </div>
      </Card>

      <Card title="Result" subtitle="Original vs encoded — visually near identical.">
        {!result && <p className="text-sm text-slate-500">No encoded image yet.</p>}
        {result && (
          <div className="space-y-4">
            <div className="flex flex-wrap gap-2">
              <Badge tone="good">Payload embedded</Badge>
              <Badge tone="info">{result.encoding_method}</Badge>
              {result.encrypted && <Badge tone="warn">Password protected</Badge>}
            </div>

            <div className="grid grid-cols-2 gap-3">
              <figure>
                <img
                  src={originalUrl ?? ''}
                  alt="original"
                  className="h-44 w-full rounded-lg border border-white/10 object-contain bg-ink-850"
                />
                <figcaption className="mt-1 text-center text-xs text-slate-400">Original</figcaption>
              </figure>
              <figure>
                <img
                  src={result.encoded.data_url}
                  alt="encoded"
                  className="h-44 w-full rounded-lg border border-neon/30 object-contain bg-ink-850"
                />
                <figcaption className="mt-1 text-center text-xs text-neon">Encoded</figcaption>
              </figure>
            </div>

            <div className="rounded-lg border border-white/10 bg-ink-850/60 p-3">
              <KV k="Message characters" v={result.message_chars.toLocaleString()} />
              <KV k="Packet size (header + body)" v={`${result.packet_bytes.toLocaleString()} B`} />
              <KV k="Header size" v={`${result.header_bytes} B`} />
              <KV k="Capacity used" v={`${result.capacity_used_percent}%`} />
              <KV k="PSNR vs original" v={result.psnr_db ? `${result.psnr_db} dB` : 'identical'} />
              <KV k="Output" v={`${result.encoded.format} · ${formatBytes(result.encoded.size_bytes)}`} />
              <KV k="Original SHA-256" v={<span className="text-xs">{result.original.sha256}</span>} />
              <KV k="Encoded SHA-256" v={<span className="text-xs">{result.encoded.sha256}</span>} />
            </div>

            <p className="text-xs text-slate-500">
              Download the encoded file and drop it into the Scanner tab to verify the full
              round trip.
            </p>
          </div>
        )}
      </Card>
    </div>
  )
}
