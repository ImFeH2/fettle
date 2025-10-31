import { useEffect, useRef } from 'react'
import { createChart, CandlestickSeries, type IChartApi, type ISeriesApi, type CandlestickData } from 'lightweight-charts'

interface CandlestickChartProps {
  data: CandlestickData[]
  symbol?: string
}

export default function CandlestickChart({ data, symbol }: CandlestickChartProps) {
  const chartContainerRef = useRef<HTMLDivElement>(null)
  const chartRef = useRef<IChartApi | null>(null)
  const seriesRef = useRef<ISeriesApi<'Candlestick'> | null>(null)

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

  return (
    <div className="bg-white rounded-xl border border-gray-200 p-6">
      {symbol && (
        <h2 className="text-sm font-medium text-gray-900 mb-4">{symbol}</h2>
      )}
      <div ref={chartContainerRef} className="w-full" />
      {data.length === 0 && (
        <div className="flex items-center justify-center h-[500px] text-sm text-gray-500">
          No data available
        </div>
      )}
    </div>
  )
}
