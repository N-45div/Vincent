# Vincent Signal Attestator — CRE Workflow

This Chainlink CRE workflow powers the Vincent signal pipeline. It fetches market data, generates AI-driven trading signals, and attests them on-chain.

## What it does

1. **Fetches market data** — Pulls price data from external APIs
2. **Generates signal** — Calls an LLM (via OpenRouter) to analyze data and output BUY/SELL/HOLD with confidence
3. **Attests on-chain** — Writes the signal to Base Sepolia with cryptographic proof
4. **Stores in Supabase** — Saves signal data for frontend consumption

## Setup

### 1. Configure environment

Copy `.env.example` to `.env` and fill in:

```bash
CRE_ETH_PRIVATE_KEY=<your-funded-private-key>
OPENROUTER_API_KEY=<your-openrouter-key>
SUPABASE_URL=<your-supabase-url>
SUPABASE_SERVICE_KEY=<your-supabase-service-key>
```

### 2. Install dependencies

```bash
bun install
```

### 3. Simulate the workflow

From the project root:

```bash
cre workflow simulate ./signal-attestator -T staging-settings
```

### 4. Run continuously (for demo)

```bash
while true; do cre workflow simulate ./signal-attestator -T staging-settings; sleep 30; done
```

## Workflow Structure

- `workflow.ts` — Main workflow definition
- `config/` — Action configs and settings
- `staging-settings.yaml` — Staging environment configuration

## Chainlink CRE Integration

This workflow demonstrates:
- External API integration (market data)
- LLM integration (OpenRouter)
- On-chain attestation (Base Sepolia)
- Off-chain storage (Supabase)

Part of the [Vincent](https://github.com/N-45div/Vincent) project for the Chainlink Convergence Hackathon.
