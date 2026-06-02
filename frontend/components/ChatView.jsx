import { getAssistantStatus } from '../utils/chatUtils'

export default function ChatView({ messages, rawLines, loading }) {
  const status = getAssistantStatus(rawLines || [])

  if (loading && messages.length === 0) {
    return (
      <div className="flex-1 overflow-auto px-4 py-2 flex flex-col gap-4">
        {Array.from({ length: 4 }).map((_, i) => (
          <div key={i} className={`flex gap-3 max-w-[80%] ${i % 2 === 0 ? 'self-end flex-row-reverse' : 'self-start'}`}>
            <div className="w-8 h-8 rounded-full bg-elevated animate-pulse shrink-0" />
            <div className="h-16 w-48 bg-elevated rounded-2xl animate-pulse" />
          </div>
        ))}
      </div>
    )
  }

  if (messages.length === 0) {
    return (
      <div className="flex-grow flex flex-col items-center justify-center text-muted text-sm gap-4 p-8">
        <div className="w-20 h-20 rounded-full flex items-center justify-center bg-elevated/40 border border-border shadow-inner relative">
          <div className="absolute inset-0 rounded-full border border-accent/20 animate-ping opacity-45" />
          <svg className="w-8 h-8 text-accent/60" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M12 18.75a6 6 0 006-6v-1.5m-6 7.5a6 6 0 01-6-6v-1.5m6 7.5v3.75m-3.75 0h7.5M12 15.75a3 3 0 01-3-3V4.5a3 3 0 116 0v8.25a3 3 0 01-3 3z" />
          </svg>
        </div>
        <div className="text-center flex flex-col gap-1 max-w-[280px]">
          <span className="text-primary font-medium text-[13px]">Чат пуст</span>
          <span className="text-secondary text-xs">Произнесите ключевое слово <span className="text-accent font-semibold font-mono">«Джарвис»</span> и дайте команду!</span>
        </div>
        <StatusIndicator status={status} />
      </div>
    )
  }

  return (
    <div className="flex-1 overflow-hidden flex flex-col justify-between">
      {/* Messages */}
      <div className="flex-1 overflow-auto px-4 py-3 flex flex-col gap-4">
        {[...messages].reverse().map((msg) => {
          const isUser = msg.sender === 'user'
          const isSystem = msg.sender === 'system'

          if (isSystem) {
            return (
              <div key={msg.id} className="flex justify-center my-1">
                <span className="text-[11px] bg-elevated border border-border px-2.5 py-1 rounded-full text-muted font-mono">
                  {msg.text}
                </span>
              </div>
            )
          }

          return (
            <div
              key={msg.id}
              className={`flex gap-3 max-w-[85%] ${isUser ? 'self-end flex-row-reverse' : 'self-start'} animate-fade-in`}
            >
              {/* Avatar */}
              <div className={`w-8 h-8 rounded-full shrink-0 flex items-center justify-center text-xs font-bold font-sans shadow-md select-none
                ${isUser 
                  ? 'bg-gradient-to-br from-indigo-500 to-purple-600 text-white' 
                  : 'bg-gradient-to-br from-cyan-500/20 to-accent/30 border border-accent/40 text-accent'}`}
              >
                {isUser ? 'U' : 'J'}
              </div>

              {/* Bubble */}
              <div className="flex flex-col gap-1.5">
                <div
                  className={`px-4 py-2.5 rounded-2xl text-[13px] leading-relaxed shadow-sm
                    ${isUser 
                      ? 'bg-accent text-white rounded-tr-none' 
                      : 'bg-surface border border-border text-primary rounded-tl-none'}`}
                >
                  <div>{msg.text}</div>
                  
                  {/* Time */}
                  <div className={`text-[9px] mt-1.5 text-right opacity-60 font-mono`}>
                    {msg.ts}
                  </div>
                </div>

                {/* Skills Executed */}
                {msg.skills && msg.skills.length > 0 && (
                  <div className={`flex flex-wrap gap-1 mt-1 ${isUser ? 'justify-end' : 'justify-start'}`}>
                    {msg.skills.map((s, idx) => (
                      <span 
                        key={idx} 
                        className={`inline-flex items-center gap-1 text-[10px] px-2 py-0.5 rounded-full border font-mono
                          ${s.success 
                            ? 'bg-emerald-500/10 border-emerald-500/20 text-emerald-400' 
                            : 'bg-red-500/10 border-red-500/20 text-red-400'}`}
                        title={`Навык: ${s.name}`}
                      >
                        <span className="w-1.5 h-1.5 rounded-full bg-current animate-pulse" />
                        {s.message}
                      </span>
                    ))}
                  </div>
                )}
              </div>
            </div>
          )
        })}
      </div>

      {/* Interactive Status Footer */}
      <div className="p-3 border-t border-border bg-surface/50 flex items-center justify-center shrink-0">
        <StatusIndicator status={status} />
      </div>
    </div>
  )
}

function StatusIndicator({ status }) {
  const { code, label } = status

  return (
    <div className="flex items-center gap-3 px-4 py-2.5 rounded-full bg-elevated/60 border border-border/80 shadow-md">
      {/* Animated Waveform / Reactor Widget */}
      <div className="w-6 h-6 flex items-center justify-center relative">
        {code === 'listening' && (
          <>
            <div className="absolute inset-0.5 rounded-full bg-ok/20 border border-ok/30 pulse-ring-active" />
            <div className="w-2 h-2 rounded-full bg-ok shadow-[0_0_8px_var(--color-ok)]" />
          </>
        )}

        {code === 'recording' && (
          <>
            <div className="absolute -inset-1 rounded-full bg-danger/25 pulse-ring-active" />
            <div className="absolute inset-0 rounded-full bg-danger/30 pulse-ring-active" style={{ animationDelay: '0.6s' }} />
            <div className="w-2.5 h-2.5 rounded-full bg-danger shadow-[0_0_10px_var(--color-danger)] animate-ping" />
          </>
        )}

        {code === 'processing' && (
          <div className="w-4 h-4 rounded-full border-2 border-accent/20 border-t-accent animate-spin" />
        )}

        {code === 'speaking' && (
          <div className="flex items-end gap-0.5 h-3.5 w-4 justify-center">
            <span className="w-0.5 bg-accent sound-bar-animate rounded-full" style={{ height: '100%', animationDelay: '0.1s' }} />
            <span className="w-0.5 bg-accent sound-bar-animate rounded-full" style={{ height: '70%', animationDelay: '0.4s' }} />
            <span className="w-0.5 bg-accent sound-bar-animate rounded-full" style={{ height: '100%', animationDelay: '0.2s' }} />
            <span className="w-0.5 bg-accent sound-bar-animate rounded-full" style={{ height: '50%', animationDelay: '0.6s' }} />
          </div>
        )}

        {code === 'idle' && (
          <div className="w-2 h-2 rounded-full bg-muted shadow-sm" />
        )}
      </div>

      <span className="text-[12px] font-semibold text-secondary tracking-wide select-none">
        {label}
      </span>
    </div>
  )
}
