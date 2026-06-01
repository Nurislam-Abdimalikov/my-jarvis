'use client'
import { useState, useEffect } from 'react'
import PageHeader from '../../components/PageHeader'

const MOCK_STATS = {
  today: 7,
  total: 84,
  topCommands: [
    { name: 'get_weather', count: 18 },
    { name: 'open_app', count: 15 },
    { name: 'set_volume', count: 12 },
    { name: 'open_url', count: 10 },
    { name: 'get_time', count: 8 },
    { name: 'take_screenshot', count: 6 },
    { name: 'play_music', count: 5 },
    { name: 'web_search', count: 4 },
  ]
}

function StatCard({ label, value, sub, color = 'var(--accent)', icon }) {
  return (
    <div style={{
      padding: '20px 22px',
      borderRadius: 'var(--radius)',
      border: '1px solid var(--border)',
      background: 'var(--bg-surface)',
      position: 'relative',
      overflow: 'hidden',
    }}>
      {/* Glow bg */}
      <div style={{
        position: 'absolute',
        top: -30, right: -30,
        width: 100, height: 100,
        borderRadius: '50%',
        background: color,
        opacity: 0.07,
        filter: 'blur(30px)',
        pointerEvents: 'none',
      }} />

      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: 12 }}>
        <span style={{ fontSize: 12, color: 'var(--text-muted)', fontWeight: 500, letterSpacing: '0.04em', textTransform: 'uppercase' }}>
          {label}
        </span>
        <span style={{ fontSize: 18, opacity: 0.6 }}>{icon}</span>
      </div>

      <div style={{
        fontSize: 36,
        fontWeight: 700,
        color,
        lineHeight: 1,
        letterSpacing: '-0.03em',
        marginBottom: 6,
      }}>{value}</div>

      {sub && <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>{sub}</div>}
    </div>
  )
}

function CommandBar({ name, count, max }) {
  const pct = max > 0 ? (count / max) * 100 : 0
  return (
    <div style={{
      display: 'flex', alignItems: 'center', gap: 12,
      padding: '9px 0',
      borderBottom: '1px solid var(--border)',
    }}>
      {/* Name */}
      <span className="mono" style={{
        fontSize: 12, color: 'var(--text-secondary)', fontWeight: 500,
        minWidth: 150, flexShrink: 0,
      }}>{name}</span>

      {/* Bar */}
      <div style={{ flex: 1, height: 4, borderRadius: 99, background: 'var(--bg-elevated)', overflow: 'hidden' }}>
        <div style={{
          height: '100%', borderRadius: 99,
          width: `${pct}%`,
          background: 'linear-gradient(90deg, var(--accent), #a855f7)',
          transition: 'width 0.8s cubic-bezier(0.34,1.56,0.64,1)',
        }} />
      </div>

      {/* Count */}
      <span style={{
        fontSize: 13, color: 'var(--text-primary)', fontWeight: 600,
        minWidth: 28, textAlign: 'right', flexShrink: 0,
      }}>{count}</span>
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
        let data = null
        if (typeof window !== 'undefined' && window.jarvis) {
          data = await window.jarvis.getStats()
        } else {
          data = MOCK_STATS
        }
        setStats(data)
      } finally {
        setLoading(false)
      }
    }
    load()
  }, [])

  const maxCount = stats?.topCommands?.[0]?.count ?? 1

  return (
    <div style={{ height: '100%', display: 'flex', flexDirection: 'column' }} className="animate-fade-in">
      <PageHeader title="Статистика" subtitle="Анализ использования Jarvis" />

      {loading && (
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 12, marginBottom: 24 }}>
          {Array.from({ length: 3 }).map((_, i) => (
            <div key={i} className="skeleton" style={{ height: 110, borderRadius: 'var(--radius)' }} />
          ))}
        </div>
      )}

      {!loading && stats && (
        <>
          {/* Stat cards */}
          <div style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(3, 1fr)',
            gap: 12,
            marginBottom: 28,
            flexShrink: 0,
          }}>
            <StatCard
              label="Сегодня"
              value={stats.today}
              sub="команд за сегодня"
              color="var(--accent)"
              icon="⚡"
            />
            <StatCard
              label="Всего"
              value={stats.total}
              sub="команд в логе"
              color="var(--green)"
              icon="📊"
            />
            <StatCard
              label="Скиллов"
              value={stats.topCommands?.length ?? 0}
              sub="уникальных инструментов"
              color="var(--blue)"
              icon="🔧"
            />
          </div>

          {/* Top commands */}
          <div style={{
            flex: 1,
            overflow: 'hidden',
            display: 'flex',
            flexDirection: 'column',
          }}>
            <h2 style={{
              fontSize: 13,
              fontWeight: 600,
              color: 'var(--text-muted)',
              letterSpacing: '0.06em',
              textTransform: 'uppercase',
              marginBottom: 4,
            }}>Топ команды</h2>

            <div style={{ flex: 1, overflow: 'auto', paddingRight: 4 }}>
              {stats.topCommands?.length === 0 && (
                <div style={{ color: 'var(--text-muted)', fontSize: 13, padding: '20px 0' }}>
                  Данных пока нет
                </div>
              )}
              {stats.topCommands?.map((cmd, i) => (
                <CommandBar key={cmd.name} name={cmd.name} count={cmd.count} max={maxCount} />
              ))}
            </div>
          </div>
        </>
      )}
    </div>
  )
}
