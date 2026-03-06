import { useEffect, useRef } from 'react'
import { createChart, ColorType, type IChartApi, type ISeriesApi, type AreaSeriesOptions, type DeepPartial } from 'lightweight-charts'
import { TrendingUp } from 'lucide-react'
import type { PriceTick } from '../lib/supabase'

type Props = {
  ticks: PriceTick[]
  loading: boolean
}

function formatPrice(price: number) {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(price)
}

export function PriceChart({ ticks, loading }: Props) {
  const chartContainerRef = useRef<HTMLDivElement>(null)
  const chartRef = useRef<IChartApi | null>(null)
  const seriesRef = useRef<ISeriesApi<'Area'> | null>(null)

  const sortedTicks = [...ticks].sort(
    (a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime()
  )
  
  const latest = sortedTicks[sortedTicks.length - 1]
  const first = sortedTicks[0]
  const change = latest && first ? ((latest.price - first.price) / first.price) * 100 : 0

  useEffect(() => {
    if (!chartContainerRef.current || loading || !ticks.length) return

    // Create chart
    const chart = createChart(chartContainerRef.current, {
      layout: {
        background: { type: ColorType.Solid, color: 'transparent' },
        textColor: '#6b7280',
        fontFamily: 'ui-monospace, monospace',
      },
      grid: {
        vertLines: { color: 'rgba(255, 255, 255, 0.03)' },
        horzLines: { color: 'rgba(255, 255, 255, 0.03)' },
      },
      width: chartContainerRef.current.clientWidth,
      height: 180,
      rightPriceScale: {
        borderVisible: false,
        scaleMargins: { top: 0.1, bottom: 0.1 },
      },
      timeScale: {
        borderVisible: false,
        timeVisible: true,
        secondsVisible: false,
      },
      crosshair: {
        vertLine: { color: 'rgba(139, 92, 246, 0.3)', width: 1, labelBackgroundColor: '#8b5cf6' },
        horzLine: { color: 'rgba(139, 92, 246, 0.3)', width: 1, labelBackgroundColor: '#8b5cf6' },
      },
      handleScale: false,
      handleScroll: false,
    })

    chartRef.current = chart

    // Area series with gradient
    const areaOptions: DeepPartial<AreaSeriesOptions> = {
      lineColor: '#8b5cf6',
      topColor: 'rgba(139, 92, 246, 0.4)',
      bottomColor: 'rgba(139, 92, 246, 0.0)',
      lineWidth: 2,
      priceFormat: {
        type: 'price',
        precision: 0,
        minMove: 1,
      },
    }

    const areaSeries = chart.addAreaSeries(areaOptions)
    seriesRef.current = areaSeries

    // Transform data for lightweight-charts
    const chartData = sortedTicks.map((tick) => ({
      time: Math.floor(new Date(tick.created_at).getTime() / 1000) as number,
      value: tick.price,
    }))

    areaSeries.setData(chartData)
    chart.timeScale().fitContent()

    // Handle resize
    const handleResize = () => {
      if (chartContainerRef.current) {
        chart.applyOptions({ width: chartContainerRef.current.clientWidth })
      }
    }

    window.addEventListener('resize', handleResize)

    return () => {
      window.removeEventListener('resize', handleResize)
      chart.remove()
    }
  }, [ticks, loading, sortedTicks])

  if (loading) {
    return (
      <div className="bg-surface-1 border border-border rounded-xl p-6">
        <div className="h-4 bg-surface-3 rounded w-1/4 mb-4 animate-pulse" />
        <div className="h-[180px] bg-surface-2/50 rounded-lg animate-pulse" />
      </div>
    )
  }

  if (!ticks.length) {
    return (
      <div className="bg-surface-1 border border-border rounded-xl p-6">
        <div className="flex items-center gap-2 text-text-muted text-xs uppercase tracking-wider mb-4">
          <TrendingUp className="w-3.5 h-3.5" />
          Price History
        </div>
        <div className="h-[180px] flex items-center justify-center text-text-muted text-sm bg-surface-0/50 rounded-lg border border-border/50">
          No price data yet
        </div>
      </div>
    )
  }

  return (
    <div className="bg-surface-1 border border-border rounded-xl overflow-hidden">
      <div className="flex items-center justify-between p-4 border-b border-border/50">
        <div className="flex items-center gap-2 text-text-muted text-xs uppercase tracking-wider">
          <TrendingUp className="w-3.5 h-3.5" />
          Price History
        </div>
        {latest && (
          <div className="flex items-center gap-3">
            <div className="text-right">
              <div className="font-mono text-xl font-semibold">{formatPrice(latest.price)}</div>
            </div>
            <div className={`px-2 py-1 rounded-md text-xs font-semibold ${
              change >= 0 
                ? 'bg-buy/10 text-buy' 
                : 'bg-sell/10 text-sell'
            }`}>
              {change >= 0 ? '+' : ''}{change.toFixed(2)}%
            </div>
          </div>
        )}
      </div>

      <div className="p-2">
        <div ref={chartContainerRef} className="w-full" />
      </div>
    </div>
  )
}
