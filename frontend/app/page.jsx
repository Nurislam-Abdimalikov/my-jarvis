'use client'
import { useState, useEffect, useRef, useCallback } from 'react'
import PageHeader from '../components/PageHeader'

const REFRESH_INTERVAL = 5000

function parseLine(raw) {
  const m = raw.match(/^(\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2}\.\d+)\s*\|\s*(\w+)\s*\|\s*(.+?)\s*-\s*(.+)$/)
  if (!m) return { raw, ts: '', level: 'INFO', module: '', msg: raw }
  return { raw, ts: m[1], level: m[2].trim(), module: m[3].trim(), msg: m[4].trim() }
}

const LEVEL_CLASS = {
  INFO:    'bg-elevated text-muted',
  WARNING: 'bg-warn-dim text-warn',
  ERROR:   'bg-danger-dim text-danger',
  DEBUG:   'bg-elevated text-muted',
}

const ROW_BG = {
  WARNING: 'bg-warn-dim/40',
  ERROR:   'bg-danger-dim/40',
}

function LogBadge({ level }) {
  return (
    <span className={`text-[10px] font-semibold px-1.5 py-0.5 rounded shrink-0 font-mono tracking-wide ${LEVEL_CLASS[level] || 'bg-elevated text-muted'}`}>
      {level}
    </span>
  )
}

function MsgText({ msg }) {
  if (msg.includes('📝 STT:')) {
    const text = msg.replace('📝 STT:', '').trim()
    return <span><span className="text-accent mr-1.5">📝</span><span className="text-primary font-medium">{text}</span></span>
  }
  if (msg.includes('Tool calls'))  return <span className="text-info">{msg}</span>
  if (msg.includes('✨ Wake word')) return <span className="text-ok">{msg}</span>
  if (msg.includes('→') && msg.includes('(✓)')) return <span className="text-ok">{msg}</span>
  return <span>{msg}</span>
}

const FILTERS = ['Все', 'Команды', 'Ошибки', 'Wake Word']

const MOCK = [
  '2026-05-18 19:34:07.062 | INFO | jarvis.skills.registry:build:141 - Зарегистрировано 26 скиллов',
  '2026-05-18 19:44:29.140 | INFO | jarvis.stt.whisper_stt:_transcribe:90 - 📝 STT: \'Какая погода сегодня в Бишкеке.\' (lang=ru, 4.5s)',
  '2026-05-18 19:44:30.906 | INFO | jarvis.core.assistant:_chat:382 - 🔧 Tool calls (iter 1): [\'get_weather\']',
  '2026-05-18 19:44:31.611 | INFO | jarvis.core.assistant:_chat:399 -    → get_weather (✓): В городе Бишкек: пасмурно, 22.1°C',
  '2026-05-18 22:20:04.946 | INFO | jarvis.stt.whisper_stt:_transcribe:90 - 📝 STT: \'Открой хром.\' (lang=ru, 5.6s)',
  '2026-05-18 22:20:06.701 | INFO | jarvis.core.assistant:_chat:352 - 🔧 Tool calls (iter 1): [\'open_app\']',
  '2026-05-18 22:20:06.962 | INFO | jarvis.core.assistant:_chat:369 -    → open_app (✓): Открыл Google Chrome',
  '2026-05-18 22:32:22.081 | INFO | jarvis.audio.wake_word:_wait:206 - ✨ Wake word triggered! score=0.390 (consec=1)',
  '2026-05-18 22:32:28.086 | INFO | jarvis.stt.whisper_stt:_transcribe:90 - 📝 STT: \'Сделаю громкость на максимум.\' (lang=ru, 1.3s)',
  '2026-05-18 22:32:29.187 | INFO | jarvis.core.assistant:_chat:352 - 🔧 Tool calls (iter 1): [\'set_volume\']',
  '2026-05-18 22:32:29.187 | WARNING | jarvis.core.assistant:_chat:352 - Пример предупреждения',
  '2026-05-18 22:32:29.187 | ERROR | jarvis.core.assistant:_chat:352 - Пример ошибки',
]

