'use client'
import Link from 'next/link'
import { usePathname } from 'next/navigation'

const NAV = [
  {
    href: '/',
    label: 'История',
    icon: (
      <svg width="16" height="16" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M12 6v6l4 2m6-2a10 10 0 11-20 0 10 10 0 0120 0z" />
      </svg>
    ),
  },
  {
    href: '/memory',
    label: 'Память',
    icon: (
      <svg width="16" height="16" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z" />
      </svg>
    ),
  },
  {
    href: '/skills',
    label: 'Скиллы',
    icon: (
      <svg width="16" height="16" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M13 10V3L4 14h7v7l9-11h-7z" />
      </svg>
    ),
  },
  {
    href: '/stats',
    label: 'Статистика',
    icon: (
      <svg width="16" height="16" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
      </svg>
    ),
  },
]

export default function Sidebar() {
  const pathname = usePathname()

  return (
    <aside className="drag-region w-[var(--width-sidebar)] shrink-0 flex flex-col bg-surface border-r border-border pb-4 px-3 gap-0.5">

      {/* Logo */}
      <div className="h-[52px] flex items-center gap-2.5 px-2 shrink-0">
        <div className="w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold text-white shrink-0
                        bg-gradient-to-br from-accent to-purple-500 shadow-[0_0_16px_var(--color-accent-glow)]">
          J
        </div>
        <span className="font-semibold text-sm text-primary tracking-tight">Jarvis</span>
        <div className="ml-auto w-1.5 h-1.5 rounded-full bg-ok"
             style={{ animation: 'pulse-dot 2s ease-in-out infinite' }} />
      </div>

      {/* Nav */}
      <nav className="no-drag flex flex-col gap-0.5">
        {NAV.map(({ href, label, icon }) => {
          const active = pathname === href
          return (
            <Link
              key={href}
              href={href}
              className={`
                flex items-center gap-2.5 px-2.5 py-2 rounded-[var(--radius-sm)]
                text-[13px] font-medium no-underline transition-all duration-150
                ${active
                  ? 'bg-active text-primary'
                  : 'text-secondary hover:bg-hover hover:text-primary'}
              `}
            >
              <span className={`flex shrink-0 ${active ? 'text-accent' : 'text-current'}`}>
                {icon}
              </span>
              {label}
              {active && (
                <div className="ml-auto w-[3px] h-3.5 rounded-full bg-accent" />
              )}
            </Link>
          )
        })}
      </nav>

      {/* Footer */}
      <div className="no-drag mt-auto">
        <div className="px-2.5 py-2.5 rounded-[var(--radius-sm)] border border-border bg-elevated">
          <div className="text-[11px] text-muted mb-1">Версия</div>
          <div className="text-xs text-secondary font-medium">Jarvis v1.0.0</div>
        </div>
      </div>
    </aside>
  )
}
