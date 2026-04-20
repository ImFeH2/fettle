import { useCallback, useEffect, useRef, useState, type ReactNode } from 'react'
import { createChart, CandlestickSeries, HistogramSeries, LineSeries, createSeriesMarkers, type HistogramData, type IChartApi, type ISeriesApi, type CandlestickData, type LineData, type MouseEventHandler, type SeriesMarker, type Time, type ISeriesMarkersPluginApi } from 'lightweight-charts'
import { Loader2, Minus, Plus, RotateCcw } from 'lucide-react'
import { formatChartTime } from '@/utils/time'
import type { Timeframe } from '@/types'

interface CandlestickChartProps {
  data: CandlestickData[]
  volumeData?: HistogramData<Time>[]
  symbol?: string
  markers?: SeriesMarker<Time>[]
  markerDetails?: ChartMarkerDetail[]
  loading?: boolean
  timeframeOptions?: Timeframe[]
  activeTimeframe?: Timeframe | ''
  onTimeframeChange?: (timeframe: Timeframe) => void
  controls?: ReactNode
}

export interface ChartMarkerDetail {
  id: string
  title: string
  accentColor: string
  fields: Array<{
    label: string
    value: string
  }>
}

const indicatorConfigs = [
  {
    id: 'ma20',
    label: 'MA 20',
    period: 20,
    mode: 'simple',
    color: '#f59e0b',
    activeClassName: 'border-amber-300 bg-amber-50 text-amber-700',
  },
  {
    id: 'ma50',
    label: 'MA 50',
    period: 50,
    mode: 'simple',
    color: '#f97316',
    activeClassName: 'border-orange-300 bg-orange-50 text-orange-700',
  },
  {
    id: 'ema20',
    label: 'EMA 20',
    period: 20,
    mode: 'exponential',
    color: '#3b82f6',
    activeClassName: 'border-blue-300 bg-blue-50 text-blue-700',
  },
  {
    id: 'ema50',
    label: 'EMA 50',
    period: 50,
    mode: 'exponential',
    color: '#8b5cf6',
    activeClassName: 'border-violet-300 bg-violet-50 text-violet-700',
  },
] as const

type IndicatorId = (typeof indicatorConfigs)[number]['id']

function buildMovingAverageData(
  data: CandlestickData[],
  period: number,
  mode: 'simple' | 'exponential'
): LineData<Time>[] {
  if (!Number.isFinite(period) || period <= 0 || data.length < period) {
    return []
  }

  const closes = data.map((item) => item.close)
  const result: LineData<Time>[] = []

  if (mode === 'simple') {
    let rollingSum = closes.slice(0, period).reduce((sum, value) => sum + value, 0)
    result.push({
      time: data[period - 1].time,
      value: rollingSum / period,
    })

    for (let index = period; index < closes.length; index += 1) {
      rollingSum += closes[index] - closes[index - period]
      result.push({
        time: data[index].time,
        value: rollingSum / period,
      })
    }

    return result
  }

  const multiplier = 2 / (period + 1)
  let previous = closes.slice(0, period).reduce((sum, value) => sum + value, 0) / period

  result.push({
    time: data[period - 1].time,
    value: previous,
  })

  for (let index = period; index < closes.length; index += 1) {
    previous = (closes[index] - previous) * multiplier + previous
    result.push({
      time: data[index].time,
      value: previous,
    })
  }

  return result
}

