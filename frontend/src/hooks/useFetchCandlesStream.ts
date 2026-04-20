import { useEffect, useState } from 'react'
import { useAppSettings } from '@/lib/appSettings'
import { api } from '@/services/api'
import type { FetchCandlesTask } from '@/types'

export function useFetchCandlesStream() {
  const [tasks, setTasks] = useState<Map<string, FetchCandlesTask>>(new Map())
  const [connected, setConnected] = useState(false)
  const [error, setError] = useState<Error | null>(null)
  const settings = useAppSettings()

  useEffect(() => {
    setTasks(new Map())
    setConnected(true)
    setError(null)

    const cleanup = api.fetchCandles.stream(
      (task: FetchCandlesTask) => {
        setTasks((prev) => {
          const next = new Map(prev)
          next.set(task.id, task)
          return next
        })
      },
      (err) => {
        setError(err)
        setConnected(false)
      }
    )

    return () => {
      cleanup()
      setConnected(false)
    }
  }, [settings.apiBaseUrl])

  return {
    tasks: Array.from(tasks.values()),
    connected,
    error,
  }
}
