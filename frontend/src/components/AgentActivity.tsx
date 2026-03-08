import { Bot, CircleDollarSign, Activity, Clock, RefreshCw } from 'lucide-react'
import { useEffect, useState, useCallback } from 'react'
import { createClient } from '@supabase/supabase-js'

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY
const supabase = supabaseUrl && supabaseAnonKey ? createClient(supabaseUrl, supabaseAnonKey) : null

type AgentDecision = {
  asset: string
  action: string
  confidence: number
  timestamp: string
}

export function AgentActivity() {
  const [isConnected, setIsConnected] = useState(false)
  const [decisions, setDecisions] = useState<AgentDecision[]>([])
  const [totalSignals, setTotalSignals] = useState(0)
  const [lastPing, setLastPing] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)

  const fetchSignals = useCallback(async () => {
    if (!supabase) return
    
    setLoading(true)
    try {
      const { data, error, count } = await supabase
        .from('signals')
        .select('*', { count: 'exact' })
        .order('created_at', { ascending: false })
        .limit(10)

      if (error) throw error

      if (data) {
        const mapped: AgentDecision[] = data.map((row: { asset: string; signal: string; confidence: number; created_at: string }) => ({
          asset: row.asset,
          action: row.signal,
          confidence: row.confidence,
          timestamp: row.created_at,
        }))
        setDecisions(mapped)
        setTotalSignals(count || data.length)
      }
      setLastPing(new Date().toLocaleTimeString())
    } catch (err) {
      console.error('Failed to fetch signals:', err)
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    // Check if agent/server is running
    const checkAgent = async () => {
      try {
        const token = localStorage.getItem('worldIdToken')
        const res = await fetch('http://localhost:4021/api/signals', {
          method: 'HEAD',
          headers: token ? { 'x-world-id-token': token } : undefined,
        })
        setIsConnected(res.status === 402 || res.status === 200)
      } catch {
        setIsConnected(false)
      }
    }

    checkAgent()
    fetchSignals()

    const agentInterval = setInterval(checkAgent, 10000)
    const signalInterval = setInterval(fetchSignals, 5000)

    // Real-time subscription
    if (supabase) {
      const channel = supabase
        .channel('signals-realtime')
        .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'signals' }, () => {
          fetchSignals()
        })
        .subscribe()

      return () => {
        clearInterval(agentInterval)
        clearInterval(signalInterval)
        channel.unsubscribe()
      }
    }

    return () => {
      clearInterval(agentInterval)
      clearInterval(signalInterval)
    }
  }, [fetchSignals])

  return (
    <div className="bg-surface-1 border border-border rounded-xl overflow-hidden">
      {/* Header */}
      <div className="bg-gradient-to-r from-accent/10 to-transparent p-4 border-b border-border">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="relative">
              <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-accent to-accent/60 flex items-center justify-center">
                <Bot className="w-5 h-5 text-white" />
              </div>
              <span className={`absolute -bottom-0.5 -right-0.5 w-3 h-3 rounded-full border-2 border-surface-1 ${
                isConnected ? 'bg-buy animate-pulse' : 'bg-text-muted'
              }`} />
            </div>
            <div>
              <h3 className="font-semibold">Vincent Agent</h3>
              <p className="text-xs text-text-muted">Autonomous x402 Consumer</p>
            </div>
          </div>
          <div className={`px-2.5 py-1 rounded-full text-xs font-medium ${
            isConnected 
              ? 'bg-buy/10 text-buy border border-buy/20' 
              : 'bg-surface-2 text-text-muted border border-border'
          }`}>
            {isConnected ? 'Active' : 'Offline'}
          </div>
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 divide-x divide-border border-b border-border">
        <div className="p-3 text-center">
          <div className="text-lg font-bold text-accent flex items-center justify-center gap-1">
            {totalSignals}
            {loading && <RefreshCw className="w-3 h-3 animate-spin text-text-muted" />}
          </div>
          <div className="text-[10px] text-text-muted uppercase tracking-wider">Total Signals</div>
        </div>
        <div className="p-3 text-center">
          <div className="text-lg font-bold text-text-primary">{decisions.length}</div>
          <div className="text-[10px] text-text-muted uppercase tracking-wider">Recent</div>
        </div>
      </div>

      {/* Recent Activity */}
      <div className="p-4 space-y-3">
        <div className="flex items-center justify-between">
          <span className="text-xs text-text-muted uppercase tracking-wider">Live Activity</span>
          {lastPing && (
            <span className="text-[10px] text-text-muted flex items-center gap-1">
              <Clock className="w-3 h-3" />
              {lastPing}
            </span>
          )}
        </div>

        <div className="space-y-2">
          {decisions.slice(0, 3).map((d, i) => (
            <div 
              key={i}
              className="flex items-center justify-between py-2 px-3 bg-surface-0 rounded-lg border border-border/50"
            >
              <div className="flex items-center gap-2">
                <div className={`w-6 h-6 rounded-md flex items-center justify-center text-[10px] font-bold ${
                  d.action === 'BUY' ? 'bg-buy/10 text-buy' :
                  d.action === 'SELL' ? 'bg-sell/10 text-sell' :
                  'bg-hold/10 text-hold'
                }`}>
                  {d.asset[0]}
                </div>
                <div>
                  <div className="text-sm font-medium">{d.asset}</div>
                  <div className="text-[10px] text-text-muted">
                    {new Date(d.timestamp).toLocaleTimeString()}
                  </div>
                </div>
              </div>
              <div className="text-right">
                <div className={`text-sm font-semibold ${
                  d.action === 'BUY' ? 'text-buy' :
                  d.action === 'SELL' ? 'text-sell' :
                  'text-hold'
                }`}>
                  {d.action}
                </div>
                <div className="text-[10px] text-text-muted">{d.confidence}% conf</div>
              </div>
            </div>
          ))}
        </div>

        {/* Payment indicator */}
        <div className="flex items-center gap-2 py-2 px-3 bg-accent/5 rounded-lg border border-accent/20">
          <CircleDollarSign className="w-4 h-4 text-accent" />
          <span className="text-xs text-text-secondary">
            Agent pays <span className="text-accent font-semibold">$0.01 USDC</span> per signal fetch via x402
          </span>
        </div>
      </div>

      {/* Footer */}
      <div className="px-4 py-3 bg-surface-0/50 border-t border-border flex items-center justify-between">
        <div className="flex items-center gap-1.5 text-[11px] text-text-muted">
          <Activity className="w-3 h-3" />
          <span>Powered by LangChain + OpenRouter</span>
        </div>
        <a
          href="https://x402.org"
          target="_blank"
          rel="noopener noreferrer"
          className="text-[11px] text-accent hover:underline"
        >
          x402 Protocol →
        </a>
      </div>
    </div>
  )
}
