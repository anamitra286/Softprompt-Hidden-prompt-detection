import { useState } from 'react'
import { api, formatBytes } from '../api'
import { Badge, Card, DropZone, ErrorNote, KV, Spinner } from '../components/ui'
import type { ScanResponse } from '../types'

export default function Scanner() {
  const [file, setFile] = useState<File | null>(null)
  const [password, setPassword] = useState('')
  const [result, setResult] = useState<ScanResponse | null>(null)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')

  function selectFile(next: File | null) {
    setFile(next)
    setResult(null)
    setError('')
  }

  async function handleScan() {
    if (!file) return
    setBusy(true)
    setError('')
    try {
      setResult(await api.scan(file, password))
    } catch (e) {
      setError((e as Error).message)
    } finally {
      setBusy(false)
    }
  }

  const d = result?.detection
  const clean = result && !d?.detected

  return (
    <div className="grid gap-6 xl:grid-cols-2">
      <Card
        title="Soft Prompt Scanner"
        subtitle="Inspect an image for an embedded SoftPrompt payload. Extracted text is never executed — it is displayed as inert, untrusted data."
      >
        <div className="space-y-4">
          <DropZone file={file} onFile={selectFile} hint="Any image; payloads survive only in lossless files" />
          <div>
            <label className="label" htmlFor="scanpw">
              Password (only if the payload is encrypted)
            </label>
            <input
              id="scanpw"
              type="password"
              className="field"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
            />
          </div>
          {error && <ErrorNote message={error} />}
          <div className="flex items-center gap-3">
            <button className="btn-primary" onClick={handleScan} disabled={!file || busy}>
              {busy ? 'Scanning…' : 'Scan image'}
            </button>
            {busy && <Spinner label="Reading LSB plane" />}
          </div>
        </div>
      </Card>

      <Card title="Scan report">
        {!result && <p className="text-sm text-slate-500">No scan run yet.</p>}
        {result && d && (
          <div className="space-y-4">
            <div className="flex flex-wrap gap-2">
              {clean ? (
                <Badge tone="good">No valid hidden payload detected</Badge>
              ) : d.integrity_ok ? (
                <Badge tone="bad">Hidden payload detected</Badge>
              ) : (
                <Badge tone="warn">Payload header found — integrity failed</Badge>
              )}
              {d.encrypted && <Badge tone="warn">Encrypted</Badge>}
              {d.detected && (
                <Badge tone={d.integrity_ok ? 'good' : 'bad'}>
                  Checksum {d.integrity_ok ? 'valid' : 'mismatch'}
                </Badge>
              )}
            </div>

            <p className="text-sm text-slate-300">{d.reason}</p>

            {d.text !== null && d.text !== undefined && (
              <div>
                <p className="label">Extracted text (untrusted data — never executed)</p>
                <pre className="max-h-64 overflow-auto whitespace-pre-wrap break-words rounded-lg border border-amber-500/30 bg-amber-500/5 p-3 font-mono text-sm text-amber-100">
                  {d.text}
                </pre>
                <button
                  className="btn-ghost mt-2 text-xs"
                  onClick={() => navigator.clipboard?.writeText(d.text ?? '')}
                >
                  Copy text
                </button>
              </div>
            )}

            <div className="rounded-lg border border-white/10 bg-ink-850/60 p-3">
              <KV k="Detection status" v={d.detected ? 'Payload found' : 'Clean'} />
              <KV k="Encoding method" v={d.encoding_method ?? '—'} />
              <KV k="Payload size" v={d.payload_bytes ? `${d.payload_bytes.toLocaleString()} B` : '—'} />
              <KV k="Format version" v={d.version ?? '—'} />
              <KV k="Integrity" v={d.detected ? (d.integrity_ok ? 'OK' : 'FAILED') : '—'} />
              {d.expected_sha256 && (
                <KV k="Expected body SHA-256" v={<span className="text-xs">{d.expected_sha256}</span>} />
              )}
              {d.body_sha256 && (
                <KV k="Computed body SHA-256" v={<span className="text-xs">{d.body_sha256}</span>} />
              )}
            </div>

            <div className="rounded-lg border border-white/10 bg-ink-850/60 p-3">
              <KV k="Filename" v={result.image.filename ?? '—'} />
              <KV k="Format / mode" v={`${result.image.format ?? '—'} · ${result.image.mode}`} />
              <KV k="Dimensions" v={`${result.image.width} × ${result.image.height}`} />
              <KV k="File size" v={formatBytes(result.image.size_bytes)} />
              <KV k="Capacity" v={`${result.image.capacity_bytes.toLocaleString()} B`} />
              <KV k="Lossless container" v={result.image.lossless ? 'yes' : 'no'} />
              <KV k="File SHA-256" v={<span className="text-xs">{result.sha256}</span>} />
            </div>

            <p className="rounded-lg border border-cyan-500/20 bg-cyan-500/5 p-3 text-xs text-cyan-200">
              {result.safety_notice}
            </p>
          </div>
        )}
      </Card>
    </div>
  )
}
