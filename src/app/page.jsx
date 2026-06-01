'use client'
import { useState, useEffect, useRef, useCallback } from 'react'
import PageHeader from '../components/PageHeader'

const REFRESH_INTERVAL = 5000 // 5 seconds


// Parse a single log line into structured data
function parseLine(raw) {
  // Format: 2026-05-18 19:34:07.062 | LEVEL | module:fn:line - message
  const m = raw.match(/^(\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2}\.\d+)\s*\|\s*(\w+)\s*\|\s*(.+?)\s*-\s*(.+)$/)
  if (!m) return { raw, ts: '', level: 'INFO', module: '', msg: raw }
  return { raw, ts: m[1], level: m[2].trim(), module: m[3].trim(), msg: m[4].trim() }
}

const LEVEL_COLOR = {
  INFO: 'var(--text-secondary)',
  WARNING: 'var(--yellow)',
  ERROR: 'var(--red)',
  DEBUG: 'var(--text-muted)',
  SUCCESS: 'var(--green)',
}

const LEVEL_BG = {
  WARNING: 'var(--yellow-dim)',
  ERROR: 'var(--red-dim)',
}

function LogBadge({ level }) {
  return (
    <span style={{
      fontSize: 10,
      fontWeight: 600,
      padding: '2px 6px',
      borderRadius: 4,
      background: LEVEL_BG[level] || 'var(--bg-elevated)',
      color: LEVEL_COLOR[level] || 'var(--text-muted)',
      letterSpacing: '0.05em',
      fontFamily: 'var(--font-mono)',
      flexShrink: 0,
    }}>{level}</span>
  )
}

// Highlight STT commands and tool calls
function MsgText({ msg }) {
  if (msg.includes('📝 STT:')) {
    const text = msg.replace('📝 STT:', '').trim()
    return (
      <span>
        <span style={{ color: 'var(--accent)', marginRight: 6 }}>📝</span>
        <span style={{ color: 'var(--text-primary)', fontWeight: 500 }}>{text}</span>
      </span>
    )
  }
  if (msg.includes('Tool calls')) {
    return <span style={{ color: 'var(--blue)' }}>{msg}</span>
  }
  if (msg.includes('✨ Wake word')) {
    return <span style={{ color: 'var(--green)' }}>{msg}</span>
  }
  if (msg.includes('→') && msg.includes('(✓)')) {
    return <span style={{ color: 'var(--green)' }}>{msg}</span>
  }
  return <span>{msg}</span>
}

