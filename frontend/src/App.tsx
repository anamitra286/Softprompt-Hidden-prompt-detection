import { useEffect, useState } from 'react'
import About from './pages/About'
import Analysis from './pages/Analysis'
import Encoder from './pages/Encoder'
import Scanner from './pages/Scanner'
import Testing from './pages/Testing'
import { api } from './api'

const TABS = [
  { id: 'encoder', label: 'Encoder', icon: '🔒' },
  { id: 'scanner', label: 'Scanner', icon: '🔎' },
  { id: 'analysis', label: 'Image Analysis', icon: '📊' },
  { id: 'testing', label: 'Reliability Testing', icon: '🧪' },
  { id: 'about', label: 'About / Docs', icon: '📖' },
] as const

type TabId = (typeof TABS)[number]['id']

export default function App() {
  const [tab, setTab] = useState<TabId>('encoder')
  const [online, setOnline] = useState<boolean | null>(null)

  useEffect(() => {
    api
      .health()
      .then(() => setOnline(true))
      .catch(() => setOnline(false))
  }, [])

  return (
    <div className="flex min-h-full flex-col">
      <header className="sticky top-0 z-20 border-b border-white/10 bg-ink-950/80 backdrop-blur">
        <div className="mx-auto flex max-w-7xl flex-wrap items-center gap-4 px-4 py-3">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-lg border border-neon/40 bg-neon/10 text-lg shadow-glow">
              🛡
            </div>
            <div>
              <h1 className="text-lg font-bold tracking-tight text-slate-50">
                Soft<span className="text-neon">Prompt</span>
              </h1>
              <p className="text-xs text-slate-400">See what the image doesn't show.</p>
            </div>
          </div>
          <div className="ml-auto flex items-center gap-2 text-xs">
            <span
              className={`h-2 w-2 rounded-full ${
                online === null ? 'bg-slate-500' : online ? 'bg-emerald-400' : 'bg-rose-400'
              }`}
            />
            <span className="text-slate-400">
              {online === null ? 'checking API…' : online ? 'API online' : 'API offline'}
            </span>
          </div>
        </div>
        <nav className="mx-auto flex max-w-7xl gap-1 overflow-x-auto px-3 pb-2">
          {TABS.map((t) => (
            <button
              key={t.id}
              onClick={() => setTab(t.id)}
              className={`whitespace-nowrap rounded-lg px-3 py-2 text-sm font-medium transition ${
                tab === t.id
                  ? 'bg-neon/15 text-neon ring-1 ring-neon/40'
                  : 'text-slate-400 hover:bg-white/5 hover:text-slate-100'
              }`}
            >
              <span className="mr-1.5">{t.icon}</span>
              {t.label}
            </button>
          ))}
        </nav>
      </header>

      <main className="mx-auto w-full max-w-7xl flex-1 px-4 py-6">
        {online === false && (
          <div className="mb-6 rounded-lg border border-rose-500/30 bg-rose-500/10 px-4 py-3 text-sm text-rose-200">
            Backend is unreachable. Start it with{' '}
            <code className="font-mono">uvicorn app.main:app --reload</code> inside{' '}
            <code className="font-mono">backend/</code>.
          </div>
        )}
        {tab === 'encoder' && <Encoder />}
        {tab === 'scanner' && <Scanner />}
        {tab === 'analysis' && <Analysis />}
        {tab === 'testing' && <Testing />}
        {tab === 'about' && <About />}
      </main>

      <footer className="border-t border-white/10 px-4 py-4 text-center text-xs text-slate-500">
        SoftPrompt — educational defensive security project. Hidden text is treated strictly as
        untrusted data and is never executed.
      </footer>
    </div>
  )
}
