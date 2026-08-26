import { useState } from 'react'
import { api } from '../api'
import { Badge, Card, ErrorNote, ProgressBar, Spinner } from '../components/ui'
import type { SuiteResponse } from '../types'

function Stat({ label, value, tone = '' }: { label: string; value: string; tone?: string }) {
  return (
    <div className="rounded-lg border border-white/10 bg-ink-850/60 p-4 text-center">
      <p className="text-xs uppercase tracking-widest text-slate-400">{label}</p>
      <p className={`mt-1 font-mono text-2xl font-bold ${tone || 'text-slate-100'}`}>{value}</p>
    </div>
  )
}

export default function Testing() {
  const [repeats, setRepeats] = useState(1)
  const [result, setResult] = useState<SuiteResponse | null>(null)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')

  async function run() {
    setBusy(true)
    setError('')
    setResult(null)
    try {
      setResult(await api.reliability(repeats))
    } catch (e) {
      setError((e as Error).message)
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="space-y-6">
      <Card
        title="Reliability Testing"
        subtitle="Every case genuinely encodes an image, saves it to its real file format, reloads it and decodes it again. The success rate below is computed from those runs — nothing is hard coded."
      >
        <div className="flex flex-wrap items-end gap-4">
          <div>
            <label className="label" htmlFor="repeats">
              Repeats per case (1–5)
            </label>
            <input
              id="repeats"
              type="number"
              min={1}
              max={5}
              className="field w-32"
              value={repeats}
              onChange={(e) => setRepeats(Math.min(5, Math.max(1, Number(e.target.value) || 1)))}
            />
          </div>
          <button className="btn-primary" onClick={run} disabled={busy}>
            {busy ? 'Running…' : 'Run test suite'}
          </button>
          {busy && <Spinner label="Encoding and decoding test images" />}
        </div>
        {error && (
          <div className="mt-4">
            <ErrorNote message={error} />
          </div>
        )}
      </Card>

      {result && (
        <>
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <Stat label="Total tests" value={String(result.total)} />
            <Stat label="Passed" value={String(result.passed)} tone="text-emerald-300" />
            <Stat label="Failed" value={String(result.failed)} tone="text-rose-300" />
            <Stat
              label="Success rate"
              value={`${result.success_rate}%`}
              tone={result.success_rate >= 90 ? 'text-neon' : 'text-amber-300'}
            />
          </div>

          <Card title="Suite summary">
            <ProgressBar
              percent={result.success_rate}
              tone={result.success_rate >= 90 ? 'neon' : 'warn'}
            />
            <p className="mt-2 text-sm text-slate-400">
              {result.passed}/{result.total} cases passed in {result.duration_ms} ms. Cases marked
              “expected failure” pass when SoftPrompt correctly refuses or flags the input (JPEG
              re-compression, wrong password, tampered pixels, oversized payload, clean image).
            </p>
          </Card>

          <Card title="Case results">
            <div className="overflow-x-auto">
              <table className="w-full min-w-[820px] text-left text-sm">
                <thead className="text-xs uppercase tracking-wider text-slate-500">
                  <tr>
                    <th className="py-2">Status</th>
                    <th>Case</th>
                    <th>Format</th>
                    <th>Size</th>
                    <th>Chars</th>
                    <th>Payload</th>
                    <th>PSNR</th>
                    <th>Detail</th>
                  </tr>
                </thead>
                <tbody>
                  {result.cases.map((c, i) => (
                    <tr key={`${c.name}-${i}`} className="border-t border-white/5 align-top">
                      <td className="py-2">
                        <Badge tone={c.passed ? 'good' : 'bad'}>{c.passed ? 'PASS' : 'FAIL'}</Badge>
                      </td>
                      <td className="py-2 pr-3">
                        {c.name}
                        {!c.expected_success && (
                          <span className="ml-2 text-xs text-slate-500">(expected failure)</span>
                        )}
                      </td>
                      <td className="font-mono text-xs">{c.image_format}</td>
                      <td className="font-mono text-xs">{c.dimensions}</td>
                      <td className="font-mono text-xs">{c.message_chars}</td>
                      <td className="font-mono text-xs">{c.payload_bytes} B</td>
                      <td className="font-mono text-xs">{c.psnr_db ? `${c.psnr_db} dB` : '—'}</td>
                      <td className="max-w-xs text-xs text-slate-400">{c.detail}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </Card>
        </>
      )}
    </div>
  )
}
