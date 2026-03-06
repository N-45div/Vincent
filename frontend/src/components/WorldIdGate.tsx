import { useEffect, useMemo, useState, useCallback, useRef } from 'react'
import { Check, Copy, ShieldAlert, Loader2 } from 'lucide-react'

const BACKEND_URL = 'http://localhost:4021'
const RP_SIGNATURE_ENDPOINT = `${BACKEND_URL}/api/world-id/rp-signature`
const VERIFY_ENDPOINT = `${BACKEND_URL}/api/world-id/verify`

interface RpSignature {
  sig: string
  nonce: string
  created_at: number
  expires_at: number
  rp_id: string
  app_id: string
}

interface IDKitResult {
  protocol_version: string
  nonce: string
  action: string
  environment: string
  responses: Array<{
    identifier: string
    merkle_root: string
    nullifier: string
    proof: string
    signal_hash: string
  }>
}

declare global {
  interface Window {
    IDKit: {
      request: (config: {
        app_id: string
        action: string
        rp_context?: {
          rp_id: string
          nonce: string
          created_at: number
          expires_at: number
          signature: string
        }
        allow_legacy_proofs?: boolean
        environment?: 'production' | 'staging'
      }) => Promise<{
        connectorURI: string
        pollUntilCompletion: () => Promise<IDKitResult>
      }>
    }
  }
}

