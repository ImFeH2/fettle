import { toast } from 'sonner'
import type {
  Candle,
  CreateFetchCandlesTaskRequest,
  CreateFetchCandlesTaskResponse,
  CreateBacktestTaskRequest,
  CreateBacktestTaskResponse,
  ErrorResponse,
  FetchCandlesTask,
  BacktestTask,
  Timeframe,
  GetSourceResponse,
  GetSourceQuery,
  SaveSourceQuery,
  DeleteSourceQuery,
  MoveSourceQuery,
  AddStrategyRequest,
  AvailableCandleInfo,
  ListStrategiesResponse
} from '@/types'

const API_BASE_URL = 'http://localhost:3001'

class ApiError extends Error {
  public error: string
  public status: number

  constructor(error: string, message: string, status: number) {
    super(message)
    this.name = 'ApiError'
    this.error = error
    this.status = status
  }
}

async function fetchAPI<T>(endpoint: string, options?: RequestInit): Promise<T> {
  try {
    const response = await fetch(`${API_BASE_URL}${endpoint}`, {
      ...options,
      headers: {
        'Content-Type': 'application/json',
        ...options?.headers,
      },
    })

    if (!response.ok) {
      const error: ErrorResponse = await response.json()
      const apiError = new ApiError(error.error, error.message, response.status)

      toast.error('API Error', {
        description: error.message,
        duration: 5000,
      })

      throw apiError
    }

    return response.json()
  } catch (error) {
    if (error instanceof ApiError) {
      throw error
    }

    toast.error('Network Error', {
      description: error instanceof Error ? error.message : 'Failed to connect to server',
      duration: 5000,
    })

    throw error
  }
}

export const api = {
  health: {
    check: () => fetchAPI<string>('/health'),
  },

  exchanges: {
    list: () => fetchAPI<string[]>('/exchanges'),
  },

  symbols: {
    list: (exchange: string) =>
      fetchAPI<string[]>(`/symbols?exchange=${encodeURIComponent(exchange)}`),
  },

  timeframes: {
    list: (exchange: string) =>
      fetchAPI<Timeframe[]>(`/timeframes?exchange=${encodeURIComponent(exchange)}`),
  },

  fetchCandles: {
    getAll: () => fetchAPI<FetchCandlesTask[]>('/tasks/fetch'),

    getById: (id: string) => fetchAPI<FetchCandlesTask>(`/tasks/fetch/${id}`),

    create: (request: CreateFetchCandlesTaskRequest) =>
      fetchAPI<CreateFetchCandlesTaskResponse>('/tasks/fetch', {
        method: 'POST',
        body: JSON.stringify(request),
      }),

    stream: (onEvent: (task: FetchCandlesTask) => void, onError?: (error: Error) => void) => {
      const eventSource = new EventSource(`${API_BASE_URL}/tasks/fetch/stream`)

      eventSource.onmessage = (event) => {
        try {
          const task: FetchCandlesTask = JSON.parse(event.data)
          onEvent(task)
        } catch (error) {
          console.error('Failed to parse fetch candles event:', error)
          toast.error('Stream Error', {
            description: 'Failed to parse event data',
          })
        }
      }

      eventSource.onerror = (error) => {
        console.error('SSE connection error:', error)
        toast.error('Connection Error', {
          description: 'Lost connection to fetch candles stream',
        })
        onError?.(new Error('SSE connection failed'))
      }

      return () => {
        eventSource.close()
      }
    },
  },

  backtest: {
    getAll: () => fetchAPI<BacktestTask[]>('/tasks/backtest'),

    getById: (id: string) => fetchAPI<BacktestTask>(`/tasks/backtest/${id}`),

    create: (request: CreateBacktestTaskRequest) =>
      fetchAPI<CreateBacktestTaskResponse>('/tasks/backtest', {
        method: 'POST',
        body: JSON.stringify(request),
      }),

    stream: (onEvent: (task: BacktestTask) => void, onError?: (error: Error) => void) => {
      const eventSource = new EventSource(`${API_BASE_URL}/tasks/backtest/stream`)

      eventSource.onmessage = (event) => {
        try {
          const task: BacktestTask = JSON.parse(event.data)
          onEvent(task)
        } catch (error) {
          console.error('Failed to parse backtest event:', error)
          toast.error('Stream Error', {
            description: 'Failed to parse event data',
          })
        }
      }

      eventSource.onerror = (error) => {
        console.error('SSE connection error:', error)
        toast.error('Connection Error', {
          description: 'Lost connection to backtest stream',
        })
        onError?.(new Error('SSE connection failed'))
      }

      return () => {
        eventSource.close()
      }
    },
  },

  candles: {
    get: (params: {
      exchange: string
      symbol: string
      timeframe: Timeframe
      start?: number
      end?: number
    }) => {
      const query = new URLSearchParams({
        exchange: params.exchange,
        symbol: params.symbol,
        timeframe: params.timeframe,
        ...(params.start && { start: params.start.toString() }),
        ...(params.end && { end: params.end.toString() }),
      })
      return fetchAPI<Candle[]>(`/candles?${query}`)
    },

    available: () => fetchAPI<AvailableCandleInfo[]>('/candles/available'),
  },

  source: {
    get: (query: GetSourceQuery) =>
      fetchAPI<GetSourceResponse>(`/strategy/source/get?path=${encodeURIComponent(query.path)}`),

    save: (query: SaveSourceQuery, content: string) =>
      fetchAPI<void>(`/strategy/source/save?path=${encodeURIComponent(query.path)}`, {
        method: 'POST',
        body: JSON.stringify(content),
      }),

    delete: (query: DeleteSourceQuery) =>
      fetchAPI<void>(`/strategy/source/delete?path=${encodeURIComponent(query.path)}`),

    move: (query: MoveSourceQuery) =>
      fetchAPI<void>(`/strategy/source/move?old_path=${encodeURIComponent(query.old_path)}&new_path=${encodeURIComponent(query.new_path)}`),
  },

  strategy: {
    list: () => fetchAPI<ListStrategiesResponse>('/strategy/list'),

    add: (request: AddStrategyRequest) =>
      fetchAPI<void>('/strategy/add', {
        method: 'POST',
        body: JSON.stringify(request),
      }),
  },
}

export { ApiError }
