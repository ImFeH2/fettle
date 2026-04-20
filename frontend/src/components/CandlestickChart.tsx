import { useEffect, useRef, type ReactNode } from 'react'
import { createChart, CandlestickSeries, createSeriesMarkers, type IChartApi, type ISeriesApi, type CandlestickData, type SeriesMarker, type Time, type ISeriesMarkersPluginApi } from 'lightweight-charts'
import { Loader2 } from 'lucide-react'
import { formatChartTime } from '@/utils/time'
import type { Timeframe } from '@/types'

interface CandlestickChartProps {
  data: CandlestickData[]
  symbol?: string
  markers?: SeriesMarker<Time>[]
  loading?: boolean
  timeframeOptions?: Timeframe[]
  activeTimeframe?: Timeframe | ''
  onTimeframeChange?: (timeframe: Timeframe) => void
  controls?: ReactNode
}

export default function CandlestickChart({
  data,
  symbol,
  markers,
  loading = false,
  timeframeOptions = [],
  activeTimeframe = '',
  onTimeframeChange,
  controls,
}: CandlestickChartProps) {
  const chartContainerRef = useRef<HTMLDivElement>(null)
  const chartRef = useRef<IChartApi | null>(null)
  const seriesRef = useRef<ISeriesApi<'Candlestick'> | null>(null)
  const markersRef = useRef<ISeriesMarkersPluginApi<Time> | null>(null)

  useEffect(() => {
    if (!chartContainerRef.current) return

    const chart = createChart(chartContainerRef.current, {
      layout: {
        background: { color: '#ffffff' },
        textColor: '#333',
      },
      grid: {
        vertLines: { color: '#f0f0f0' },
        horzLines: { color: '#f0f0f0' },
      },
      width: chartContainerRef.current.clientWidth,
      height: 500,
      localization: {
        timeFormatter: (timestamp: number) => formatChartTime(timestamp),
      },
      timeScale: {
        timeVisible: true,
        secondsVisible: false,
        borderColor: '#e0e0e0',
      },
      rightPriceScale: {
        borderColor: '#e0e0e0',
      },
      crosshair: {
        mode: 1,
        vertLine: {
          color: '#9B7DFF',
          width: 1,
          style: 2,
          labelBackgroundColor: '#9B7DFF',
        },
        horzLine: {
          color: '#9B7DFF',
          width: 1,
          style: 2,
          labelBackgroundColor: '#9B7DFF',
        },
      },
    })

    const candlestickSeries = chart.addSeries(CandlestickSeries, {
      upColor: '#22c55e',
      downColor: '#ef4444',
      borderUpColor: '#22c55e',
      borderDownColor: '#ef4444',
      wickUpColor: '#22c55e',
      wickDownColor: '#ef4444',
    })

    chartRef.current = chart
    seriesRef.current = candlestickSeries
    markersRef.current = createSeriesMarkers(candlestickSeries, [])

    const handleResize = () => {
      if (chartContainerRef.current && chartRef.current) {
        chartRef.current.applyOptions({
          width: chartContainerRef.current.clientWidth,
        })
      }
    }

    window.addEventListener('resize', handleResize)

    return () => {
      window.removeEventListener('resize', handleResize)
      chart.remove()
    }
  }, [])

  useEffect(() => {
    if (seriesRef.current && data.length > 0) {
      seriesRef.current.setData(data)
      if (chartRef.current) {
        chartRef.current.timeScale().fitContent()
      }
    }
  }, [data])

  useEffect(() => {
    if (seriesRef.current && markers) {
      if (markersRef.current) {
        markersRef.current.setMarkers(markers)
      } else {
        markersRef.current = createSeriesMarkers(seriesRef.current, markers)
      }
    }
  }, [markers])

  return (
    <div className="bg-white rounded-xl border border-gray-200 p-6">
      {(symbol || controls || timeframeOptions.length > 1) && (
        <div className="flex flex-col gap-4 mb-4 xl:flex-row xl:items-start xl:justify-between">
          <div className="min-w-0">
            {symbol && (
              <h2 className="text-sm font-medium text-gray-900 truncate">{symbol}</h2>
            )}
          </div>

          <div className="flex flex-col gap-3 xl:items-end">
            {timeframeOptions.length > 1 && onTimeframeChange && (
              <div className="flex flex-wrap justify-start gap-2 xl:justify-end">
                {timeframeOptions.map((timeframe) => (
                  <button
                    key={timeframe}
                    type="button"
                    onClick={() => onTimeframeChange(timeframe)}
                    className={`px-3 py-1.5 rounded-full border text-xs font-medium transition-colors ${activeTimeframe === timeframe
                      ? 'border-gray-900 bg-gray-900 text-white'
                      : 'border-gray-200 bg-white text-gray-600 hover:border-gray-300 hover:text-gray-900'
                      }`}
                  >
                    {timeframe}
                  </button>
                ))}
              </div>
            )}

            {controls && (
              <div className="flex flex-wrap justify-start gap-2 xl:justify-end">
                {controls}
              </div>
            )}
          </div>
        </div>
      )}

      <div className="relative">
        <div ref={chartContainerRef} className="w-full" />

        {loading && (
          <div className="absolute inset-0 flex items-center justify-center bg-white/75 backdrop-blur-sm rounded-lg">
            <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full border border-gray-200 bg-white text-sm font-medium text-gray-700 shadow-sm">
              <Loader2 className="w-4 h-4 animate-spin" />
              Loading chart
            </div>
          </div>
        )}
      </div>

      {data.length === 0 && !loading && (
        <div className="flex items-center justify-center h-[500px] text-sm text-gray-500">
          No data available
        </div>
      )}
    </div>
  )
}
