import { createClient } from '@supabase/supabase-js'

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL as string
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY as string

export const signalRegistryAddress =
  (import.meta.env.VITE_SIGNAL_REGISTRY_ADDRESS as `0x${string}` | undefined) ??
  '0x0Fa25f00e71CE8E8BaD5E8E89d6b9C7882D2C923'

export const supabase = createClient(supabaseUrl, supabaseAnonKey)

export type Signal = {
  id: string
  asset: string
  signal: 'BUY' | 'SELL' | 'HOLD'
  confidence: number
  reasoning: string | null
  price_at_signal: number | null
  sentiment_score: number | null
  data_hash: string
  tx_hash: string | null
  created_at: string
}

export type PriceTick = {
  id: string
  asset: string
  price: number
  sentiment: number
  data_hash: string
  created_at: string
}

export type SignalMetric = {
  id: string
  asset: string
  signal_id: string
  signal_hash: string
  signal: 'BUY' | 'SELL' | 'HOLD'
  confidence: number
  previous_price: number
  current_price: number
  return_pct: number
  horizon_seconds: number | null
  correct: boolean
  created_at: string
}
