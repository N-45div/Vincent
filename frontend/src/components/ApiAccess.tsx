import { ExternalLink, Copy, Check, CircleDollarSign, Zap, Play } from 'lucide-react'
import { useState } from 'react'

export function ApiAccess() {
  const [copied, setCopied] = useState(false)
  const [probe, setProbe] = useState<{
    status: number
    statusText: string
    paymentRequired: string | null
    paymentResponse: string | null
    paymentSignature: string | null
  } | null>(null)
  const [paidResult, setPaidResult] = useState<{
    status: number
    payment: unknown
    paymentError?: string | null
    body: unknown
  } | null>(null)
  const [probeLoading, setProbeLoading] = useState(false)
  const [paidLoading, setPaidLoading] = useState(false)
  const [probeError, setProbeError] = useState<string | null>(null)
  const [paidError, setPaidError] = useState<string | null>(null)
  const apiUrl = 'http://localhost:4021/api/signals'
  const paidUrl = 'http://localhost:4021/api/paid-demo'

  const handleCopy = () => {
    navigator.clipboard.writeText(`curl -i ${apiUrl}`)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  const handleProbe = async () => {
    setProbeLoading(true)
    setProbe(null)
    setProbeError(null)

    try {
      const response = await fetch(apiUrl, { method: 'GET' })
      setProbe({
        status: response.status,
        statusText: response.statusText,
        paymentRequired: response.headers.get('payment-required'),
        paymentResponse: response.headers.get('payment-response'),
        paymentSignature: response.headers.get('payment-signature'),
      })
    } catch (error) {
      setProbeError('Unable to reach x402 server. Is it running?')
    } finally {
      setProbeLoading(false)
    }
  }

  const handlePaid = async () => {
    setPaidLoading(true)
    setPaidResult(null)
    setPaidError(null)

    try {
      const response = await fetch(paidUrl, { method: 'GET' })
      const data = await response.json().catch(() => null)

      if (!response.ok) {
        setPaidError(data?.error || 'Payment failed')
        return
      }

      setPaidResult({
        status: data?.status ?? response.status,
        payment: data?.payment ?? null,
        paymentError: data?.paymentError ?? null,
        body: data?.body ?? null,
      })
    } catch (error) {
      setPaidError('Unable to reach paid demo endpoint.')
    } finally {
      setPaidLoading(false)
    }
  }

  return (
    <div className="bg-surface-1 border border-border rounded-lg p-6">
      <div className="flex items-center gap-3 mb-4">
        <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-hold to-hold/60 flex items-center justify-center shadow-lg shadow-hold/20">
          <CircleDollarSign className="w-5 h-5 text-white" />
        </div>
        <div>
          <h3 className="font-semibold text-lg">x402 Paywall</h3>
          <p className="text-xs text-text-muted">Pay-per-request signal access</p>
        </div>
      </div>

      <div className="space-y-3">
        <div className="rounded-lg border border-border bg-surface-0/70 p-4">
          <div className="flex items-center justify-between gap-3">
            <div>
              <p className="text-xs text-text-muted uppercase tracking-wider">Signal Feed</p>
              <p className="text-sm text-text-secondary">
                x402-gated AI signal stream with instant settlement.
              </p>
            </div>
            <button
              onClick={handleCopy}
              className="flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-lg bg-surface-2 hover:bg-surface-3 transition-colors"
            >
              {copied ? (
                <Check className="w-3.5 h-3.5 text-buy" />
              ) : (
                <Copy className="w-3.5 h-3.5 text-text-muted" />
              )}
              Copy endpoint
            </button>
          </div>
          <div className="mt-3 flex flex-wrap gap-2">
            <span className="px-2 py-0.5 text-[11px] font-mono bg-surface-2 border border-border rounded-full">
              402 Paywall
            </span>
            <span className="px-2 py-0.5 text-[11px] font-mono bg-surface-2 border border-border rounded-full">
              USDC exact
            </span>
            <span className="px-2 py-0.5 text-[11px] font-mono bg-surface-2 border border-border rounded-full">
              Base Sepolia
            </span>
          </div>
        </div>

        <div className="grid grid-cols-2 gap-3 text-sm">
          <div className="rounded-lg border border-border bg-surface-0/70 p-3">
            <div className="text-text-muted text-xs uppercase tracking-wider mb-1">Price</div>
            <div className="font-mono">$0.01 <span className="text-text-muted">USDC</span></div>
          </div>
          <div className="rounded-lg border border-border bg-surface-0/70 p-3">
            <div className="text-text-muted text-xs uppercase tracking-wider mb-1">Network</div>
            <div className="font-mono">Base Sepolia</div>
          </div>
        </div>

        <div className="pt-2 border-t border-border">
          <div className="text-xs text-text-muted mb-2">Protocol Flow</div>
          <ol className="text-xs text-text-secondary space-y-1">
            <li className="flex gap-2">
              <span className="text-hold font-mono">1.</span>
              Request returns 402 + payment details
            </li>
            <li className="flex gap-2">
              <span className="text-hold font-mono">2.</span>
              Pay via facilitator
            </li>
            <li className="flex gap-2">
              <span className="text-hold font-mono">3.</span>
              Retry with payment proof
            </li>
          </ol>
        </div>

        <div className="rounded-lg border border-border bg-surface-0/70 p-4 space-y-2">
          <div className="flex items-center justify-between">
            <div className="text-xs text-text-muted uppercase tracking-wider">Live Paywall</div>
            <button
              onClick={handleProbe}
              className="flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-lg bg-surface-2 hover:bg-surface-3 transition-colors"
            >
              <Zap className="w-3 h-3" />
              {probeLoading ? 'Checking…' : 'Test'}
            </button>
          </div>

          {probeError && (
            <div className="text-xs text-sell">{probeError}</div>
          )}

          {probe && (
            <div className="bg-surface-2/60 rounded-lg p-3 text-xs font-mono text-text-secondary space-y-1">
              <div className="flex items-center gap-2">
                <span className="px-2 py-0.5 rounded-full bg-hold/10 text-hold text-[10px]">402</span>
                Status: {probe.status} {probe.statusText}
              </div>
              <div className="break-all">payment-required: {probe.paymentRequired ?? '—'}</div>
              <div className="break-all">payment-response: {probe.paymentResponse ?? '—'}</div>
              <div className="break-all">payment-signature: {probe.paymentSignature ?? '—'}</div>
            </div>
          )}
        </div>

        <div className="rounded-lg border border-border bg-surface-0/70 p-4 space-y-2">
          <div className="flex items-center justify-between">
            <div className="text-xs text-text-muted uppercase tracking-wider">Paid Demo</div>
            <button
              onClick={handlePaid}
              className="flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-lg bg-gradient-to-r from-accent to-accent/80 text-white hover:shadow-lg hover:shadow-accent/25 transition-all"
            >
              <Play className="w-3 h-3" />
              {paidLoading ? 'Paying…' : 'Pay & Access'}
            </button>
          </div>

          {paidError && <div className="text-xs text-sell">{paidError}</div>}

          {paidResult && (
            <div className="bg-surface-2/60 rounded-lg p-3 text-xs font-mono text-text-secondary space-y-2">
              <div className="flex items-center gap-2">
                <span
                  className={`px-2 py-0.5 rounded-full text-[10px] ${
                    paidResult.payment && !paidResult.paymentError
                      ? 'bg-buy/10 text-buy'
                      : 'bg-hold/10 text-hold'
                  }`}
                >
                  {paidResult.payment && !paidResult.paymentError ? 'Settled' : 'Pending'}
                </span>
                Status: {paidResult.status}
              </div>
              {paidResult.paymentError && (
                <div className="text-sell">{paidResult.paymentError}</div>
              )}
              {paidResult.payment && (
                <>
                  <div className="text-text-muted">Payment settlement:</div>
                  <pre className="whitespace-pre-wrap break-words text-xs">
                    {JSON.stringify(paidResult.payment, null, 2)}
                  </pre>
                </>
              )}
            </div>
          )}
          <p className="text-[11px] text-text-muted">
            Uses server-side @x402/fetch to pay the endpoint with your testnet wallet.
          </p>
        </div>

        <a
          href="https://x402.org"
          target="_blank"
          rel="noopener noreferrer"
          className="flex items-center gap-2 text-xs text-accent hover:underline"
        >
          Learn more about x402
          <ExternalLink className="w-3 h-3" />
        </a>
      </div>
    </div>
  )
}
