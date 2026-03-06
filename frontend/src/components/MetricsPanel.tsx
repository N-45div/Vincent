import { TrendingUp, TrendingDown, Target, Percent } from 'lucide-react'
import type { SignalMetric } from '../lib/supabase'

type Props = {
  metrics: SignalMetric[]
  loading: boolean
}

export function MetricsPanel({ metrics, loading }: Props) {
  if (loading) {
    return (
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {[...Array(4)].map((_, i) => (
          <div key={i} className="bg-surface-1 border border-border rounded-lg p-4">
            <div className="h-4 bg-surface-3 rounded w-1/2 mb-2 animate-pulse" />
            <div className="h-8 bg-surface-3 rounded w-3/4 animate-pulse" />
          </div>
        ))}
      </div>
    )
  }

  const total = metrics.length
  const correct = metrics.filter((m) => m.correct).length
  const accuracy = total > 0 ? ((correct / total) * 100).toFixed(1) : '—'
  const avgReturn = total > 0
    ? (metrics.reduce((acc, m) => acc + m.return_pct, 0) / total).toFixed(2)
    : '—'
  const avgConfidence = total > 0
    ? Math.round(metrics.reduce((acc, m) => acc + m.confidence, 0) / total)
    : 0

  const wins = metrics.filter((m) => m.return_pct > 0).length
  const losses = metrics.filter((m) => m.return_pct < 0).length

  return (
    <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
      <div className="bg-surface-1 border border-border rounded-lg p-4">
        <div className="flex items-center gap-2 text-text-muted text-xs uppercase tracking-wider mb-1">
          <Target className="w-3.5 h-3.5" />
          Accuracy
        </div>
        <div className="text-2xl font-mono font-semibold">
          {accuracy}
          <span className="text-sm text-text-muted">%</span>
        </div>
        <div className="text-xs text-text-muted mt-1">
          {correct}/{total} correct
        </div>
      </div>

      <div className="bg-surface-1 border border-border rounded-lg p-4">
        <div className="flex items-center gap-2 text-text-muted text-xs uppercase tracking-wider mb-1">
          <Percent className="w-3.5 h-3.5" />
          Avg Return
        </div>
        <div className={`text-2xl font-mono font-semibold ${
          Number(avgReturn) > 0 ? 'text-buy' : Number(avgReturn) < 0 ? 'text-sell' : ''
        }`}>
          {Number(avgReturn) > 0 ? '+' : ''}{avgReturn}%
        </div>
        <div className="text-xs text-text-muted mt-1">per signal</div>
      </div>

      <div className="bg-surface-1 border border-border rounded-lg p-4">
        <div className="flex items-center gap-2 text-text-muted text-xs uppercase tracking-wider mb-1">
          <TrendingUp className="w-3.5 h-3.5 text-buy" />
          Win/Loss
        </div>
        <div className="text-2xl font-mono font-semibold">
          <span className="text-buy">{wins}</span>
          <span className="text-text-muted">/</span>
          <span className="text-sell">{losses}</span>
        </div>
        <div className="text-xs text-text-muted mt-1">
          {total > 0 ? ((wins / total) * 100).toFixed(0) : 0}% win rate
        </div>
      </div>

      <div className="bg-surface-1 border border-border rounded-lg p-4">
        <div className="flex items-center gap-2 text-text-muted text-xs uppercase tracking-wider mb-1">
          <TrendingDown className="w-3.5 h-3.5" />
          Avg Confidence
        </div>
        <div className="text-2xl font-mono font-semibold">
          {avgConfidence}
          <span className="text-sm text-text-muted">%</span>
        </div>
        <div className="text-xs text-text-muted mt-1">model certainty</div>
      </div>
    </div>
  )
}
