import { createPublicClient, http } from 'viem'
import { sepolia } from 'viem/chains'
import { signalRegistryAddress } from './supabase'

const signalRegistryAbi = [
  {
    name: 'latestReport',
    type: 'function',
    stateMutability: 'view',
    inputs: [],
    outputs: [
      { name: 'dataHash', type: 'bytes32' },
      { name: 'signal', type: 'uint8' },
      { name: 'confidence', type: 'uint8' },
      { name: 'timestamp', type: 'uint256' },
      { name: 'asset', type: 'string' },
      { name: 'price', type: 'uint256' },
      { name: 'sentiment', type: 'int256' },
    ],
  },
] as const

export type ChainReport = {
  dataHash: `0x${string}`
  signal: number
  confidence: number
  timestamp: number
  asset: string
  price: number
  sentiment: number
}

export const signalNames = ['HOLD', 'BUY', 'SELL'] as const

const client = createPublicClient({
  chain: sepolia,
  transport: http(),
})

export async function getLatestReport(): Promise<ChainReport | null> {
  try {
    const raw = await client.readContract({
      address: signalRegistryAddress,
      abi: signalRegistryAbi,
      functionName: 'latestReport',
    })

    const [dataHash, signal, confidence, timestamp, asset, price, sentiment] = raw

    return {
      dataHash,
      signal: Number(signal),
      confidence: Number(confidence),
      timestamp: Number(timestamp),
      asset,
      price: Number(price) / 100,
      sentiment: Number(sentiment),
    }
  } catch (error) {
    console.error('Failed to read latest report', error)
    return null
  }
}
