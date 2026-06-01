'use client'
import { useState, useEffect } from 'react'
import PageHeader from '../../components/PageHeader'

const MOCK = [
  { id: 1, key: 'user_name',          value: 'Нурислам',     created_at: '2026-05-18 19:34:07' },
  { id: 2, key: 'favorite_city',      value: 'Бишкек',       created_at: '2026-05-18 20:00:00' },
  { id: 3, key: 'preferred_language', value: 'Русский',      created_at: '2026-05-19 10:00:00' },
  { id: 4, key: 'music_preference',   value: 'Lofi Hip Hop', created_at: '2026-05-20 14:22:11' },
  { id: 5, key: 'work_hours',         value: '9:00–18:00',   created_at: '2026-05-21 09:00:00' },
]

export default function MemoryPage() {
  const [rows, setRows] = useState([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')

  useEffect(() => {
    async function load() {
      try {
        setLoading(true)
        const data = (typeof window !== 'undefined' && window.jarvis)
          ? await window.jarvis.readMemory()
          : MOCK
        setRows(data)
      } finally {
        setLoading(false)
      }
    }
    load()
  }, [])

  const cols = rows.length > 0 ? Object.keys(rows[0]) : []
  const filtered = rows.filter(r =>
    !search || Object.values(r).some(v => String(v).toLowerCase().includes(search.toLowerCase()))
  )

  return (
    <div className="h-full flex flex-col" style={{ animation: 'fade-in 0.25s ease' }}>
      <PageHeader title="Память" subtitle={`${rows.length} записей в базе`} />

      {/* Search */}
      <div className="relative max-w-xs mb-4 shrink-0">
        <svg className="absolute left-2.5 top-1/2 -translate-y-1/2 text-muted" width="13" height="13" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-4.35-4.35M17 11A6 6 0 115 11a6 6 0 0112 0z" />
        </svg>
        <input
          type="text"
          placeholder="Поиск..."
          value={search}
          onChange={e => setSearch(e.target.value)}
          className="w-full pl-8 pr-3 py-1.5 bg-elevated border border-border rounded-[var(--radius-sm)]
                     text-primary text-[13px] outline-none placeholder:text-muted
                     focus:border-accent transition-colors duration-150"
        />
      </div>

      {/* Table */}
      <div className="flex-1 overflow-auto rounded-[var(--radius-md)] border border-border">
        {loading && (
          <div className="p-6 flex flex-col gap-2">
            {Array.from({ length: 5 }).map((_, i) => (
              <div key={i} className="skeleton h-10" />
            ))}
          </div>
        )}

        {!loading && rows.length === 0 && (
          <div className="flex flex-col items-center justify-center h-48 gap-2">
            <svg width="40" height="40" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1} className="text-muted">
              <path strokeLinecap="round" strokeLinejoin="round" d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z" />
            </svg>
            <span className="text-muted text-sm">База памяти пуста</span>
            <span className="text-muted text-xs">~/jarvis/memory.db</span>
          </div>
        )}

        {!loading && rows.length > 0 && (
          <table className="w-full border-collapse">
            <thead>
              <tr className="border-b border-border">
                {cols.map(col => (
                  <th key={col}
                    className="sticky top-0 z-10 bg-surface px-3.5 py-2.5 text-left text-[11px] font-semibold text-muted uppercase tracking-wider border-b border-border">
                    {col}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {filtered.map((row, i) => (
                <tr key={i} className="border-b border-border hover:bg-elevated transition-colors duration-100">
                  {cols.map(col => (
                    <td key={col}
                      className={`px-3.5 py-2.5 text-[13px] max-w-[300px] overflow-hidden text-ellipsis whitespace-nowrap
                        ${col === 'key'
                          ? 'text-accent font-medium font-mono'
                          : 'text-secondary'}`}>
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