export function WorldIdGate() {
  const [token, setToken] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [copied, setCopied] = useState(false)
  const [verifying, setVerifying] = useState(false)
  const [qrUri, setQrUri] = useState<string | null>(null)
  const [polling, setPolling] = useState(false)
  const abortRef = useRef<AbortController | null>(null)

  const appId = import.meta.env.VITE_WORLD_ID_APP_ID as string | undefined
  const isStaging = import.meta.env.VITE_WORLD_ID_STAGING === 'true'

  useEffect(() => {
    const stored = localStorage.getItem('worldIdToken')
    if (stored) {
      setToken(stored)
    }
  }, [])

  const displayToken = useMemo(() => {
    if (!token) return null
    return `${token.slice(0, 6)}...${token.slice(-6)}`
  }, [token])

  const handleCopy = async () => {
    if (!token) return
    await navigator.clipboard.writeText(token)
    setCopied(true)
    setTimeout(() => setCopied(false), 1500)
  }

  const startVerification = useCallback(async () => {
    if (!appId) return
    
    setError(null)
    setVerifying(true)
    abortRef.current = new AbortController()

    try {
      // Step 1: Get RP signature from backend
      const rpRes = await fetch(RP_SIGNATURE_ENDPOINT, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'vincent-signal-access' }),
        signal: abortRef.current.signal,
      })
      
      if (!rpRes.ok) {
        const data = await rpRes.json().catch(() => ({}))
        throw new Error(data.error || 'Failed to get RP signature')
      }
      
      const rpSig: RpSignature = await rpRes.json()
      
      // Step 2: Create IDKit request with RP context
      if (!window.IDKit?.request) {
        throw new Error('IDKit not loaded. Please refresh the page.')
      }

      const request = await window.IDKit.request({
        app_id: appId,
        action: 'vincent-signal-access',
        rp_context: {
          rp_id: rpSig.rp_id,
          nonce: rpSig.nonce,
          created_at: rpSig.created_at,
          expires_at: rpSig.expires_at,
          signature: rpSig.sig,
        },
        allow_legacy_proofs: true,
        environment: isStaging ? 'staging' : 'production',
      })

      // Show QR code
      setQrUri(request.connectorURI)
      setPolling(true)

      // Step 3: Poll for completion
      const result = await request.pollUntilCompletion()
      
      setPolling(false)
      setQrUri(null)

      // Step 4: Verify proof on backend
      const verifyRes = await fetch(VERIFY_ENDPOINT, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(result),
        signal: abortRef.current.signal,
      })

      const verifyData = await verifyRes.json().catch(() => null)
      if (!verifyRes.ok) {
        throw new Error(verifyData?.error || 'World ID verification failed')
      }

      if (verifyData?.token) {
        localStorage.setItem('worldIdToken', verifyData.token)
        setToken(verifyData.token)
      }
    } catch (err: unknown) {
      if ((err as Error).name !== 'AbortError') {
        setError((err as Error).message || 'Verification failed')
      }
    } finally {
      setVerifying(false)
      setPolling(false)
      setQrUri(null)
    }
  }, [appId, isStaging])

  const cancelVerification = useCallback(() => {
    abortRef.current?.abort()
    setQrUri(null)
    setPolling(false)
    setVerifying(false)
  }, [])

  return (
    <div className="bg-surface-1 border border-border rounded-xl p-6">
      <div className="flex items-center justify-between gap-4">
        <div>
          <h3 className="text-lg font-semibold">World ID Gate</h3>
          <p className="text-sm text-text-muted mt-1">
            Verify unique humanness to access x402-gated signals.
          </p>
        </div>
        <div className="text-xs text-text-muted rounded-full border border-border px-3 py-1">
          Worldcoin Sponsor
        </div>
      </div>

      <div className="mt-4 space-y-3">
        {!appId ? (
          <div className="flex items-center gap-2 text-sm text-warning">
            <ShieldAlert className="w-4 h-4" />
            Missing <code className="text-xs">VITE_WORLD_ID_APP_ID</code> in frontend env.
          </div>
        ) : qrUri ? (
          <div className="space-y-3">
            <p className="text-sm text-text-secondary">Scan with World App or Simulator:</p>
            <div className="bg-white p-4 rounded-lg inline-block">
              <img 
                src={`https://api.qrserver.com/v1/create-qr-code/?size=200x200&data=${encodeURIComponent(qrUri)}`}
                alt="World ID QR Code"
                className="w-48 h-48"
              />
            </div>
            <div className="flex items-center gap-2">
              {polling && <Loader2 className="w-4 h-4 animate-spin text-accent" />}
              <span className="text-sm text-text-muted">
                {polling ? 'Waiting for verification...' : 'Session ready'}
              </span>
            </div>
            <button
              onClick={cancelVerification}
              className="px-3 py-1.5 text-sm text-text-muted hover:text-text-primary border border-border rounded-lg"
            >
              Cancel
            </button>
          </div>
        ) : (
          <button
            onClick={startVerification}
            disabled={verifying}
            className="px-4 py-2 rounded-lg bg-accent text-white text-sm font-medium hover:bg-accent/90 disabled:opacity-60 flex items-center gap-2"
          >
            {verifying && <Loader2 className="w-4 h-4 animate-spin" />}
            {token ? 'Re-verify World ID' : verifying ? 'Verifying...' : 'Verify with World ID'}
          </button>
        )}

        {token && (
          <div className="flex items-center justify-between rounded-lg border border-border bg-surface-0 px-4 py-3 text-sm">
            <div>
              <div className="text-xs text-text-muted uppercase tracking-wider">Access Token</div>
              <div className="font-mono text-sm text-text-primary">{displayToken}</div>
            </div>
            <button
              onClick={handleCopy}
              className="flex items-center gap-1 text-xs text-text-muted hover:text-text-primary"
            >
              {copied ? <Check className="w-3.5 h-3.5 text-buy" /> : <Copy className="w-3.5 h-3.5" />}
              {copied ? 'Copied' : 'Copy'}
            </button>
          </div>
        )}

        {error && <p className="text-sm text-sell">{error}</p>}

        <p className="text-xs text-text-muted">
          Use this token in the <code className="text-xs">x-world-id-token</code> header when
          calling <code className="text-xs">/api/signals</code> or <code className="text-xs">/api/paid-demo</code>.
        </p>
      </div>
    </div>
  )
}
