'use client'
import { useState, useEffect } from 'react'
import PageHeader from '../../components/PageHeader'

const MOCK = {
  today: 7, total: 84,
  topCommands: [
    { name: 'get_weather',    count: 18 },
    { name: 'open_app',       count: 15 },
    { name: 'set_volume',     count: 12 },
    { name: 'open_url',       count: 10 },
    { name: 'get_time',       count: 8  },
    { name: 'take_screenshot',count: 6  },
    { name: 'play_music',     count: 5  },
    { name: 'web_search',     count: 4  },
  ],
}

function StatCard({ label, value, sub, gradientFrom, gradientTo, icon }) {
  return (
    <div className="relative overflow-hidden p-5 rounded-[var(--radius-md)] border border-border bg-surface">
      {/* glow */}
      <div className={`absolute -top-8 -right-8 w-24 h-24 rounded-full opacity-10 blur-2xl pointer-events-none ${gradientFrom}`} />

      <div className="flex items-start justify-between mb-3">
        <span className="text-[11px] font-semibold text-muted uppercase tracking-wider">{label}</span>
        <span className="text-lg opacity-60">{icon}</span>
      </div>

      <div className={`text-4xl font-bold tracking-tight leading-none mb-1.5 ${gradientFrom.replace('bg-', 'text-')}`}>
        {value}
      </div>
      {sub && <p className="text-xs text-muted">{sub}</p>}
    </div>
  )
}

function CommandBar({ name, count, max }) {
  const pct = max > 0 ? (count / max) * 100 : 0
  return (
    <div className="flex items-center gap-3 py-2 border-b border-border">
      <span className="font-mono text-xs text-secondary font-medium min-w-[150px] shrink-0">{name}</span>
      <div className="flex-1 h-1 rounded-full bg-elevated overflow-hidden">
        <div className="h-full rounded-full bg-gradient-to-r from-accent to-purple-400 transition-all duration-700 ease-out"
             style={{ width: `${pct}%` }} />
      </div>
      <span className="text-[13px] text-primary font-semibold min-w-[28px] text-right shrink-0">{count}</span>
    </div>
  )
}

export default function StatsPage() {
  const [stats, setStats] = useState(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    async function load() {
      try {
        setLoading(true)
        const data = (typeof window !== 'undefined' && window.jarvis)
          ? await window.jarvis.getStats()
          : MOCK
        setStats(data)
      } finally { setLoading(false) }
    }
    load()
  }, [])

  const maxCount = stats?.topCommands?.[0]?.count ?? 1

  return (
    <div className="h-full flex flex-col" style={{ animation: 'fade-in 0.25s ease' }}>
      <PageHeader title="Статистика" subtitle="Анализ использования Jarvis" />

      {loading && (
        <div className="grid grid-cols-3 gap-3 mb-7">
          {Array.from({ length: 3 }).map((_, i) => (
            <div key={i} className="skeleton h-28 rounded-[var(--radius-md)]" />
          ))}
        </div>
      )}

      {!loading && stats && (
        <>
          {/* Stat cards */}
          <div className="grid grid-cols-3 gap-3 mb-7 shrink-0">
            <StatCard label="Сегодня"  value={stats.today}  sub="команд за сегодня"      gradientFrom="bg-accent"  gradientTo="bg-purple-500" icon="⚡" />
            <StatCard label="Всего"    value={stats.total}  sub="команд в логе"           gradientFrom="bg-ok"      gradientTo="bg-green-400"  icon="📊" />
            <StatCard label="Скиллов"  value={stats.topCommands?.length ?? 0} sub="уникальных инструментов" gradientFrom="bg-info" gradientTo="bg-blue-400" icon="🔧" />
          </div>

          {/* Top commands */}
          <div className="flex-1 overflow-hidden flex flex-col">
            <h2 className="text-[11px] font-semibold text-muted uppercase tracking-wider mb-1">Топ команды</h2>
            <div className="flex-1 overflow-auto pr-1">
              {stats.topCommands?.length === 0 && (
                <p className="text-muted text-sm py-5">Данных пока нет</p>
              )}
              {stats.topCommands?.map(cmd => (
                <CommandBar key={cmd.name} name={cmd.name} count={cmd.count} max={maxCount} />
              ))}
            </div>
          </div>
        </>
      )}
    </div>
  )
}
