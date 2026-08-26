import { useState } from 'react'
import { api, formatBytes } from '../api'
import { Badge, Card, DropZone, ErrorNote, KV, ProgressBar, Spinner } from '../components/ui'
import type { AnalyzeResponse } from '../types'

const CHANNEL_COLOR: Record<string, string> = { r: 'bg-rose-400', g: 'bg-emerald-400', b: 'bg-sky-400' }

export default function Analysis() {
  const [file, setFile] = useState<File | null>(null)
  const [result, setResult] = useState<AnalyzeResponse | null>(null)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')

  function selectFile(next: File | null) {
    setFile(next)
    setResult(null)
    setError('')
  }

  async function run() {
    if (!file) return
    setBusy(true)
    setError('')
    try {
      setResult(await api.analyze(file))
    } catch (e) {
      setError((e as Error).message)
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="grid gap-6 xl:grid-cols-2">
      <Card
        title="Image Analysis"
        subtitle="Dimensions, RGB statistics, entropy and LSB distribution for a first-pass triage of a suspicious image."
      >
        <div className="space-y-4">
          <DropZone file={file} onFile={selectFile} />
          {error && <ErrorNote message={error} />}
          <div className="flex items-center gap-3">
            <button className="btn-primary" onClick={run} disabled={!file || busy}>
              {busy ? 'Analysing…' : 'Analyse image'}
            </button>
            {busy && <Spinner label="Computing statistics" />}
          </div>
          <p className="rounded-lg border border-amber-500/25 bg-amber-500/5 p-3 text-xs text-amber-200">
            Statistical analysis is an <strong>indicator only</strong>. It can never guarantee an
            image is clean: noisy photographs naturally produce near-random LSB planes, and a
            careful embedding can hide inside that noise.
          </p>
        </div>
      </Card>

      <Card title="Report">
        {!result && <p className="text-sm text-slate-500">No analysis run yet.</p>}
        {result && (
          <div className="space-y-4">
            <div className="flex flex-wrap gap-2">
              <Badge tone={result.payload.detected ? 'bad' : 'good'}>{result.verdict}</Badge>
              <Badge tone={result.file.lossless ? 'good' : 'warn'}>
                {result.file.lossless ? 'Lossless container' : 'Lossy container'}
              </Badge>
            </div>

            <div className="rounded-lg border border-white/10 bg-ink-850/60 p-3">
              <KV k="Filename" v={result.file.filename} />
              <KV k="File type" v={`${result.file.format} · ${result.file.mode}`} />
              <KV k="File size" v={formatBytes(result.file.size_bytes)} />
              <KV
                k="Dimensions"
                v={`${result.dimensions.width} × ${result.dimensions.height} (${result.dimensions.pixels.toLocaleString()} px)`}
              />
              <KV k="Embedding capacity" v={`${result.dimensions.capacity_bytes.toLocaleString()} B`} />
              <KV k="Overall entropy" v={`${result.overall_entropy} bits/byte`} />
              <KV k="SHA-256" v={<span className="text-xs">{result.file.sha256}</span>} />
            </div>

            <div className="rounded-lg border border-white/10 bg-ink-850/60 p-3">
              <p className="label">RGB statistics</p>
              <table className="w-full text-left text-sm">
                <thead className="text-xs uppercase tracking-wider text-slate-500">
                  <tr>
                    <th className="py-1">Ch</th>
                    <th>Mean</th>
                    <th>Std</th>
                    <th>Min</th>
                    <th>Max</th>
                    <th>Entropy</th>
                  </tr>
                </thead>
                <tbody className="font-mono">
                  {Object.entries(result.rgb_stats).map(([ch, s]) => (
                    <tr key={ch} className="border-t border-white/5">
                      <td className="py-1 uppercase text-neon">{ch}</td>
                      <td>{s.mean}</td>
                      <td>{s.std}</td>
                      <td>{s.min}</td>
                      <td>{s.max}</td>
                      <td>{s.entropy}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <div className="rounded-lg border border-white/10 bg-ink-850/60 p-3">
              <p className="label">LSB distribution</p>
              <KV k="Ones / zeros" v={`${result.lsb.ones.toLocaleString()} / ${result.lsb.zeros.toLocaleString()}`} />
              <KV k="Ratio of ones" v={result.lsb.ratio_ones.toFixed(6)} />
              <KV k="Chi-square (vs 50/50)" v={result.lsb.chi_square} />
              <div className="mt-3 space-y-2">
                {Object.entries(result.lsb.per_channel_ratio).map(([ch, ratio]) => (
                  <div key={ch}>
                    <div className="mb-1 flex justify-between text-xs text-slate-400">
                      <span className="uppercase">{ch} channel ones</span>
                      <span className="font-mono">{(ratio * 100).toFixed(2)}%</span>
                    </div>
                    <div className="h-2 w-full overflow-hidden rounded-full bg-white/10">
                      <div
                        className={`h-full rounded-full ${CHANNEL_COLOR[ch]} transition-all duration-500`}
                        style={{ width: `${ratio * 100}%` }}
                      />
                    </div>
                  </div>
                ))}
              </div>
              <p className="mt-2 text-xs text-slate-500">
                A ratio very close to 50% across every channel is consistent with LSB embedding —
                but also with ordinary sensor noise.
              </p>
            </div>

            <div className="rounded-lg border border-white/10 bg-ink-850/60 p-3">
              <p className="label">Payload detection</p>
              <KV k="SoftPrompt payload" v={result.payload.detected ? 'yes' : 'no'} />
              <KV k="Reason" v={result.payload.reason} />
              {result.payload.detected && (
                <>
                  <KV k="Encoding method" v={result.payload.encoding_method ?? '—'} />
                  <KV k="Payload size" v={`${result.payload.payload_bytes ?? 0} B`} />
                  <KV k="Integrity" v={result.payload.integrity_ok ? 'OK' : 'FAILED'} />
                </>
              )}
              <div className="mt-2">
                <ProgressBar
                  percent={
                    result.payload.payload_bytes
                      ? (result.payload.payload_bytes / result.dimensions.capacity_bytes) * 100
                      : 0
                  }
                />
              </div>
            </div>

            <p className="text-xs text-slate-500">{result.disclaimer}</p>
          </div>
        )}
      </Card>
    </div>
  )
}
