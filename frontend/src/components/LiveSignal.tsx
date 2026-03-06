import { Activity, ExternalLink, Clock, Percent } from 'lucide-react'
import { SignalBadge } from './SignalBadge'
import type { Signal } from '../lib/supabase'

type Props = {
  signal: Signal | null
  loading: boolean
}

function formatTime(iso: string) {
  return new Date(iso).toLocaleString('en-US', {
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
  })
}

function formatPrice(n: number | null) {
  if (n === null) return '—'
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    minimumFractionDigits: 2,
  }).format(n)
}

export function LiveSignal({ signal, loading }: Props) {
  if (loading) {
    return (
      <div className="rounded-xl border border-border bg-surface-1 p-8 animate-pulse">
        <div className="h-8 bg-surface-3 rounded w-1/3 mb-4" />
        <div className="h-16 bg-surface-3 rounded w-1/2" />
      </div>
    )
  }

  if (!signal) {
    return (
      <div className="rounded-xl border border-border bg-surface-1 p-8 text-center">
        <Activity className="w-12 h-12 text-text-muted mx-auto mb-4" />
        <p className="text-text-secondary">No signals yet</p>
        <p className="text-text-muted text-sm mt-1">
          Waiting for AI attestation...
        </p>
      </div>
    )
  }

  const explorerUrl = signal.tx_hash
    ? `https://sepolia.etherscan.io/tx/${signal.tx_hash}`
    : null

  return (
    <div className="rounded-xl border border-border bg-surface-1 overflow-hidden">
      <div className="px-6 py-4 border-b border-border flex items-center justify-between">
        <div className="flex items-center gap-2">
          <span className="w-2 h-2 rounded-full bg-buy animate-pulse" />
          <span className="text-sm text-text-secondary font-mono uppercase tracking-wider">
            Live Signal
          </span>
        </div>
        <span className="text-xs text-text-muted font-mono">
          {signal.asset}
        </span>
      </div>

      <div className="p-6">
        <div className="flex items-start justify-between mb-6">
          <div>
            <SignalBadge signal={signal.signal} size="lg" />
            <div className="mt-3 flex items-center gap-4 text-sm text-text-secondary">
              <span className="flex items-center gap-1">
                <Percent className="w-4 h-4" />
                <span className="font-mono">{signal.confidence}%</span> confidence
              </span>
              <span className="flex items-center gap-1">
                <Clock className="w-4 h-4" />
                {formatTime(signal.created_at)}
              </span>
            </div>
          </div>
          <div className="text-right">
            <p className="text-xs text-text-muted uppercase tracking-wider mb-1">
              Price at Signal
            </p>
            <p className="text-2xl font-mono font-semibold">
              {formatPrice(signal.price_at_signal)}
            </p>
          </div>
        </div>

        {signal.reasoning && (
          <div className="mb-6">
            <p className="text-xs text-text-muted uppercase tracking-wider mb-2">
              AI Reasoning
            </p>
            <p className="text-sm text-text-secondary leading-relaxed">
              {signal.reasoning}
            </p>
          </div>
        )}

        {explorerUrl && (
          <a
            href={explorerUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-2 text-sm text-accent hover:underline"
          >
            <ExternalLink className="w-4 h-4" />
            View on-chain attestation
          </a>
        )}

        {signal.tx_hash && (
          <div className="mt-4 p-3 rounded bg-surface-2 border border-border">
            <p className="text-xs text-text-muted mb-1">Transaction Hash</p>
            <p className="font-mono text-xs text-text-secondary break-all">
              {signal.tx_hash}
            </p>
          </div>
        )}
      </div>
    </div>
  )
}
