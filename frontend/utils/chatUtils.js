/**
 * Форматирует структурированное событие JSON в текстовую строку,
 * аналогичную старому формату логов. Это необходимо для корректного поиска,
 * фильтрации и отображения в режиме "Логи разработчика" (LogTable).
 */
function formatEventMessage(event) {
  switch (event.type) {
    case 'status':
      if (event.status === 'listening') return '🟢 Слушаю фоном'
      if (event.status === 'recording') return '🎙️ Запись речи...'
      if (event.status === 'processing') return '⚙️ Обработка запроса...'
      if (event.status === 'speaking') return '🔊 Джарвис отвечает...'
      return `Статус: ${event.status}`
    case 'user_message':
      return `🗣️ Ты: ${event.text}`
    case 'assistant_message':
      return `🤖 Джарвис: ${event.text}`
    case 'stt_result':
      return `📝 STT: '${event.text}' (lang=${event.language || 'ru'}, ${event.duration ? event.duration.toFixed(1) : '0.0'}s)`
    case 'skills_call':
      return `🔧 Tool calls: [${(event.names || []).map(n => `'${n}'`).join(', ')}]`
    case 'skill_result':
      return `   → ${event.name} (${event.success ? '✓' : '✗'}): ${event.message}`
    default:
      return JSON.stringify(event)
  }
}

/**
 * Парсит отдельную строку лога (поддерживает как JSONL, так и старый plain-text формат)
 */
export function parseLine(raw) {
  try {
    const parsed = JSON.parse(raw)
    if (parsed && typeof parsed === 'object' && parsed.type) {
      return {
        raw,
        ts: parsed.ts ? parsed.ts.replace('T', ' ') : '',
        level: parsed.type === 'error' ? 'ERROR' : 'INFO',
        module: 'event_logger',
        msg: formatEventMessage(parsed),
        event: parsed
      }
    }
  } catch (e) {
    // Игнорируем ошибку парсинга JSON, пробуем старый формат регулярным выражением
  }

  const m = raw.match(/^(\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2}\.\d+)\s*\|\s*(\w+)\s*\|\s*(.+?)\s*-\s*(.+)$/)
  if (!m) return { raw, ts: '', level: 'INFO', module: '', msg: raw }
  return { raw, ts: m[1], level: m[2].trim(), module: m[3].trim(), msg: m[4].trim() }
}

/**
 * Группирует спарсенные строки лога в структурированные сообщения чата
 */
