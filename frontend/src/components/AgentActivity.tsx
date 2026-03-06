import { Bot, CircleDollarSign, Activity, Clock } from 'lucide-react'
import { useEffect, useState } from 'react'

type AgentPayment = {
  id: string
  timestamp: string
  amount: string
  status: 'settled' | 'pending'
}

type AgentDecision = {
  asset: string
  action: string
  confidence: number
  timestamp: string
}

export function AgentActivity() {
  const [isConnected, setIsConnected] = useState(false)
  const [payments, setPayments] = useState<AgentPayment[]>([])
  const [decisions, setDecisions] = useState<AgentDecision[]>([])
  const [totalSpent, setTotalSpent] = useState(0)
  const [lastPing, setLastPing] = useState<string | null>(null)

  // Simulate agent activity for demo
  useEffect(() => {
    // Check if agent is running by pinging the server
    const checkAgent = async () => {
      try {
        const token = localStorage.getItem('worldIdToken')
        const res = await fetch('http://localhost:4021/api/signals', {
          method: 'HEAD',
          headers: token ? { 'x-world-id-token': token } : undefined,
        })
        setIsConnected(res.status === 402 || res.status === 200)
        setLastPing(new Date().toLocaleTimeString())
      } catch {
        setIsConnected(false)
      }
    }

    checkAgent()
    const interval = setInterval(checkAgent, 10000)

    // Simulated activity for demo purposes
    const demoPayments: AgentPayment[] = [
      { id: '1', timestamp: new Date(Date.now() - 60000).toISOString(), amount: '$0.01', status: 'settled' },
      { id: '2', timestamp: new Date(Date.now() - 120000).toISOString(), amount: '$0.01', status: 'settled' },
      { id: '3', timestamp: new Date(Date.now() - 180000).toISOString(), amount: '$0.01', status: 'settled' },
    ]
    
    const demoDecisions: AgentDecision[] = [
      { asset: 'BTC', action: 'HOLD', confidence: 30, timestamp: new Date(Date.now() - 60000).toISOString() },
      { asset: 'ETH', action: 'HOLD', confidence: 25, timestamp: new Date(Date.now() - 90000).toISOString() },
      { asset: 'SOL', action: 'BUY', confidence: 65, timestamp: new Date(Date.now() - 120000).toISOString() },
    ]

    setPayments(demoPayments)
    setDecisions(demoDecisions)
    setTotalSpent(0.03)

    return () => clearInterval(interval)
  }, [])

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
      <div className="grid grid-cols-3 divide-x divide-border border-b border-border">
        <div className="p-3 text-center">
          <div className="text-lg font-bold text-accent">{payments.length}</div>
          <div className="text-[10px] text-text-muted uppercase tracking-wider">Payments</div>
        </div>
        <div className="p-3 text-center">
          <div className="text-lg font-bold text-hold">${totalSpent.toFixed(2)}</div>
          <div className="text-[10px] text-text-muted uppercase tracking-wider">Spent</div>
        </div>
        <div className="p-3 text-center">
          <div className="text-lg font-bold text-text-primary">{decisions.length}</div>
          <div className="text-[10px] text-text-muted uppercase tracking-wider">Decisions</div>
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
