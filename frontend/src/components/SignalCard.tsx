import { ArrowUp, ArrowDown, Minus, Clock, ExternalLink } from 'lucide-react'
import type { Signal } from '../lib/supabase'

type Props = {
  signal: Signal
  isLatest?: boolean
}

function formatTime(ts: string) {
  const date = new Date(ts)
  const now = new Date()
  const diff = now.getTime() - date.getTime()
  const mins = Math.floor(diff / 60000)
  const hours = Math.floor(mins / 60)

  if (mins < 1) return 'just now'
  if (mins < 60) return `${mins}m ago`
  if (hours < 24) return `${hours}h ago`
  return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
}

function formatPrice(price: number | null) {
  if (price === null) return '—'
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(price)
}

const signalConfig = {
  BUY: { icon: ArrowUp, color: 'text-buy', bg: 'bg-buy/10', border: 'border-buy/20' },
  SELL: { icon: ArrowDown, color: 'text-sell', bg: 'bg-sell/10', border: 'border-sell/20' },
  HOLD: { icon: Minus, color: 'text-hold', bg: 'bg-hold/10', border: 'border-hold/20' },
}

export function SignalCard({ signal, isLatest }: Props) {
  const config = signalConfig[signal.signal]
  const Icon = config.icon

  return (
    <div className={`bg-surface-1 border rounded-lg p-5 ${isLatest ? 'border-accent/30' : 'border-border'}`}>
      <div className="flex items-start justify-between gap-4 mb-4">
        <div className="flex items-center gap-3">
          <div className={`w-10 h-10 rounded-lg ${config.bg} border ${config.border} flex items-center justify-center`}>
            <Icon className={`w-5 h-5 ${config.color}`} />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <span className={`text-xl font-semibold ${config.color}`}>{signal.signal}</span>
              <span className="px-2 py-0.5 text-xs font-mono bg-surface-2 rounded">{signal.asset}</span>
            </div>
            <div className="flex items-center gap-2 text-xs text-text-muted mt-0.5">
              <Clock className="w-3 h-3" />
              {formatTime(signal.created_at)}
            </div>
          </div>
        </div>

        <div className="text-right">
          <div className="text-xs text-text-muted uppercase tracking-wider">Confidence</div>
          <div className="font-mono text-lg">{signal.confidence}%</div>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-4 mb-4">
        <div>
          <div className="text-xs text-text-muted uppercase tracking-wider mb-1">Price</div>
          <div className="font-mono">{formatPrice(signal.price_at_signal)}</div>
        </div>
        <div>
          <div className="text-xs text-text-muted uppercase tracking-wider mb-1">Sentiment</div>
          <div className="font-mono">{signal.sentiment_score ?? '—'}</div>
        </div>
      </div>

      {signal.reasoning && (
        <div className="mb-4">
          <div className="text-xs text-text-muted uppercase tracking-wider mb-1">Reasoning</div>
          <p className="text-sm text-text-secondary leading-relaxed">{signal.reasoning}</p>
        </div>
      )}

      {signal.tx_hash && signal.tx_hash !== '0x0000000000000000000000000000000000000000000000000000000000000000' && (
        <a
          href={`https://sepolia.etherscan.io/tx/${signal.tx_hash}`}
          target="_blank"
          rel="noopener noreferrer"
          className="flex items-center gap-1.5 text-xs text-accent hover:underline"
        >
          View on Etherscan
          <ExternalLink className="w-3 h-3" />
        </a>
      )}
    </div>
  )
}
