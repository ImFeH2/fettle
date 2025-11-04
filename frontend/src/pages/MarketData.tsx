import { useEffect, useState, useRef } from 'react'
import { Download, Search, Clock, CheckCircle, XCircle, Loader, BarChart3 } from 'lucide-react'
import { api } from '@/services/api'
import { useFetchCandlesStream } from '@/hooks/useFetchCandlesStream'
import ComboBox from '@/components/ComboBox'
import CandlestickChart from '@/components/CandlestickChart'
import type { Timeframe, FetchCandlesTask, AvailableCandleInfo, Candle } from '@/types'
import type { CandlestickData } from 'lightweight-charts'

export default function MarketData() {
  const [exchanges, setExchanges] = useState<string[]>([])
  const [selectedExchange, setSelectedExchange] = useState<string>('')
  const [symbols, setSymbols] = useState<string[]>([])
  const [timeframes, setTimeframes] = useState<Timeframe[]>([])
  const [searchQuery, setSearchQuery] = useState('')
  const [loading, setLoading] = useState(false)

  const [selectedSymbol, setSelectedSymbol] = useState<string>('')
  const [selectedTimeframe, setSelectedTimeframe] = useState<Timeframe | ''>('')
  const [creating, setCreating] = useState(false)
  const creatingRef = useRef(false)
  const abortControllerRef = useRef<AbortController | null>(null)

  const [availableData, setAvailableData] = useState<AvailableCandleInfo[]>([])
  const [chartData, setChartData] = useState<CandlestickData[]>([])
  const [loadingChart, setLoadingChart] = useState(false)
  const [selectedData, setSelectedData] = useState<AvailableCandleInfo | null>(null)

  const { tasks, connected } = useFetchCandlesStream()

  useEffect(() => {
    loadExchanges()
    loadAvailableData()
  }, [])

  useEffect(() => {
    if (selectedExchange) {
      loadExchangeData()
    }
  }, [selectedExchange])

  const loadExchanges = async () => {
    try {
      setLoading(true)
      const data = await api.exchanges.list()
      setExchanges(data)
      if (data.length > 0) {
        setSelectedExchange(data[0])
      }
    } catch (error) {
      console.error('Failed to load exchanges:', error)
    } finally {
      setLoading(false)
    }
  }

  const loadExchangeData = async () => {
    try {
      setLoading(true)
      const [symbolsData, timeframesData] = await Promise.all([
        api.symbols.list(selectedExchange),
        api.timeframes.list(selectedExchange),
      ])
      setSymbols(symbolsData)
      setTimeframes(timeframesData)

      if (symbolsData.length > 0) {
        setSelectedSymbol(symbolsData[0])
      }

      const tfKeys = Object.keys(timeframesData) as Timeframe[]
      if (tfKeys.length > 0) {
        setSelectedTimeframe(tfKeys[0])
      }
    } catch (error) {
      console.error('Failed to load exchange data:', error)
    } finally {
      setLoading(false)
    }
  }

  const loadAvailableData = async () => {
    try {
      const data = await api.candles.available()
      setAvailableData(data)
      if (data.length > 0 && !selectedData) {
        loadChartData(data[0])
      }
    } catch (error) {
      console.error('Failed to load available data:', error)
    }
  }

  const loadChartData = async (info: AvailableCandleInfo) => {
    try {
      setLoadingChart(true)
      setSelectedData(info)
      const candles = await api.candles.get({
        exchange: info.exchange,
        symbol: info.symbol,
        timeframe: info.timeframe,
      })

      const formattedData: CandlestickData[] = candles.map((candle: Candle) => ({
        time: (candle.timestamp / 1000) as any,
        open: parseFloat(candle.open),
        high: parseFloat(candle.high),
        low: parseFloat(candle.low),
        close: parseFloat(candle.close),
      }))

      setChartData(formattedData)
    } catch (error) {
      console.error('Failed to load chart data:', error)
    } finally {
      setLoadingChart(false)
    }
  }

  const createFetchTask = async () => {
    if (!selectedSymbol || !selectedTimeframe) return
    if (creatingRef.current) return

    if (abortControllerRef.current) {
      abortControllerRef.current.abort()
    }

    abortControllerRef.current = new AbortController()

    try {
      creatingRef.current = true
      setCreating(true)
      await api.fetchCandles.create({
        exchange: selectedExchange,
        symbol: selectedSymbol,
        timeframe: selectedTimeframe,
      })
      setTimeout(loadAvailableData, 2000)
    } catch (error) {
      console.error('Failed to create fetch task:', error)
    } finally {
      creatingRef.current = false
      setCreating(false)
      abortControllerRef.current = null
    }
  }

  const filteredSymbols = symbols.filter((symbol) =>
    symbol.toLowerCase().includes(searchQuery.toLowerCase())
  )

  const fetchTasks = tasks

  const getTaskStatusIcon = (task: FetchCandlesTask) => {
    switch (task.status) {
      case 'pending':
        return <Clock className="w-4 h-4 text-gray-400" />
      case 'running':
        return <Loader className="w-4 h-4 text-blue-500 animate-spin" />
      case 'completed':
        return <CheckCircle className="w-4 h-4 text-green-500" />
      case 'failed':
        return <XCircle className="w-4 h-4 text-red-500" />
    }
  }

  return (
    <div className="h-full overflow-y-auto">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="mb-6">
          <h1 className="text-2xl font-medium text-gray-900 mb-1">Market Data</h1>
          <p className="text-sm text-gray-500">Download and visualize historical market data</p>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
          <div className="lg:col-span-3 space-y-6">
            {loadingChart ? (
              <div className="bg-white rounded-xl border border-gray-200 p-6">
                <div className="flex items-center justify-center h-[500px]">
                  <Loader className="w-8 h-8 text-gray-400 animate-spin" />
                </div>
              </div>
            ) : chartData.length > 0 && selectedData ? (
              <CandlestickChart
                data={chartData}
                symbol={`${selectedData.symbol} (${selectedData.exchange} - ${selectedData.timeframe})`}
              />
            ) : (
              <div className="bg-white rounded-xl border border-gray-200 p-6">
                <div className="flex flex-col items-center justify-center h-[500px] text-center">
                  <BarChart3 className="w-12 h-12 text-gray-300 mb-3" />
                  <p className="text-sm font-medium text-gray-900 mb-1">No Data Available</p>
                  <p className="text-sm text-gray-500">Download data to view charts</p>
                </div>
              </div>
            )}

            <div className="bg-white rounded-xl border border-gray-200 p-6">
              <h2 className="text-sm font-medium text-gray-900 mb-4">Download Market Data</h2>

              <div className="space-y-4">
                <div>
                  <label className="block text-xs font-medium text-gray-700 mb-2">Exchange</label>
                  {loading && exchanges.length === 0 ? (
                    <div className="flex items-center justify-center py-8">
                      <Loader className="w-6 h-6 text-gray-400 animate-spin" />
                    </div>
                  ) : (
                    <ComboBox
                      options={exchanges}
                      value={selectedExchange}
                      onChange={setSelectedExchange}
                      placeholder="Select exchange..."
                      searchPlaceholder="Search exchanges..."
                    />
                  )}
                </div>

                {selectedExchange && (
                  <>
                    <div>
                      <label className="block text-xs font-medium text-gray-700 mb-2">Symbol</label>
                      <div className="relative mb-3">
                        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                        <input
                          type="text"
                          placeholder="Search symbols..."
                          value={searchQuery}
                          onChange={(e) => setSearchQuery(e.target.value)}
                          className="w-full pl-10 pr-4 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-gray-900 focus:border-transparent"
                        />
                      </div>

                      <div className="max-h-64 overflow-y-auto border border-gray-200 rounded-lg">
                        {loading ? (
                          <div className="flex items-center justify-center py-8">
                            <Loader className="w-5 h-5 text-gray-400 animate-spin" />
                          </div>
                        ) : (
                          filteredSymbols.map((symbol) => (
                            <button
                              key={symbol}
                              onClick={() => setSelectedSymbol(symbol)}
                              className={`w-full px-4 py-2 text-left text-sm transition-colors ${selectedSymbol === symbol
                                ? 'bg-gray-100 text-gray-900 font-medium'
                                : 'text-gray-700 hover:bg-gray-50'
                                }`}
                            >
                              {symbol}
                            </button>
                          ))
                        )}
                      </div>
                    </div>

                    <div>
                      <label className="block text-xs font-medium text-gray-700 mb-2">Timeframe</label>
                      <div className="grid grid-cols-4 sm:grid-cols-6 gap-2">
                        {timeframes.map((tf) => (
                          <button
                            key={tf}
                            onClick={() => setSelectedTimeframe(tf as Timeframe)}
                            className={`px-3 py-2 rounded-lg text-sm font-medium transition-colors ${selectedTimeframe === tf
                              ? 'bg-gray-900 text-white'
                              : 'bg-gray-50 text-gray-700 hover:bg-gray-100'
                              }`}
                          >
                            {tf}
                          </button>
                        ))}
                      </div>
                    </div>

                    <button
                      onClick={createFetchTask}
                      disabled={!selectedSymbol || !selectedTimeframe || creating}
                      className="w-full flex items-center justify-center gap-2 px-4 py-2 bg-gray-900 text-white rounded-lg text-sm font-medium hover:bg-gray-800 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                    >
                      {creating ? (
                        <Loader className="w-4 h-4 animate-spin" />
                      ) : (
                        <Download className="w-4 h-4" />
                      )}
                      Download Data
                    </button>
                  </>
                )}
              </div>
            </div>
          </div>

          <div className="space-y-6">
            <div className="bg-white rounded-xl border border-gray-200 p-6">
              <h2 className="text-sm font-medium text-gray-900 mb-4">Available Data</h2>
              {availableData.length === 0 ? (
                <div className="text-center py-8">
                  <p className="text-sm text-gray-500">No data available</p>
                </div>
              ) : (
                <div className="space-y-2">
                  {availableData.map((info) => (
                    <button
                      key={`${info.exchange}-${info.symbol}-${info.timeframe}`}
                      onClick={() => loadChartData(info)}
                      className={`w-full p-3 border rounded-lg text-left transition-colors ${selectedData?.exchange === info.exchange &&
                        selectedData?.symbol === info.symbol &&
                        selectedData?.timeframe === info.timeframe
                        ? 'border-gray-900 bg-gray-50'
                        : 'border-gray-200 hover:border-gray-300'
                        }`}
                    >
                      <p className="text-sm font-medium text-gray-900 truncate">
                        {info.symbol}
                      </p>
                      <p className="text-xs text-gray-500">
                        {info.exchange} · {info.timeframe}
                      </p>
                      <p className="text-xs text-gray-400 mt-1">
                        {Number(info.count).toLocaleString()} candles
                      </p>
                    </button>
                  ))}
                </div>
              )}
            </div>

            <div className="bg-white rounded-xl border border-gray-200 p-6">
              <div className="flex items-center justify-between mb-4">
                <h2 className="text-sm font-medium text-gray-900">Download Tasks</h2>
                <div className={`flex items-center gap-2 text-xs ${connected ? 'text-green-600' : 'text-gray-400'
                  }`}>
                  <div className={`w-2 h-2 rounded-full ${connected ? 'bg-green-500' : 'bg-gray-300'
                    }`} />
                  {connected ? 'Connected' : 'Disconnected'}
                </div>
              </div>

              {fetchTasks.length === 0 ? (
                <div className="text-center py-8">
                  <p className="text-sm text-gray-500">No download tasks yet</p>
                </div>
              ) : (
                <div className="space-y-3">
                  {fetchTasks.map((task) => (
                    <div
                      key={task.id}
                      className="p-3 border border-gray-200 rounded-lg"
                    >
                      <div className="flex items-start justify-between mb-2">
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-medium text-gray-900 truncate">
                            {task.symbol}
                          </p>
                          <p className="text-xs text-gray-500">
                            {task.exchange} · {task.timeframe}
                          </p>
                        </div>
                        {getTaskStatusIcon(task)}
                      </div>

                      {task.status === 'running' && (
                        <div className="mt-2">
                          <div className="flex justify-between text-xs text-gray-600 mb-1">
                            <span>Progress</span>
                            <span>{Math.round(task.progress)}%</span>
                          </div>
                          <div className="h-1.5 bg-gray-100 rounded-full overflow-hidden">
                            <div
                              className="h-full bg-blue-500 transition-all duration-300"
                              style={{ width: `${task.progress}%` }}
                            />
                          </div>
                        </div>
                      )}

                      {task.status === 'failed' && task.error_message && (
                        <p className="mt-2 text-xs text-red-600">{task.error_message}</p>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
