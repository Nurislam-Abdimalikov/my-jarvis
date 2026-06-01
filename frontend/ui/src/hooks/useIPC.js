'use client'
import { useState, useEffect } from 'react'

/**
 * Проверяет, доступен ли Electron IPC (window.jarvis).
 * Если нет — возвращает false (браузерная среда).
 */
export function isElectron() {
  return typeof window !== 'undefined' && typeof window.jarvis !== 'undefined'
}

/**
 * Хук для вызова Electron IPC handler'а.
 * @param {string} method — имя метода на window.jarvis
 * @param {any[]} args — аргументы
 * @param {any} fallback — дефолтное значение
 */
export function useIPC(method, args = [], fallback = null) {
  const [data, setData] = useState(fallback)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)

  useEffect(() => {
    let cancelled = false

    async function fetch() {
      try {
        setLoading(true)
        setError(null)
        let result
        if (isElectron()) {
          result = await window.jarvis[method](...args)
        } else {
          // Dev fallback — mock data
          result = fallback
        }
        if (!cancelled) setData(result)
      } catch (err) {
        if (!cancelled) setError(err.message)
      } finally {
        if (!cancelled) setLoading(false)
      }
    }

    fetch()
    return () => { cancelled = true }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [method])

  return { data, loading, error, refetch: () => {} }
}
