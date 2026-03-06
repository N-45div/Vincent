import { Bot, ExternalLink, Zap } from 'lucide-react'

export function Header() {
  return (
    <header className="border-b border-border/50 bg-surface-0/80 backdrop-blur-xl sticky top-0 z-50">
      <div className="max-w-7xl mx-auto px-6 py-3 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="relative">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-accent to-accent/60 flex items-center justify-center shadow-lg shadow-accent/20">
              <Bot className="w-5 h-5 text-white" />
            </div>
            <span className="absolute -bottom-0.5 -right-0.5 w-3 h-3 bg-buy rounded-full border-2 border-surface-0 animate-pulse" />
          </div>
          <div>
            <h1 className="text-xl font-bold tracking-tight bg-gradient-to-r from-white to-text-secondary bg-clip-text text-transparent">
              Vincent
            </h1>
            <p className="text-[11px] text-text-muted tracking-wide uppercase">
              Autonomous Signal Agent
            </p>
          </div>
        </div>

        <nav className="flex items-center gap-2">
          <div className="hidden sm:flex items-center gap-2 px-3 py-1.5 bg-surface-1 border border-border rounded-full text-xs">
            <span className="w-2 h-2 rounded-full bg-buy shadow-sm shadow-buy/50 animate-pulse" />
            <span className="text-text-secondary font-medium">Base Sepolia</span>
          </div>
          <a
            href="https://x402.org"
            target="_blank"
            rel="noopener noreferrer"
            className="hidden sm:flex items-center gap-1.5 px-3 py-1.5 text-xs text-text-muted hover:text-text-secondary transition-colors"
          >
            x402
            <ExternalLink className="w-3 h-3" />
          </a>
          <a
            href="https://docs.chain.link/cre"
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center gap-1.5 px-4 py-2 bg-accent text-white rounded-lg text-sm font-medium hover:bg-accent/90 transition-all shadow-lg shadow-accent/25"
          >
            <Zap className="w-3.5 h-3.5" />
            <span>CRE</span>
          </a>
        </nav>
      </div>
    </header>
  )
}
