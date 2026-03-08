import { useEffect, useMemo, useState, useCallback, useRef } from 'react'
import { Check, Copy, ShieldAlert, Loader2 } from 'lucide-react'

const VERIFY_ENDPOINT = 'http://localhost:4021/api/world-id/verify'

interface WorldIdProof {
  merkle_root: string
  nullifier_hash: string
  proof: string
  verification_level: string
}

declare global {
  interface Window {
    IDKit: {
      init: (config: {
        app_id: string
        action: string
        signal?: string
        verification_level?: string
        action_description?: string
        handleVerify?: (proof: WorldIdProof) => Promise<void>
        onSuccess?: (proof: WorldIdProof) => void
        onError?: (error: { code: string; message?: string }) => void
      }) => void
      open: () => void
      close: () => void
      isInitialized: boolean
    }
  }
}

export function WorldIdGate() {
  const [token, setToken] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [copied, setCopied] = useState(false)
  const [verifying, setVerifying] = useState(false)
  const [initialized, setInitialized] = useState(false)
  const initRef = useRef(false)

  const appId = import.meta.env.VITE_WORLD_ID_APP_ID as string | undefined

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

  // Initialize IDKit Widget once
  useEffect(() => {
    if (!appId || initRef.current || !window.IDKit) return
    initRef.current = true

    const verifyProof = async (proof: WorldIdProof) => {
      setVerifying(true)
      setError(null)

      try {
        const response = await fetch(VERIFY_ENDPOINT, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ ...proof, action: 'vincent-signal-access' }),
        })

        const data = await response.json().catch(() => null)
        if (!response.ok) {
          throw new Error(data?.error || 'World ID verification failed')
        }

        if (data?.token) {
          localStorage.setItem('worldIdToken', data.token)
          setToken(data.token)
        }
      } catch (err) {
        setError((err as Error).message || 'Verification failed')
        throw err
      } finally {
        setVerifying(false)
      }
    }

    window.IDKit.init({
      app_id: appId,
      action: 'vincent-signal-access',
      verification_level: 'device',
      action_description: 'Verify your World ID to access trading signals',
      handleVerify: verifyProof,
      onSuccess: () => {
        console.log('World ID verification successful')
      },
      onError: (err) => {
        setError(err?.message || err?.code || 'Verification failed')
        setVerifying(false)
      },
    })
    setInitialized(true)
  }, [appId])

  const openWidget = useCallback(() => {
    if (window.IDKit?.isInitialized) {
      setError(null)
      window.IDKit.open()
    } else {
      setError('IDKit not initialized. Please refresh the page.')
    }
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
        ) : !initialized ? (
          <div className="flex items-center gap-2 text-sm text-text-muted">
            <Loader2 className="w-4 h-4 animate-spin" />
            Loading World ID...
          </div>
        ) : (
          <button
            onClick={openWidget}
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
