'use client'
import { useState, useEffect } from 'react'
import PageHeader from '../../components/PageHeader'

const MOCK_MEMORY = [
  { id: 1, key: 'user_name', value: 'Нурислам', created_at: '2026-05-18 19:34:07', updated_at: '2026-05-18 19:34:07' },
  { id: 2, key: 'favorite_city', value: 'Бишкек', created_at: '2026-05-18 20:00:00', updated_at: '2026-05-18 20:00:00' },
  { id: 3, key: 'preferred_language', value: 'Русский', created_at: '2026-05-19 10:00:00', updated_at: '2026-05-19 10:00:00' },
  { id: 4, key: 'music_preference', value: 'Lofi Hip Hop', created_at: '2026-05-20 14:22:11', updated_at: '2026-05-20 14:22:11' },
  { id: 5, key: 'work_hours', value: '9:00-18:00', created_at: '2026-05-21 09:00:00', updated_at: '2026-05-21 09:00:00' },
]

export default function MemoryPage() {
  const [rows, setRows] = useState([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')

  useEffect(() => {
    async function load() {
      try {
        setLoading(true)
        let data = []
        if (typeof window !== 'undefined' && window.jarvis) {
          data = await window.jarvis.readMemory()
        } else {
          data = MOCK_MEMORY
        }
        setRows(data)
      } finally {
        setLoading(false)
      }
    }
    load()
  }, [])

  const filtered = rows.filter(r => {
    if (!search) return true
    const s = search.toLowerCase()
    return Object.values(r).some(v => String(v).toLowerCase().includes(s))
  })

  // Get columns from first row
  const cols = rows.length > 0 ? Object.keys(rows[0]) : []

  return (
    <div style={{ height: '100%', display: 'flex', flexDirection: 'column' }} className="animate-fade-in">
      <PageHeader
        title="Память"
        subtitle={`${rows.length} записей в базе`}
      />

      {/* Search */}
      <div style={{ marginBottom: 16, position: 'relative', maxWidth: 320 }}>
        <svg style={{
          position: 'absolute', left: 10, top: '50%', transform: 'translateY(-50%)',
          color: 'var(--text-muted)', pointerEvents: 'none',
        }} width="14" height="14" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-4.35-4.35M17 11A6 6 0 115 11a6 6 0 0112 0z" />
        </svg>
        <input
          type="text"
          placeholder="Поиск..."
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
          }}
          onFocus={e => e.target.style.borderColor = 'var(--accent)'}
          onBlur={e => e.target.style.borderColor = 'var(--border)'}
        />
      </div>

      {/* Table */}
      <div style={{
        flex: 1,
        overflow: 'auto',
        borderRadius: 'var(--radius)',
        border: '1px solid var(--border)',
      }}>
        {loading && (
          <div style={{ padding: 24, display: 'flex', flexDirection: 'column', gap: 8 }}>
            {Array.from({ length: 5 }).map((_, i) => (
              <div key={i} className="skeleton" style={{ height: 40 }} />
            ))}
          </div>
        )}

        {!loading && rows.length === 0 && (
          <div style={{
            display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
            height: 200, gap: 8,
          }}>
            <svg width="40" height="40" fill="none" viewBox="0 0 24 24" stroke="var(--text-muted)" strokeWidth={1}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z" />
            </svg>
            <span style={{ color: 'var(--text-muted)', fontSize: 14 }}>База памяти пуста или не найдена</span>
            <span style={{ color: 'var(--text-muted)', fontSize: 12 }}>~/jarvis/memory.db</span>
          </div>
        )}

        {!loading && rows.length > 0 && (
          <table style={{ width: '100%', borderCollapse: 'collapse' }}>
            <thead>
              <tr style={{ borderBottom: '1px solid var(--border)' }}>
                {cols.map(col => (
                  <th key={col} style={{
                    padding: '10px 14px',
                    textAlign: 'left',
                    fontSize: 11,
                    fontWeight: 600,
                    color: 'var(--text-muted)',
                    letterSpacing: '0.06em',
                    textTransform: 'uppercase',
                    background: 'var(--bg-surface)',
                    position: 'sticky',
                    top: 0,
                    zIndex: 1,
                    borderBottom: '1px solid var(--border)',
                  }}>{col}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {filtered.map((row, i) => (
                <tr
                  key={i}
                  style={{
                    borderBottom: '1px solid var(--border)',
                    transition: 'background 0.1s',
                  }}
                  onMouseEnter={e => e.currentTarget.style.background = 'var(--bg-elevated)'}
                  onMouseLeave={e => e.currentTarget.style.background = 'transparent'}
                >
                  {cols.map(col => (
                    <td key={col} style={{
                      padding: '10px 14px',
                      fontSize: 13,
                      color: col === 'key' ? 'var(--accent)' : 'var(--text-secondary)',
                      fontWeight: col === 'key' ? 500 : 400,
                      fontFamily: col === 'key' ? "'JetBrains Mono', monospace" : 'inherit',
                      maxWidth: 300,
                      overflow: 'hidden',
                      textOverflow: 'ellipsis',
                      whiteSpace: 'nowrap',
                    }}>
                      {String(row[col] ?? '—')}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  )
}
