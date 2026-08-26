import { Card, KV } from '../components/ui'

export default function About() {
  return (
    <div className="grid gap-6 xl:grid-cols-2">
      <Card title="About SoftPrompt" subtitle="See what the image doesn't show.">
        <div className="space-y-3 text-sm leading-relaxed text-slate-300">
          <p>
            SoftPrompt is an educational, defensive cybersecurity project. It demonstrates how
            arbitrary text — including a prompt-injection payload aimed at a multimodal AI system —
            can be hidden inside an ordinary looking image, and how a scanner can detect and recover
            it.
          </p>
          <p>
            The encoder writes data into the least significant bit of every red, green and blue
            sample. Changing that bit shifts a channel value by at most 1/255, which is invisible to
            the eye but perfectly recoverable as long as the file is stored in a lossless format.
          </p>
          <p className="rounded-lg border border-rose-500/25 bg-rose-500/5 p-3 text-rose-200">
            Extracted text is always treated as untrusted data. SoftPrompt never executes it, never
            interprets it as an instruction and never forwards it to any AI service.
          </p>
        </div>
      </Card>

      <Card title="Packet format">
        <div className="rounded-lg border border-white/10 bg-ink-850/60 p-3">
          <KV k="magic" v="4 B — 'SPR1'" />
          <KV k="version" v="1 B" />
          <KV k="flags" v="1 B — bit0 = encrypted" />
          <KV k="body_len" v="4 B big endian" />
          <KV k="digest" v="32 B — SHA-256 of body" />
          <KV k="body" v="UTF-8 text, or salt|nonce|ciphertext" />
          <KV k="header total" v="42 B" />
          <KV k="capacity" v="width × height × 3 / 8 bytes" />
        </div>
        <p className="mt-3 text-sm text-slate-400">
          Bits are written most-significant-bit first, scanning row by row and R→G→B inside each
          pixel. The alpha channel is left untouched.
        </p>
      </Card>

      <Card title="How to use it">
        <ol className="list-decimal space-y-2 pl-5 text-sm text-slate-300">
          <li>
            <strong className="text-neon">Encoder</strong> — drop a PNG/BMP/TIFF, type the prompt,
            optionally set a password, encode and download the result.
          </li>
          <li>
            <strong className="text-neon">Scanner</strong> — upload the downloaded file. The scanner
            reports detection status, extracted text, encoding method, payload size, image
            information, SHA-256 and checksum status.
          </li>
          <li>
            <strong className="text-neon">Image Analysis</strong> — statistical triage: entropy, RGB
            statistics and LSB distribution.
          </li>
          <li>
            <strong className="text-neon">Reliability Testing</strong> — runs the full suite and
            reports the measured success rate.
          </li>
        </ol>
      </Card>

      <Card title="Limitations">
        <ul className="list-disc space-y-2 pl-5 text-sm text-slate-300">
          <li>JPEG and other lossy re-encodings destroy the payload — this is expected, not a bug.</li>
          <li>Resizing, cropping, rotating or heavy filtering also destroys it.</li>
          <li>
            Detection only recognises the SoftPrompt container. Other steganography tools use
            different formats and will not be decoded here.
          </li>
          <li>
            Statistical indicators cannot prove an image is clean; a low-rate embedding can hide
            inside natural noise.
          </li>
          <li>Capacity is one bit per colour channel, so roughly 1 byte per 2.67 pixels.</li>
        </ul>
      </Card>
    </div>
  )
}
