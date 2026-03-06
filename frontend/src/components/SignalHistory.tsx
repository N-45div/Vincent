import { SignalBadge } from './SignalBadge'
import type { Signal } from '../lib/supabase'

type Props = {
  signals: Signal[]
  loading: boolean
}

function formatTime(iso: string) {
  return new Date(iso).toLocaleString('en-US', {
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  })
}

function formatPrice(n: number | null) {
  if (n === null) return '—'
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(n)
}

function truncateHash(hash: string | null) {
  if (!hash) return '—'
  return `${hash.slice(0, 6)}...${hash.slice(-4)}`
}

export function SignalHistory({ signals, loading }: Props) {
  if (loading) {
    return (
      <div className="rounded-xl border border-border bg-surface-1 overflow-hidden">
        <div className="px-6 py-4 border-b border-border">
          <div className="h-5 bg-surface-3 rounded w-32 animate-pulse" />
        </div>
        <div className="p-6 space-y-3">
          {[1, 2, 3].map((i) => (
            <div key={i} className="h-12 bg-surface-3 rounded animate-pulse" />
          ))}
        </div>
      </div>
    )
  }

  return (
    <div className="rounded-xl border border-border bg-surface-1 overflow-hidden">
      <div className="px-6 py-4 border-b border-border">
        <h2 className="text-sm font-mono uppercase tracking-wider text-text-secondary">
          Signal History
        </h2>
      </div>

      {signals.length === 0 ? (
        <div className="p-6 text-center text-text-muted text-sm">
          No historical signals
        </div>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border text-text-muted text-xs uppercase tracking-wider">
                <th className="px-6 py-3 text-left font-medium">Time</th>
                <th className="px-6 py-3 text-left font-medium">Signal</th>
                <th className="px-6 py-3 text-right font-medium">Confidence</th>
                <th className="px-6 py-3 text-right font-medium">Price</th>
                <th className="px-6 py-3 text-right font-medium">Tx</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {signals.map((s) => (
                <tr key={s.id} className="hover:bg-surface-2 transition-colors">
                  <td className="px-6 py-4 font-mono text-text-secondary whitespace-nowrap">
                    {formatTime(s.created_at)}
                  </td>
                  <td className="px-6 py-4">
                    <SignalBadge signal={s.signal} />
                  </td>
                  <td className="px-6 py-4 text-right font-mono">
                    {s.confidence}%
                  </td>
                  <td className="px-6 py-4 text-right font-mono text-text-secondary">
                    {formatPrice(s.price_at_signal)}
                  </td>
                  <td className="px-6 py-4 text-right">
                    {s.tx_hash ? (
                      <a
                        href={`https://sepolia.etherscan.io/tx/${s.tx_hash}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="font-mono text-accent hover:underline"
                      >
                        {truncateHash(s.tx_hash)}
                      </a>
                    ) : (
                      <span className="text-text-muted">—</span>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}
