'use client'
import { useState, useEffect } from 'react'
import PageHeader from '../../components/PageHeader'

const MOCK_SKILLS = {
  skills: {
    get_time: { enabled: true },
    get_date: { enabled: true },
    get_weather: { enabled: true, city_default: 'Бишкек' },
    open_app: { enabled: true },
    close_app: { enabled: true },
    web_search: { enabled: true, engine: 'google' },
    open_url: { enabled: true },
    youtube_search: { enabled: true },
    set_volume: { enabled: true },
    set_brightness: { enabled: true },
    lock_screen: { enabled: true, requires_confirmation: true },
    sleep_mac: { enabled: false, requires_confirmation: true },
    take_screenshot: { enabled: true },
    play_music: { enabled: true, default_app: 'spotify' },
    pause_music: { enabled: true },
    send_telegram: { enabled: false, requires_confirmation: true },
    send_imessage: { enabled: false, requires_confirmation: true },
    get_today_events: { enabled: true },
    create_event: { enabled: false, requires_confirmation: true },
    remember: { enabled: true },
    recall: { enabled: true },
    forget: { enabled: true },
    open_path: { enabled: true },
    analyze_screen: { enabled: true, provider: 'aihubmix', model: 'gpt-5.5-free' },
  }
}

const CATEGORY_MAP = {
  'info': ['get_time', 'get_date', 'get_time_in_city', 'get_weather'],
  'apps': ['open_app', 'close_app', 'switch_app'],
  'browser': ['web_search', 'open_url', 'youtube_search', 'wiki_search', 'close_browser_tab'],
  'system': ['set_volume', 'set_brightness', 'lock_screen', 'sleep_mac', 'take_screenshot'],
  'music': ['play_music', 'pause_music', 'next_track', 'prev_track', 'current_song'],
  'messages': ['send_telegram', 'send_imessage', 'read_unread_mail'],
  'calendar': ['get_today_events', 'get_tomorrow_events', 'create_event'],
  'notes': ['create_note', 'copy_to_clipboard', 'read_clipboard'],
  'timer': ['set_timer', 'cancel_timers'],
  'memory': ['remember', 'recall', 'forget'],
  'files': ['open_path', 'spotlight_search'],
  'vision': ['analyze_screen'],
}

const CATEGORY_LABELS = {
  info: '🕐 Информация',
  apps: '📱 Приложения',
  browser: '🌐 Браузер',
  system: '⚙️ Система',
  music: '🎵 Музыка',
  messages: '💬 Сообщения',
  calendar: '📅 Календарь',
  notes: '📝 Заметки',
  timer: '⏱ Таймер',
  memory: '🧠 Память',
  files: '📂 Файлы',
  vision: '👁 Видение',
}

function SkillBadge({ skill, config }) {
  const enabled = config?.enabled ?? false
  const hasConfirm = config?.requires_confirmation

  return (
    <div style={{
      display: 'flex',
      alignItems: 'center',
      gap: 10,
      padding: '10px 12px',
      borderRadius: 'var(--radius-sm)',
      border: '1px solid var(--border)',
      background: 'var(--bg-elevated)',
      transition: 'border-color 0.15s, background 0.15s',
    }}
      onMouseEnter={e => {
        e.currentTarget.style.background = 'var(--bg-hover)'
        e.currentTarget.style.borderColor = 'var(--border-strong)'
      }}
      onMouseLeave={e => {
        e.currentTarget.style.background = 'var(--bg-elevated)'
        e.currentTarget.style.borderColor = 'var(--border)'
      }}
    >
      {/* Status dot */}
      <div style={{
        width: 7, height: 7, borderRadius: '50%', flexShrink: 0,
        background: enabled ? 'var(--green)' : 'var(--text-muted)',
        boxShadow: enabled ? '0 0 6px var(--green)' : 'none',
      }} />

      {/* Name */}
      <span className="mono" style={{
        flex: 1,
        fontSize: 12,
        color: enabled ? 'var(--text-primary)' : 'var(--text-muted)',
        fontWeight: 500,
      }}>{skill}</span>

      {/* Confirm badge */}
      {hasConfirm && (
        <span style={{
          fontSize: 10, padding: '2px 6px', borderRadius: 4,
          background: 'var(--yellow-dim)', color: 'var(--yellow)',
          fontWeight: 600, letterSpacing: '0.04em',
        }}>CONFIRM</span>
      )}

      {/* Extra params */}
      {config?.city_default && (
        <span style={{ fontSize: 11, color: 'var(--text-muted)' }}>{config.city_default}</span>
      )}
      {config?.engine && (
        <span style={{ fontSize: 11, color: 'var(--text-muted)' }}>{config.engine}</span>
      )}
      {config?.model && (
        <span style={{ fontSize: 11, color: 'var(--blue)' }}>{config.model}</span>
      )}
    </div>
  )
}

export default function SkillsPage() {
  const [data, setData] = useState(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    async function load() {
      try {
        setLoading(true)
        let result = null
        if (typeof window !== 'undefined' && window.jarvis) {
          result = await window.jarvis.readSkills()
        } else {
          result = MOCK_SKILLS
        }
        setData(result)
      } finally {
        setLoading(false)
      }
    }
    load()
  }, [])

  const skills = data?.skills || {}
  const totalEnabled = Object.values(skills).filter(s => s?.enabled).length
  const total = Object.keys(skills).length

  return (
    <div style={{ height: '100%', display: 'flex', flexDirection: 'column' }} className="animate-fade-in">
      <PageHeader
        title="Скиллы"
        subtitle={`${totalEnabled} из ${total} активны`}
      />

      {/* Stats bar */}
      <div style={{ marginBottom: 20, flexShrink: 0 }}>
        <div style={{
          height: 4, borderRadius: 99,
          background: 'var(--bg-elevated)',
          overflow: 'hidden',
          maxWidth: 300,
        }}>
          <div style={{
            height: '100%', borderRadius: 99,
            width: total > 0 ? `${(totalEnabled / total) * 100}%` : '0%',
            background: 'linear-gradient(90deg, var(--accent), var(--green))',
            transition: 'width 0.6s ease',
          }} />
        </div>
        <div style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 6 }}>
          {total > 0 ? Math.round((totalEnabled / total) * 100) : 0}% скиллов включено
        </div>
      </div>

      {/* Skills grid */}
      <div style={{ flex: 1, overflow: 'auto' }}>
        {loading && (
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
            {Array.from({ length: 6 }).map((_, i) => (
              <div key={i}>
                <div className="skeleton" style={{ height: 20, width: 120, marginBottom: 10 }} />
                {Array.from({ length: 3 }).map((_, j) => (
                  <div key={j} className="skeleton" style={{ height: 40, marginBottom: 6 }} />
                ))}
              </div>
            ))}
          </div>
        )}

        {!loading && (
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 20, alignContent: 'start' }}>
            {Object.entries(CATEGORY_MAP).map(([cat, skillNames]) => {
              const catSkills = skillNames.filter(s => s in skills)
              if (catSkills.length === 0) return null
              return (
                <div key={cat}>
                  <div style={{
                    fontSize: 12, fontWeight: 600,
                    color: 'var(--text-muted)',
                    letterSpacing: '0.04em',
                    marginBottom: 8,
                    textTransform: 'uppercase',
                  }}>
                    {CATEGORY_LABELS[cat] || cat}
                  </div>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                    {catSkills.map(skill => (
                      <SkillBadge key={skill} skill={skill} config={skills[skill]} />
                    ))}
                  </div>
                </div>
              )
            })}
          </div>
        )}
      </div>
    </div>
  )
}
