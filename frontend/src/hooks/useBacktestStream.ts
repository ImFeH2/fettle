import { useEffect, useState } from 'react'
import { useAppSettings } from '@/lib/appSettings'
import { api } from '@/services/api'
import type { BacktestTask } from '@/types'

export function useBacktestStream() {
  const [tasks, setTasks] = useState<Map<string, BacktestTask>>(new Map())
  const [connected, setConnected] = useState(false)
  const [error, setError] = useState<Error | null>(null)
  const settings = useAppSettings()

  useEffect(() => {
    setTasks(new Map())
    setConnected(true)
    setError(null)

    const cleanup = api.backtest.stream(
      (task: BacktestTask) => {
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
