/**
 * Парсит отдельную строку лога
 */
export function parseLine(raw) {
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
    const msg = line.msg

    if (msg.includes('🗣️ Ты:')) {
      const text = msg.replace('🗣️ Ты:', '').trim()
      currentGroup = {
        id: line.ts + '-user-' + Math.random(),
        sender: 'user',
        text,
        ts: line.ts ? line.ts.slice(11, 16) : '',
        skills: []
      }
      messages.push(currentGroup)
    } else if (msg.includes('🤖 Джарвис:')) {
      const text = msg.replace('🤖 Джарвис:', '').trim()
      currentGroup = {
        id: line.ts + '-jarvis-' + Math.random(),
        sender: 'jarvis',
        text,
        ts: line.ts ? line.ts.slice(11, 16) : '',
        skills: []
      }
      messages.push(currentGroup)
    } else if (msg.includes('📝 STT:')) {
      // Фолбэк для старых записей
      const text = msg.replace('📝 STT:', '').trim()
      const cleanText = text.replace(/^'|'$/g, '').trim()
      currentGroup = {
        id: line.ts + '-user-' + Math.random(),
        sender: 'user',
        text: cleanText,
        ts: line.ts ? line.ts.slice(11, 16) : '',
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
          ts: line.ts ? line.ts.slice(11, 16) : '',
          skills: []
        })
      }
    }
  })

  // Возвращаем новые сверху
  return messages.reverse()
}

/**
 * Определяет текущий статус ассистента по последней строке лога
 */
export function getAssistantStatus(parsedLines) {
  if (parsedLines.length === 0) return { code: 'idle', label: 'Ожидание' }

  // Берем самую последнюю строчку лога (она первая в parsedLines, так как reverse)
  const lastLine = parsedLines[0]
  const msg = lastLine.msg

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

  return { code: 'idle', label: 'Готов к работе' }
}