export default function HistoryPage() {
  const [lines, setLines] = useState([])
  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)
  const [filter, setFilter] = useState('Все')
  const [search, setSearch] = useState('')
  const bottomRef = useRef(null)

  const load = useCallback(async (silent = false) => {
    try {
      if (!silent) setLoading(true)
      else setRefreshing(true)
      const raw = (typeof window !== 'undefined' && window.jarvis)
        ? await window.jarvis.readLog(800)
        : MOCK
      setLines(raw.map(parseLine).reverse())
    } finally {
      setLoading(false)
      setRefreshing(false)
    }
  }, [])

  useEffect(() => {
    load()
    const id = setInterval(() => load(true), REFRESH_INTERVAL)
    return () => clearInterval(id)
  }, [load])

  const filtered = lines.filter(l => {
    if (filter === 'Команды'  && !l.msg.includes('📝 STT:'))               return false
    if (filter === 'Ошибки'   && l.level !== 'ERROR' && l.level !== 'WARNING') return false
    if (filter === 'Wake Word' && !l.msg.includes('Wake word'))              return false
    if (search && !l.msg.toLowerCase().includes(search.toLowerCase()) && !l.ts.includes(search)) return false
    return true
  })

  const handleClear = async () => {
    if (typeof window !== 'undefined' && window.jarvis) {
      const confirmed = window.confirm('Вы уверены, что хотите очистить всю историю команд?')
      if (confirmed) {
        await window.jarvis.clearLog()
        load()
      }
    }
  }

  const Actions = (
    <div className="flex gap-2">
      <button
        onClick={handleClear}
        className="flex items-center gap-1.5 px-3 py-1.5 rounded-[var(--radius-sm)] border border-red-500/20
                    bg-red-500/10 text-red-400 text-xs font-medium cursor-pointer hover:bg-red-500/20
                    transition-colors duration-150"
      >
        <svg width="12" height="12" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
        </svg>
        Очистить историю
      </button>

      <button
        onClick={() => load(true)}
        className={`flex items-center gap-1.5 px-3 py-1.5 rounded-[var(--radius-sm)] border border-border
                    bg-elevated text-xs font-medium cursor-pointer transition-colors duration-150
                    ${refreshing ? 'text-accent' : 'text-secondary hover:text-primary'}`}
      >
        <svg className={`transition-transform duration-500 ${refreshing ? 'rotate-180' : ''}`}
             width="12" height="12" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
        </svg>
        {refreshing ? 'Обновление...' : 'Обновить'}
      </button>
    </div>
  )
 
  return (
    <div className="h-full flex flex-col" style={{ animation: 'fade-in 0.25s ease' }}>
      <PageHeader
        title="История"
        subtitle={`${lines.length} записей · авто-обновление 5 сек`}
        action={Actions}
      />

      {/* Toolbar */}
      <div className="flex gap-2 mb-4 shrink-0 flex-wrap items-center">
        {/* Search */}
        <div className="flex-1 min-w-[200px] relative">
          <svg className="absolute left-2.5 top-1/2 -translate-y-1/2 text-muted" width="13" height="13" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-4.35-4.35M17 11A6 6 0 115 11a6 6 0 0112 0z" />
          </svg>
          <input
            type="text"
            placeholder="Поиск по логу..."
            value={search}
            onChange={e => setSearch(e.target.value)}
            className="w-full pl-8 pr-3 py-1.5 bg-elevated border border-border rounded-[var(--radius-sm)]
                       text-primary text-[13px] outline-none placeholder:text-muted
                       focus:border-accent transition-colors duration-150"
          />
        </div>

        {/* Filter tabs */}
        <div className="flex gap-1">
          {FILTERS.map(f => (
            <button
              key={f}
              onClick={() => setFilter(f)}
              className={`px-3 py-1.5 rounded-[var(--radius-sm)] border text-xs font-medium cursor-pointer transition-all duration-150
                ${f === filter
                  ? 'border-accent bg-accent-dim text-accent'
                  : 'border-border bg-elevated text-secondary hover:text-primary'}`}
            >{f}</button>
          ))}
        </div>
      </div>

      {/* Log rows */}
      <div className="flex-1 overflow-auto flex flex-col gap-px">
        {loading && Array.from({ length: 8 }).map((_, i) => (
          <div key={i} className="skeleton h-9" />
        ))}

        {!loading && filtered.length === 0 && (
          <div className="flex items-center justify-center h-48 text-muted text-sm">
            Записей не найдено
          </div>
        )}

        {!loading && filtered.map((line, i) => (
          <div
            key={i}
            className={`flex items-baseline gap-2.5 px-2.5 py-1.5 rounded-md transition-colors duration-100
              hover:bg-elevated ${ROW_BG[line.level] ?? ''}`}
          >
            <span className="font-mono text-[11px] text-muted shrink-0 min-w-[80px]">
              {line.ts ? line.ts.slice(11, 19) : ''}
            </span>
            <LogBadge level={line.level} />
            <span className="font-mono text-[12px] text-secondary flex-1 overflow-hidden">
              <MsgText msg={line.msg} />
            </span>
          </div>
        ))}
        <div ref={bottomRef} />
      </div>
    </div>
  )
}
