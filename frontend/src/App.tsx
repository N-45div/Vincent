import { useEffect, useState } from 'react'
import { supabase, type Signal, type PriceTick, type SignalMetric } from './lib/supabase'
import { getLatestReport, type ChainReport } from './lib/chain'
import { Header } from './components/Header'
import { AssetTabs } from './components/AssetTabs'
import { SignalCard } from './components/SignalCard'
import { MetricsPanel } from './components/MetricsPanel'
import { PriceChart } from './components/PriceChart'
import { ChainVerification } from './components/ChainVerification'
import { AgentActivity } from './components/AgentActivity'

const ASSETS = ['BTC', 'ETH', 'SOL']

function App() {
  const [signals, setSignals] = useState<Signal[]>([])
  const [ticks, setTicks] = useState<PriceTick[]>([])
  const [metrics, setMetrics] = useState<SignalMetric[]>([])
  const [loading, setLoading] = useState(true)
  const [ticksLoading, setTicksLoading] = useState(true)
  const [metricsLoading, setMetricsLoading] = useState(true)
  const [chainReport, setChainReport] = useState<ChainReport | null>(null)
  const [chainLoading, setChainLoading] = useState(true)
  const [selectedAsset, setSelectedAsset] = useState('BTC')

  useEffect(() => {
    const fetchSignals = async () => {
      const { data, error } = await supabase
        .from('signals')
        .select('*')
        .order('created_at', { ascending: false })
        .limit(100)

      if (!error && data) {
        setSignals(data as Signal[])
      }
      setLoading(false)
    }

    const fetchTicks = async () => {
      const { data, error } = await supabase
        .from('price_ticks')
        .select('*')
        .order('created_at', { ascending: false })
        .limit(200)

      if (!error && data) {
        setTicks(data as PriceTick[])
      }
      setTicksLoading(false)
    }

    const fetchMetrics = async () => {
      const { data, error } = await supabase
        .from('signal_metrics')
        .select('*')
        .order('created_at', { ascending: false })
        .limit(100)

      if (!error && data) {
        setMetrics(data as SignalMetric[])
      }
      setMetricsLoading(false)
    }

    const fetchChainReport = async () => {
      const report = await getLatestReport()
      setChainReport(report)
      setChainLoading(false)
    }

    fetchSignals()
    fetchTicks()
    fetchMetrics()
    fetchChainReport()

    const chainInterval = setInterval(fetchChainReport, 30000)

    const channel = supabase
      .channel('signals-realtime')
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'signals' },
        (payload) => {
          setSignals((prev) => [payload.new as Signal, ...prev])
        }
      )
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'price_ticks' },
        (payload) => {
          setTicks((prev) => [payload.new as PriceTick, ...prev].slice(0, 200))
        }
      )
      .subscribe()

    return () => {
      supabase.removeChannel(channel)
      clearInterval(chainInterval)
    }
  }, [])

  const filteredSignals = signals.filter((s) => s.asset === selectedAsset)
  const filteredTicks = ticks.filter((t) => t.asset === selectedAsset)
  const filteredMetrics = metrics.filter((m) => m.asset === selectedAsset)
  const latestSignal = filteredSignals[0] ?? null

  return (
    <div className="min-h-screen bg-surface-0">
      <Header />

      <main className="max-w-7xl mx-auto px-6 py-8 space-y-8">
        <section className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            <h2 className="text-2xl font-bold tracking-tight">Live Signals</h2>
            <p className="text-text-muted text-sm mt-1">
              AI-generated trading signals attested on-chain via <span className="text-accent font-medium">Chainlink CRE</span>
            </p>
          </div>
          <AssetTabs assets={ASSETS} selected={selectedAsset} onSelect={setSelectedAsset} />
        </section>

        <section>
          <MetricsPanel metrics={filteredMetrics} loading={metricsLoading} />
        </section>

        <section className="grid lg:grid-cols-3 gap-6">
          <div className="lg:col-span-2 space-y-6">
            <PriceChart ticks={filteredTicks} loading={ticksLoading} />
            
            {latestSignal ? (
              <SignalCard signal={latestSignal} isLatest />
            ) : loading ? (
              <div className="bg-surface-1 border border-border rounded-lg p-6">
                <div className="h-6 bg-surface-3 rounded w-1/3 mb-4 animate-pulse" />
                <div className="h-4 bg-surface-3 rounded w-2/3 animate-pulse" />
              </div>
            ) : (
              <div className="bg-surface-1 border border-border rounded-lg p-6 text-center text-text-muted">
                No signals for {selectedAsset} yet
              </div>
            )}

            <ChainVerification
              latest={latestSignal}
              report={chainReport}
              loading={chainLoading}
            />
          </div>

          <div className="space-y-6">
            <AgentActivity />

            <div className="bg-surface-1 border border-border rounded-lg p-6">
              <h3 className="text-xs text-text-muted uppercase tracking-wider mb-4">
                Recent Signals
              </h3>
              <div className="space-y-3">
                {filteredSignals.slice(1, 6).map((s) => (
                  <div
                    key={s.id}
                    className="flex items-center justify-between py-2 border-b border-border last:border-0"
                  >
                    <div className="flex items-center gap-2">
                      <span
                        className={`text-sm font-mono ${
                          s.signal === 'BUY'
                            ? 'text-buy'
                            : s.signal === 'SELL'
                            ? 'text-sell'
                            : 'text-hold'
                        }`}
                      >
                        {s.signal}
                      </span>
                      <span className="text-xs text-text-muted">{s.confidence}%</span>
                    </div>
                    <span className="text-xs text-text-muted font-mono">
                      {new Date(s.created_at).toLocaleTimeString('en-US', {
                        hour: '2-digit',
                        minute: '2-digit',
                      })}
                    </span>
                  </div>
                ))}
                {filteredSignals.length <= 1 && (
                  <p className="text-sm text-text-muted text-center py-4">
                    No history yet
                  </p>
                )}
              </div>
            </div>

            <div className="bg-surface-1 border border-border rounded-lg p-6">
              <h3 className="text-xs text-text-muted uppercase tracking-wider mb-3">
                Powered By
              </h3>
              <div className="flex flex-wrap gap-2">
                {[
                  { name: 'Chainlink CRE', accent: true },
                  { name: 'OpenRouter' },
                  { name: 'x402' },
                  { name: 'LangChain' },
                  { name: 'Base' },
                ].map((t) => (
                  <span
                    key={t.name}
                    className={`px-2.5 py-1 text-xs font-medium rounded-full border ${
                      t.accent
                        ? 'bg-accent/10 border-accent/30 text-accent'
                        : 'bg-surface-2 border-border text-text-secondary'
                    }`}
                  >
                    {t.name}
                  </span>
                ))}
              </div>
            </div>
          </div>
        </section>
      </main>

      <footer className="border-t border-border/50 py-8 mt-16">
        <div className="max-w-7xl mx-auto px-6">
          <div className="flex flex-col sm:flex-row items-center justify-between gap-4">
            <div className="flex items-center gap-2">
              <span className="text-sm font-medium text-text-secondary">Vincent</span>
              <span className="text-text-muted">·</span>
              <span className="text-xs text-text-muted">Chainlink CRE & AI Hackathon</span>
            </div>
            <div className="flex items-center gap-4 text-xs text-text-muted">
              <span className="font-mono px-2 py-1 bg-surface-1 rounded">BTC</span>
              <span className="font-mono px-2 py-1 bg-surface-1 rounded">ETH</span>
              <span className="font-mono px-2 py-1 bg-surface-1 rounded">SOL</span>
            </div>
          </div>
        </div>
      </footer>
    </div>
  )
}

export default App
