type Props = {
  assets: string[]
  selected: string
  onSelect: (asset: string) => void
}

const ASSET_COLORS: Record<string, string> = {
  BTC: 'from-orange-500 to-amber-500',
  ETH: 'from-blue-500 to-indigo-500',
  SOL: 'from-purple-500 to-fuchsia-500',
}

export function AssetTabs({ assets, selected, onSelect }: Props) {
  return (
    <div className="flex gap-1.5 p-1.5 bg-surface-1 border border-border rounded-xl">
      {assets.map((asset) => (
        <button
          key={asset}
          onClick={() => onSelect(asset)}
          className={`relative px-5 py-2 text-sm font-semibold rounded-lg transition-all ${
            selected === asset
              ? 'text-white'
              : 'text-text-muted hover:text-text-secondary hover:bg-surface-2'
          }`}
        >
          {selected === asset && (
            <span
              className={`absolute inset-0 rounded-lg bg-gradient-to-r ${ASSET_COLORS[asset] || 'from-accent to-accent/60'} shadow-lg`}
            />
          )}
          <span className="relative z-10">{asset}</span>
        </button>
      ))}
    </div>
  )
}
