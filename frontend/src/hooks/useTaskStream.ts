import { useEffect, useRef, useState } from 'react'
import { api } from '@/services/api'
import type { Task, TaskEvent } from '@/types'

export function useTaskStream() {
  const [tasks, setTasks] = useState<Map<string, Task>>(new Map())
  const [connected, setConnected] = useState(false)
  const [error, setError] = useState<Error | null>(null)
  const cleanupRef = useRef<(() => void) | null>(null)

  useEffect(() => {
    setConnected(true)

    const cleanup = api.tasks.stream(
      (event: TaskEvent) => {
        setTasks((prev) => {
          const next = new Map(prev)

          switch (event.type) {
            case 'create':
              next.set(event.task.id, event.task)
              break

            case 'progress': {
              const task = next.get(event.task_id)
              if (task) {
                next.set(event.task_id, {
                  ...task,
                  progress: event.progress,
                  status: event.status,
                  updated_at: Date.now(),
                })
              }
              break
            }

            case 'status': {
              const task = next.get(event.task_id)
              if (task) {
                next.set(event.task_id, {
                  ...task,
                  status: event.status,
                  updated_at: Date.now(),
                })
              }
              break
            }

            case 'complete': {
              const task = next.get(event.task_id)
              if (task) {
                next.set(event.task_id, {
                  ...task,
                  status: 'completed',
                  result: event.result,
                  completed_at: Date.now(),
                  updated_at: Date.now(),
                })
              }
              break
            }

            case 'fail': {
              const task = next.get(event.task_id)
              if (task) {
                next.set(event.task_id, {
                  ...task,
                  status: 'failed',
                  error_message: event.error,
                  updated_at: Date.now(),
                })
              }
              break
            }
          }

          return next
        })
      },
      (err) => {
        setError(err)
        setConnected(false)
      }
    )

    cleanupRef.current = cleanup

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
