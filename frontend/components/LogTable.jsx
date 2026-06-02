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

export default function LogTable({ filteredLines, loading, bottomRef }) {
  return (
    <div className="flex-grow overflow-auto flex flex-col gap-px">
      {loading && Array.from({ length: 8 }).map((_, i) => (
        <div key={i} className="skeleton h-9 shrink-0 mb-1" />
      ))}

      {!loading && filteredLines.length === 0 && (
        <div className="flex items-center justify-center h-48 text-muted text-sm">
          Записей не найдено
        </div>
      )}

      {!loading && filteredLines.map((line, i) => (
        <div
          key={i}
          className={`flex items-baseline gap-2.5 px-2.5 py-1.5 rounded-md transition-colors duration-100 shrink-0
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
  )
}