export function buildChatMessages(parsedLines) {
  const messages = []
  let currentGroup = null

  // Парсим логи снизу вверх (в хронологическом порядке)
  const chronological = [...parsedLines].reverse()

  chronological.forEach((line) => {
    if (line.event) {
      const event = line.event
      const ts = event.ts ? event.ts.replace('T', ' ') : ''
      const timeStr = ts ? ts.slice(11, 16) : ''

      if (event.type === 'user_message') {
        currentGroup = {
          id: (event.ts || '') + '-user-' + Math.random(),
          sender: 'user',
          text: event.text || '',
          ts: timeStr,
          skills: []
        }
        messages.push(currentGroup)
      } else if (event.type === 'assistant_message') {
        currentGroup = {
          id: (event.ts || '') + '-jarvis-' + Math.random(),
          sender: 'jarvis',
          text: event.text || '',
          ts: timeStr,
          skills: []
        }
        messages.push(currentGroup)
      } else if (event.type === 'stt_result') {
        // Фолбэк для обратной совместимости, если нет события user_message
        if (!currentGroup || currentGroup.sender !== 'user') {
          currentGroup = {
            id: (event.ts || '') + '-user-stt-' + Math.random(),
            sender: 'user',
            text: event.text || '',
            ts: timeStr,
            skills: []
          }
          messages.push(currentGroup)
        }
      } else if (event.type === 'skill_result') {
        const skillName = event.name || 'skill'
        const isSuccess = event.success !== false
        const cleanMsg = event.message || ''

        if (currentGroup) {
          currentGroup.skills.push({
            name: skillName,
            success: isSuccess,
            message: cleanMsg
          })
        } else {
          messages.push({
            id: (event.ts || '') + '-sys-' + Math.random(),
            sender: 'system',
            text: `${isSuccess ? '✓' : '✗'} [${skillName}] ${cleanMsg}`,
            ts: timeStr,
            skills: []
          })
        }
      }
    } else {
      // Старая логика парсинга plain-text строк
      const msg = line.msg
      const timeStr = line.ts ? line.ts.slice(11, 16) : ''

      if (msg.includes('🗣️ Ты:')) {
        const text = msg.replace('🗣️ Ты:', '').trim()
        currentGroup = {
          id: line.ts + '-user-' + Math.random(),
          sender: 'user',
          text,
          ts: timeStr,
          skills: []
        }
        messages.push(currentGroup)
      } else if (msg.includes('🤖 Джарвис:')) {
        const text = msg.replace('🤖 Джарвис:', '').trim()
        currentGroup = {
          id: line.ts + '-jarvis-' + Math.random(),
          sender: 'jarvis',
          text,
          ts: timeStr,
          skills: []
        }
        messages.push(currentGroup)
      } else if (msg.includes('📝 STT:')) {
        const text = msg.replace('📝 STT:', '').trim()
        const cleanText = text.replace(/^'|'$/g, '').trim()
        currentGroup = {
          id: line.ts + '-user-' + Math.random(),
          sender: 'user',
          text: cleanText,
          ts: timeStr,
          skills: []
        }
        messages.push(currentGroup)
      } else if (msg.includes('→') && (msg.includes('(✓)') || msg.includes('(✗)'))) {
        const isSuccess = msg.includes('(✓)')
        const cleanMsg = msg.replace(/.*?→\s*\w+\s*\([✓✗]\):\s*/, '').trim()
        const skillNameMatch = msg.match(/→\s*(\w+)/)
        const skillName = skillNameMatch ? skillNameMatch[1] : 'skill'

        if (currentGroup) {
          currentGroup.skills.push({
            name: skillName,
            success: isSuccess,
            message: cleanMsg
          })
        } else {
          messages.push({
            id: line.ts + '-sys-' + Math.random(),
            sender: 'system',
            text: `${isSuccess ? '✓' : '✗'} [${skillName}] ${cleanMsg}`,
            ts: timeStr,
            skills: []
          })
        }
      }
    }
  })

  // Возвращаем новые сверху
  return messages.reverse()
}

/**
 * Определяет текущий статус ассистента по последней записи о статусе в логе
 */
export function getAssistantStatus(parsedLines) {
  if (!parsedLines || parsedLines.length === 0) return { code: 'idle', label: 'Ожидание' }

  // 1. Пытаемся найти событие статуса в новых логах (JSON)
  const statusEvent = parsedLines.find(l => l.event && l.event.type === 'status')
  if (statusEvent && statusEvent.event && statusEvent.event.status) {
    const code = statusEvent.event.status
    let label = 'Готов к работе'
    if (code === 'listening') label = 'Слушаю фоном...'
    if (code === 'recording') label = 'Запись речи...'
    if (code === 'processing') label = 'Обработка запроса...'
    if (code === 'speaking') label = 'Джарвис отвечает...'
    return { code, label }
  }

  // 2. Если событий статуса не найдено (или это старый plain-text лог),
  // делаем фолбэк по строковому совпадению
  for (const line of parsedLines) {
    const msg = line.msg
    if (msg.includes('🟢 Слушаю фоном')) {
      return { code: 'listening', label: 'Слушаю фоном...' }
    }
    if (msg.includes('Слушаю команду') || msg.includes('Записал команду')) {
      return { code: 'recording', label: 'Запись речи...' }
    }
    if (msg.includes('STT:') || msg.includes('Tool calls') || msg.includes('→')) {
      return { code: 'processing', label: 'Обработка запроса...' }
    }
    if (msg.includes('🤖 Джарвис:')) {
      return { code: 'speaking', label: 'Джарвис отвечает...' }
    }
  }

  return { code: 'idle', label: 'Готов к работе' }
}
