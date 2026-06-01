'use client'
import { useState, useEffect } from 'react'
import PageHeader from '../../components/PageHeader'

const MOCK = {
  skills: {
    get_time: { enabled: true }, get_date: { enabled: true },
    get_weather: { enabled: true, city_default: 'Бишкек' },
    open_app: { enabled: true }, close_app: { enabled: true }, switch_app: { enabled: true },
    web_search: { enabled: true, engine: 'google' }, open_url: { enabled: true },
    youtube_search: { enabled: true }, wiki_search: { enabled: true },
    set_volume: { enabled: true }, set_brightness: { enabled: true },
    lock_screen: { enabled: true, requires_confirmation: true },
    sleep_mac: { enabled: false, requires_confirmation: true },
    take_screenshot: { enabled: true },
    play_music: { enabled: true, default_app: 'spotify' }, pause_music: { enabled: true },
    next_track: { enabled: true }, prev_track: { enabled: true },
    send_telegram: { enabled: false, requires_confirmation: true },
    send_imessage: { enabled: false, requires_confirmation: true },
    get_today_events: { enabled: true }, create_event: { enabled: false, requires_confirmation: true },
    remember: { enabled: true }, recall: { enabled: true }, forget: { enabled: true },
    open_path: { enabled: true }, spotlight_search: { enabled: true },
    analyze_screen: { enabled: true, provider: 'aihubmix', model: 'gpt-5.5-free' },
  }
}

const CATEGORIES = [
  { key: 'info',     label: '🕐 Информация',  skills: ['get_time','get_date','get_time_in_city','get_weather'] },
  { key: 'apps',     label: '📱 Приложения',  skills: ['open_app','close_app','switch_app'] },
  { key: 'browser',  label: '🌐 Браузер',     skills: ['web_search','open_url','youtube_search','wiki_search','close_browser_tab'] },
  { key: 'system',   label: '⚙️ Система',    skills: ['set_volume','set_brightness','lock_screen','sleep_mac','take_screenshot'] },
  { key: 'music',    label: '🎵 Музыка',      skills: ['play_music','pause_music','next_track','prev_track','current_song'] },
  { key: 'messages', label: '💬 Сообщения',   skills: ['send_telegram','send_imessage','read_unread_mail'] },
  { key: 'calendar', label: '📅 Календарь',   skills: ['get_today_events','get_tomorrow_events','create_event'] },
  { key: 'memory',   label: '🧠 Память',      skills: ['remember','recall','forget'] },
  { key: 'files',    label: '📂 Файлы',       skills: ['open_path','spotlight_search'] },
  { key: 'vision',   label: '👁 Видение',     skills: ['analyze_screen'] },
]

function SkillBadge({ name, cfg }) {
  const on = cfg?.enabled ?? false
  return (
    <div className="flex items-center gap-2.5 px-3 py-2.5 rounded-[var(--radius-sm)] border border-border
                    bg-elevated hover:bg-hover hover:border-border-strong transition-all duration-150">
      <div className={`w-1.5 h-1.5 rounded-full shrink-0 ${on ? 'bg-ok shadow-[0_0_6px_var(--color-ok)]' : 'bg-muted'}`} />
      <span className={`font-mono text-xs font-medium flex-1 ${on ? 'text-primary' : 'text-muted'}`}>{name}</span>
      {cfg?.requires_confirmation && (
        <span className="text-[10px] px-1.5 py-0.5 rounded bg-warn-dim text-warn font-semibold tracking-wide">CONFIRM</span>
      )}
      {cfg?.model    && <span className="text-[11px] text-info">{cfg.model}</span>}
      {cfg?.engine   && <span className="text-[11px] text-muted">{cfg.engine}</span>}
      {cfg?.city_default && <span className="text-[11px] text-muted">{cfg.city_default}</span>}
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
        const res = (typeof window !== 'undefined' && window.jarvis)
          ? await window.jarvis.readSkills()
          : MOCK
        setData(res)
      } finally { setLoading(false) }
    }
    load()
  }, [])

  const skills = data?.skills || {}
  const total = Object.keys(skills).length
  const enabled = Object.values(skills).filter(s => s?.enabled).length
  const pct = total > 0 ? Math.round((enabled / total) * 100) : 0

  return (
    <div className="h-full flex flex-col" style={{ animation: 'fade-in 0.25s ease' }}>
      <PageHeader title="Скиллы" subtitle={`${enabled} из ${total} активны`} />

      {/* Progress bar */}
      <div className="mb-5 shrink-0">
        <div className="h-1 max-w-xs rounded-full bg-elevated overflow-hidden">
          <div className="h-full rounded-full bg-gradient-to-r from-accent to-ok transition-all duration-700"
               style={{ width: `${pct}%` }} />
        </div>
        <p className="text-[12px] text-muted mt-1.5">{pct}% скиллов включено</p>
      </div>

      {/* Grid */}
      <div className="flex-1 overflow-auto">
        {loading && (
          <div className="grid grid-cols-2 gap-4">
            {Array.from({ length: 6 }).map((_, i) => (
              <div key={i}>
                <div className="skeleton h-5 w-28 mb-2" />
                {Array.from({ length: 3 }).map((_, j) => (
                  <div key={j} className="skeleton h-10 mb-1.5" />
                ))}
              </div>
            ))}
          </div>
        )}

        {!loading && (
          <div className="grid grid-cols-2 gap-5 content-start">
            {CATEGORIES.map(({ key, label, skills: names }) => {
              const visible = names.filter(n => n in skills)
              if (!visible.length) return null
              return (
                <div key={key}>
                  <p className="text-[11px] font-semibold text-muted uppercase tracking-wider mb-2">{label}</p>
                  <div className="flex flex-col gap-1">
                    {visible.map(n => <SkillBadge key={n} name={n} cfg={skills[n]} />)}
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