export default function CandlestickChart({
  data,
  volumeData = [],
  symbol,
  markers,
  markerDetails = [],
  loading = false,
  timeframeOptions = [],
  activeTimeframe = '',
  onTimeframeChange,
  controls,
}: CandlestickChartProps) {
  const chartContainerRef = useRef<HTMLDivElement>(null)
  const chartSurfaceRef = useRef<HTMLDivElement>(null)
  const chartRef = useRef<IChartApi | null>(null)
  const seriesRef = useRef<ISeriesApi<'Candlestick'> | null>(null)
  const volumeSeriesRef = useRef<ISeriesApi<'Histogram'> | null>(null)
  const markersRef = useRef<ISeriesMarkersPluginApi<Time> | null>(null)
  const indicatorSeriesRef = useRef(new Map<IndicatorId, ISeriesApi<'Line'>>())
  const [enabledIndicators, setEnabledIndicators] = useState<IndicatorId[]>([])
  const [showVolume, setShowVolume] = useState(true)
  const [markerTooltip, setMarkerTooltip] = useState<{
    detail: ChartMarkerDetail
    left: number
    top: number
  } | null>(null)

  const toggleIndicator = useCallback((indicatorId: IndicatorId) => {
    setEnabledIndicators((prev) =>
      prev.includes(indicatorId)
        ? prev.filter((item) => item !== indicatorId)
        : [...prev, indicatorId]
    )
  }, [])

  const adjustZoom = useCallback((factor: number) => {
    const chart = chartRef.current
    if (!chart) {
      return
    }

    const timeScale = chart.timeScale()
    const range = timeScale.getVisibleLogicalRange()

    if (!range) {
      timeScale.fitContent()
      return
    }

    const center = (range.from + range.to) / 2
    const nextSpan = Math.max(10, (range.to - range.from) * factor)

    timeScale.setVisibleLogicalRange({
      from: center - nextSpan / 2,
      to: center + nextSpan / 2,
    })
  }, [])

  const resetView = useCallback(() => {
    chartRef.current?.timeScale().fitContent()
  }, [])

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

    const volumeSeries = chart.addSeries(HistogramSeries, {
      priceFormat: {
        type: 'volume',
      },
      priceScaleId: '',
      lastValueVisible: false,
      priceLineVisible: false,
    })

    volumeSeries.priceScale().applyOptions({
      scaleMargins: {
        top: 0.78,
        bottom: 0,
      },
    })

    chartRef.current = chart
    seriesRef.current = candlestickSeries
    volumeSeriesRef.current = volumeSeries
    markersRef.current = createSeriesMarkers(candlestickSeries, [])
    const indicatorSeries = indicatorSeriesRef.current

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
      indicatorSeries.clear()
      chart.remove()
    }
  }, [])

  useEffect(() => {
    if (!seriesRef.current) {
      return
    }

    seriesRef.current.setData(data)

    if (chartRef.current && data.length > 0) {
      chartRef.current.timeScale().fitContent()
    }
  }, [data])

  useEffect(() => {
    if (!volumeSeriesRef.current) {
      return
    }

    if (showVolume && volumeData.length > 0) {
      volumeSeriesRef.current.applyOptions({
        visible: true,
      })
      volumeSeriesRef.current.setData(volumeData)
      return
    }

    volumeSeriesRef.current.applyOptions({
      visible: false,
    })
    volumeSeriesRef.current.setData([])
  }, [showVolume, volumeData])

  useEffect(() => {
    if (seriesRef.current && markers) {
      if (markersRef.current) {
        markersRef.current.setMarkers(markers)
      } else {
        markersRef.current = createSeriesMarkers(seriesRef.current, markers)
      }
    }
  }, [markers])

  useEffect(() => {
    const chart = chartRef.current
    if (!chart) {
      return
    }

    const markerDetailMap = new Map(markerDetails.map((detail) => [detail.id, detail]))
    const handleCrosshairMove: MouseEventHandler<Time> = (param) => {
      if (!param.point || typeof param.hoveredObjectId !== 'string') {
        setMarkerTooltip(null)
        return
      }

      const detail = markerDetailMap.get(param.hoveredObjectId)
      if (!detail) {
        setMarkerTooltip(null)
        return
      }

      const surface = chartSurfaceRef.current
      const tooltipWidth = 248
      const tooltipHeight = 52 + detail.fields.length * 26
      const surfaceWidth = surface?.clientWidth ?? 0
      const surfaceHeight = surface?.clientHeight ?? 0

      const left = surfaceWidth > 0
        ? Math.min(Math.max(12, param.point.x + 16), Math.max(12, surfaceWidth - tooltipWidth - 12))
        : param.point.x + 16

      const top = surfaceHeight > 0
        ? Math.min(Math.max(12, param.point.y - tooltipHeight - 12), Math.max(12, surfaceHeight - tooltipHeight - 12))
        : Math.max(12, param.point.y - tooltipHeight - 12)

      setMarkerTooltip({
        detail,
        left,
        top,
      })
    }

    chart.subscribeCrosshairMove(handleCrosshairMove)

    return () => {
      chart.unsubscribeCrosshairMove(handleCrosshairMove)
    }
  }, [markerDetails])

  useEffect(() => {
    const chart = chartRef.current
    if (!chart) {
      return
    }

    indicatorConfigs.forEach((config) => {
      const existingSeries = indicatorSeriesRef.current.get(config.id)
      const isEnabled = enabledIndicators.includes(config.id)

      if (!isEnabled) {
        if (existingSeries) {
          chart.removeSeries(existingSeries)
          indicatorSeriesRef.current.delete(config.id)
        }
        return
      }

      const indicatorData = buildMovingAverageData(data, config.period, config.mode)

      if (!existingSeries) {
        const nextSeries = chart.addSeries(LineSeries, {
          color: config.color,
          lineWidth: 2,
          priceLineVisible: false,
          lastValueVisible: false,
          crosshairMarkerVisible: false,
        })
        nextSeries.setData(indicatorData)
        indicatorSeriesRef.current.set(config.id, nextSeries)
        return
      }

      existingSeries.setData(indicatorData)
    })
  }, [data, enabledIndicators])

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

            {data.length > 0 && (
              <div className="flex flex-wrap justify-start gap-2 xl:justify-end">
                <button
                  type="button"
                  onClick={() => setShowVolume((prev) => !prev)}
                  className={`inline-flex items-center gap-2 px-3 py-1.5 rounded-full border text-xs font-medium transition-colors ${showVolume
                    ? 'border-emerald-300 bg-emerald-50 text-emerald-700'
                    : 'border-gray-200 bg-white text-gray-600 hover:border-gray-300 hover:text-gray-900'
                    }`}
                >
                  <span className="w-2 h-2 rounded-full bg-emerald-500" />
                  Volume
                </button>
                <button
                  type="button"
                  onClick={() => adjustZoom(1.25)}
                  className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full border border-gray-200 bg-white text-xs font-medium text-gray-600 transition-colors hover:border-gray-300 hover:text-gray-900"
                >
                  <Minus className="w-3.5 h-3.5" />
                  Zoom Out
                </button>
                <button
                  type="button"
                  onClick={() => adjustZoom(0.8)}
                  className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full border border-gray-200 bg-white text-xs font-medium text-gray-600 transition-colors hover:border-gray-300 hover:text-gray-900"
                >
                  <Plus className="w-3.5 h-3.5" />
                  Zoom In
                </button>
                <button
                  type="button"
                  onClick={resetView}
                  className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full border border-gray-200 bg-white text-xs font-medium text-gray-600 transition-colors hover:border-gray-300 hover:text-gray-900"
                >
                  <RotateCcw className="w-3.5 h-3.5" />
                  Reset View
                </button>
              </div>
            )}

            {data.length > 0 && (
              <div className="flex flex-wrap justify-start gap-2 xl:justify-end">
                {indicatorConfigs.map((indicator) => {
                  const isEnabled = enabledIndicators.includes(indicator.id)

                  return (
                    <button
                      key={indicator.id}
                      type="button"
                      onClick={() => toggleIndicator(indicator.id)}
                      className={`inline-flex items-center gap-2 px-3 py-1.5 rounded-full border text-xs font-medium transition-colors ${isEnabled
                        ? indicator.activeClassName
                        : 'border-gray-200 bg-white text-gray-600 hover:border-gray-300 hover:text-gray-900'
                        }`}
                    >
                      <span
                        className="w-2 h-2 rounded-full"
                        style={{ backgroundColor: indicator.color }}
                      />
                      {indicator.label}
                    </button>
                  )
                })}
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

      <div ref={chartSurfaceRef} className="relative h-[500px]">
        <div ref={chartContainerRef} className="w-full h-full" />

        {loading && (
          <div className="absolute inset-0 z-10 flex items-center justify-center bg-white/85 backdrop-blur-sm rounded-lg">
            <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full border border-gray-200 bg-white text-sm font-medium text-gray-700 shadow-sm">
              <Loader2 className="w-4 h-4 animate-spin" />
              Loading chart
            </div>
          </div>
        )}

        {markerTooltip && (
          <div
            className="absolute z-20 w-[248px] max-w-[248px] pointer-events-none rounded-xl border border-gray-200 bg-white/95 px-4 py-3 shadow-lg backdrop-blur-sm"
            style={{
              left: `${markerTooltip.left}px`,
              top: `${markerTooltip.top}px`,
            }}
          >
            <div className="flex items-center gap-2 mb-3">
              <span
                className="w-2.5 h-2.5 rounded-full"
                style={{ backgroundColor: markerTooltip.detail.accentColor }}
              />
              <span className="text-sm font-semibold text-gray-900">
                {markerTooltip.detail.title}
              </span>
            </div>

            <div className="space-y-2">
              {markerTooltip.detail.fields.map((field) => (
                <div key={`${markerTooltip.detail.id}-${field.label}`} className="flex items-start justify-between gap-3">
                  <span className="text-xs text-gray-500">{field.label}</span>
                  <span className="text-xs font-medium text-gray-900 text-right break-all">
                    {field.value}
                  </span>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>

      {data.length === 0 && !loading && (
        <div className="mt-4 flex items-center justify-center text-sm text-gray-500">
          No chart data available
        </div>
      )}
    </div>
  )
}