const FILTERS = ['Все', 'Команды', 'Ошибки', 'Wake Word']

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
      let raw = []
      if (typeof window !== 'undefined' && window.jarvis) {
        raw = await window.jarvis.readLog(800)
      } else {
        raw = [
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
      }
      setLines(raw.map(parseLine).reverse())
    } finally {
      setLoading(false)
      setRefreshing(false)
    }
  }, [])

  useEffect(() => {
    load()
    const interval = setInterval(() => load(true), REFRESH_INTERVAL)
    return () => clearInterval(interval)
  }, [load])

  const filtered = lines.filter(l => {
    if (filter === 'Команды' && !l.msg.includes('📝 STT:')) return false
    if (filter === 'Ошибки' && l.level !== 'ERROR' && l.level !== 'WARNING') return false
    if (filter === 'Wake Word' && !l.msg.includes('Wake word')) return false
    if (search && !l.msg.toLowerCase().includes(search.toLowerCase()) && !l.ts.includes(search)) return false
    return true
  })

  const RefreshBtn = (
    <button
      onClick={() => load(true)}
      style={{
        display: 'flex', alignItems: 'center', gap: 6,
        padding: '6px 12px',
        borderRadius: 'var(--radius-sm)',
        border: '1px solid var(--border)',
        background: 'var(--bg-elevated)',
        color: refreshing ? 'var(--accent)' : 'var(--text-secondary)',
        fontSize: 12, fontWeight: 500, cursor: 'pointer',
        transition: 'all 0.15s',
      }}
    >
      <svg style={{ transition: 'transform 0.5s', transform: refreshing ? 'rotate(360deg)' : 'none' }}
        width="12" height="12" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
      </svg>
      {refreshing ? 'Обновление...' : 'Обновить'}
    </button>
  )

  return (
    <div style={{ height: '100%', display: 'flex', flexDirection: 'column' }} className="animate-fade-in">
      <PageHeader
        title="История"
        subtitle={`${lines.length} записей в логе • обновляется каждые 5 сек`}
        action={RefreshBtn}
      />

      {/* Toolbar */}
      <div style={{
        display: 'flex',
        gap: 8,
        marginBottom: 16,
        flexShrink: 0,
        flexWrap: 'wrap',
        alignItems: 'center',
      }}>
        {/* Search */}
        <div style={{
          flex: 1,
          minWidth: 200,
          position: 'relative',
        }}>
          <svg style={{
            position: 'absolute', left: 10, top: '50%', transform: 'translateY(-50%)',
            color: 'var(--text-muted)',
          }} width="14" height="14" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-4.35-4.35M17 11A6 6 0 115 11a6 6 0 0112 0z" />
          </svg>
          <input
            type="text"
            placeholder="Поиск по логу..."
            value={search}
            onChange={e => setSearch(e.target.value)}
            style={{
              width: '100%',
              padding: '7px 12px 7px 32px',
              background: 'var(--bg-elevated)',
              border: '1px solid var(--border)',
              borderRadius: 'var(--radius-sm)',
              color: 'var(--text-primary)',
              fontSize: 13,
              outline: 'none',
              transition: 'border-color 0.15s',
            }}
            onFocus={e => e.target.style.borderColor = 'var(--accent)'}
            onBlur={e => e.target.style.borderColor = 'var(--border)'}
          />
        </div>

        {/* Filters */}
        <div style={{ display: 'flex', gap: 4 }}>
          {FILTERS.map(f => (
            <button
              key={f}
              onClick={() => setFilter(f)}
              style={{
                padding: '6px 12px',
                borderRadius: 'var(--radius-sm)',
                border: '1px solid',
                borderColor: filter === f ? 'var(--accent)' : 'var(--border)',
                background: filter === f ? 'var(--accent-dim)' : 'var(--bg-elevated)',
                color: filter === f ? 'var(--accent)' : 'var(--text-secondary)',
                fontSize: 12,
                fontWeight: 500,
                cursor: 'pointer',
                transition: 'all 0.15s',
              }}
            >{f}</button>
          ))}
        </div>
      </div>

      {/* Log list */}
      <div style={{
        flex: 1,
        overflow: 'auto',
        display: 'flex',
        flexDirection: 'column',
        gap: 1,
      }}>
        {loading && (
          Array.from({ length: 8 }).map((_, i) => (
            <div key={i} className="skeleton" style={{ height: 38, borderRadius: 6 }} />
          ))
        )}
        {!loading && filtered.length === 0 && (
          <div style={{
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            height: 200, color: 'var(--text-muted)', fontSize: 14,
          }}>
            Записей не найдено
          </div>
        )}
        {!loading && filtered.map((line, i) => (
          <div
            key={i}
            style={{
              display: 'flex',
              alignItems: 'baseline',
              gap: 10,
              padding: '7px 10px',
              borderRadius: 6,
              background: LEVEL_BG[line.level] ? LEVEL_BG[line.level] + '40' : 'transparent',
              transition: 'background 0.1s',
            }}
            onMouseEnter={e => {
              if (!LEVEL_BG[line.level]) e.currentTarget.style.background = 'var(--bg-elevated)'
            }}
            onMouseLeave={e => {
              if (!LEVEL_BG[line.level]) e.currentTarget.style.background = 'transparent'
            }}
          >
            {/* Timestamp */}
            <span className="mono" style={{
              fontSize: 11,
              color: 'var(--text-muted)',
              flexShrink: 0,
              minWidth: 85,
            }}>
              {line.ts ? line.ts.slice(11, 19) : ''}
            </span>

            <LogBadge level={line.level} />

            {/* Message */}
            <span className="mono" style={{ fontSize: 12, color: 'var(--text-secondary)', flex: 1, overflow: 'hidden' }}>
              <MsgText msg={line.msg} />
            </span>
          </div>
        ))}
        <div ref={bottomRef} />
      </div>
    </div>
  )
}
