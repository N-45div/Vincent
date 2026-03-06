import { Activity, TrendingUp, Shield, Clock } from 'lucide-react'
import type { Signal } from '../lib/supabase'

type Props = {
  signals: Signal[]
}

export function Stats({ signals }: Props) {
  const total = signals.length
  const buyCount = signals.filter((s) => s.signal === 'BUY').length
  const sellCount = signals.filter((s) => s.signal === 'SELL').length
  const avgConfidence =
    total > 0
      ? Math.round(signals.reduce((sum, s) => sum + s.confidence, 0) / total)
      : 0

  const stats = [
    {
      label: 'Total Signals',
      value: total,
      icon: Activity,
      color: 'text-accent',
    },
    {
      label: 'Buy Signals',
      value: buyCount,
      icon: TrendingUp,
      color: 'text-buy',
    },
    {
      label: 'Sell Signals',
      value: sellCount,
      icon: Clock,
      color: 'text-sell',
    },
    {
      label: 'Avg Confidence',
      value: `${avgConfidence}%`,
      icon: Shield,
      color: 'text-hold',
    },
  ]

  return (
    <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
      {stats.map((stat) => {
        const Icon = stat.icon
        return (
          <div
            key={stat.label}
            className="rounded-xl border border-border bg-surface-1 p-4"
          >
            <div className="flex items-center gap-2 mb-2">
              <Icon className={`w-4 h-4 ${stat.color}`} />
              <span className="text-xs text-text-muted uppercase tracking-wider">
                {stat.label}
              </span>
            </div>
            <p className="text-2xl font-mono font-semibold">{stat.value}</p>
          </div>
        )
      })}
    </div>
  )
}
