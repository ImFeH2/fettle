import { useEffect, useState } from 'react'
import { api } from '@/services/api'
import type { BacktestTask } from '@/types'

export function useBacktestStream() {
  const [tasks, setTasks] = useState<Map<string, BacktestTask>>(new Map())
  const [connected, setConnected] = useState(false)
  const [error, setError] = useState<Error | null>(null)

  useEffect(() => {
    setConnected(true)

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
  }, [])

  return {
    tasks: Array.from(tasks.values()),
    connected,
    error,
  }
}
