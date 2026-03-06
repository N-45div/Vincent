interface IDKitSessionConfig {
  app_id: `app_${string}`
  action: string
  verification_level?: 'orb' | 'device'
  signal?: string
  environment?: 'production' | 'staging'
}

interface IDKitSessionStatus {
  state: 'awaiting_connection' | 'awaiting_app' | 'confirmed' | 'failed'
  result: {
    merkle_root: string
    nullifier_hash: string
    proof: string
    verification_level: string
  } | null
  errorCode: string | null
  sessionURI: string | null
}

interface IDKitSession {
  create: (config: IDKitSessionConfig) => Promise<void>
  pollStatus: () => Promise<IDKitSessionStatus>
  getURI: () => string | null
  destroy: () => void
  readonly isActive: boolean
}

declare global {
  interface Window {
    IDKitSession: IDKitSession
  }
}

export {}
