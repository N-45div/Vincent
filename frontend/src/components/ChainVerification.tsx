import { ShieldCheck, ShieldAlert, Database } from 'lucide-react'
import type { Signal } from '../lib/supabase'
import type { ChainReport } from '../lib/chain'
import { signalNames } from '../lib/chain'

const SIGNAL_TO_CODE: Record<Signal['signal'], number> = {
  HOLD: 0,
  BUY: 1,
  SELL: 2,
}

function formatTime(ts: number) {
  if (!ts) return '—'
  return new Date(ts * 1000).toLocaleString('en-US', {
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  })
}

type Props = {
  latest: Signal | null
  report: ChainReport | null
  loading: boolean
}

export function ChainVerification({ latest, report, loading }: Props) {
  const matches = Boolean(
    latest &&
      report &&
      latest.data_hash.toLowerCase() === report.dataHash.toLowerCase() &&
      SIGNAL_TO_CODE[latest.signal] === report.signal
  )

  const statusLabel = matches ? 'On-chain verified' : 'Pending verification'
  const StatusIcon = matches ? ShieldCheck : ShieldAlert
  const statusColor = matches ? 'text-buy' : 'text-hold'

  return (
    <div className="rounded-xl border border-border bg-surface-1 p-6">
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <Database className="w-4 h-4 text-accent" />
          <span className="text-xs text-text-muted uppercase tracking-wider">
            On-chain proof
          </span>
        </div>
        <div className={`flex items-center gap-2 text-xs font-mono ${statusColor}`}>
          <StatusIcon className="w-4 h-4" />
          {statusLabel}
        </div>
      </div>

      {loading ? (
        <div className="space-y-2">
          <div className="h-4 bg-surface-3 rounded w-1/2 animate-pulse" />
          <div className="h-4 bg-surface-3 rounded w-2/3 animate-pulse" />
        </div>
      ) : report ? (
        <div className="space-y-3 text-sm">
          <div className="flex items-center justify-between">
            <span className="text-text-muted">Signal</span>
            <span className="font-mono text-text-secondary">
              {signalNames[report.signal]}
            </span>
          </div>
          <div className="flex items-center justify-between">
            <span className="text-text-muted">Confidence</span>
            <span className="font-mono text-text-secondary">
              {report.confidence}%
            </span>
          </div>
          <div className="flex items-center justify-between">
            <span className="text-text-muted">Asset</span>
            <span className="font-mono text-text-secondary">{report.asset}</span>
          </div>
          <div className="flex items-center justify-between">
            <span className="text-text-muted">Timestamp</span>
            <span className="font-mono text-text-secondary">
              {formatTime(report.timestamp)}
            </span>
          </div>
          <div className="pt-3 border-t border-border">
            <p className="text-xs text-text-muted mb-1">Data Hash</p>
            <p className="font-mono text-xs text-text-secondary break-all">
              {report.dataHash}
            </p>
          </div>
        </div>
      ) : (
        <p className="text-sm text-text-muted">No on-chain report yet.</p>
      )}
    </div>
  )
}
