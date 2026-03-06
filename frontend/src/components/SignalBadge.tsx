import { TrendingUp, TrendingDown, Minus } from 'lucide-react'
import type { Signal } from '../lib/supabase'

type Props = {
  signal: Signal['signal']
  size?: 'sm' | 'lg'
}

const config = {
  BUY: {
    bg: 'bg-buy/10',
    border: 'border-buy/30',
    text: 'text-buy',
    icon: TrendingUp,
  },
  SELL: {
    bg: 'bg-sell/10',
    border: 'border-sell/30',
    text: 'text-sell',
    icon: TrendingDown,
  },
  HOLD: {
    bg: 'bg-hold/10',
    border: 'border-hold/30',
    text: 'text-hold',
    icon: Minus,
  },
}

export function SignalBadge({ signal, size = 'sm' }: Props) {
  const c = config[signal]
  const Icon = c.icon
  const sizeClass = size === 'lg' ? 'px-4 py-2 text-lg gap-2' : 'px-2 py-1 text-xs gap-1'

  return (
    <span
      className={`inline-flex items-center font-mono font-semibold uppercase tracking-wider rounded border ${c.bg} ${c.border} ${c.text} ${sizeClass}`}
    >
      <Icon className={size === 'lg' ? 'w-5 h-5' : 'w-3 h-3'} />
      {signal}
    </span>
  )
}
