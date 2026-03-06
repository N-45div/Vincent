# Vincent Architecture

Detailed architecture diagrams for the Vincent autonomous trading signal system.

## System Overview

```mermaid
flowchart TB
    subgraph External["External Data Sources"]
        CG[CoinGecko API]
        LC[LunarCrush API]
        OR[OpenRouter API]
    end

    subgraph CRE["Chainlink CRE Workflow"]
        direction TB
        FP[Fetch Price]
        FS[Fetch Sentiment]
        AI[AI Decision Engine]
        AT[Attest Signal]
        
        FP --> AI
        FS --> AI
        AI --> AT
    end

    subgraph Storage["Data Layer"]
        SB[(Supabase)]
        ETH[Ethereum Sepolia]
    end

    subgraph X402["x402 Payment Layer"]
        MW[Payment Middleware]
        PAY[PayAI Facilitator]
        USDC[USDC Contract]
    end

    subgraph Consumers["Signal Consumers"]
        AG[Vincent Agent]
        FE[Frontend Dashboard]
    end

    CG --> FP
    LC --> FS
    OR --> AI
    AT --> SB
    AT --> ETH
    SB --> MW
    MW --> PAY
    PAY --> USDC
    MW --> AG
    MW --> FE
    SB --> FE
    ETH --> FE
```

## CRE Workflow Detail

```mermaid
sequenceDiagram
    participant Cron as Cron Trigger
    participant CRE as CRE Workflow
    participant CG as CoinGecko
    participant LC as LunarCrush
    participant OR as OpenRouter
    participant SB as Supabase
    participant ETH as Ethereum Sepolia

    Cron->>CRE: Trigger (every 30s)
    
    par Fetch Data
        CRE->>CG: GET /simple/price
        CG-->>CRE: {btc: 68000, eth: 2000, sol: 85}
        CRE->>LC: GET /public/coins
        LC-->>CRE: {sentiment: 65}
    end

    CRE->>OR: POST /chat/completions
    Note over CRE,OR: Analyze price + sentiment
    OR-->>CRE: {signal: "BUY", confidence: 75}

    par Store Results
        CRE->>SB: INSERT signals
        CRE->>SB: INSERT price_ticks
        CRE->>ETH: SignalRegistry.attest()
    end

    CRE-->>Cron: "Signals attested: BTC, ETH, SOL"
```

## x402 Payment Flow

```mermaid
sequenceDiagram
    participant Agent as Vincent Agent
    participant Server as x402 Server
    participant MW as Payment Middleware
    participant PAY as PayAI Facilitator
    participant USDC as USDC Contract
    participant SB as Supabase

    Agent->>Server: GET /api/signals
    Server->>MW: Check payment
    MW-->>Agent: 402 Payment Required
    Note over MW,Agent: Header: payment-required (base64 JSON)

    Agent->>Agent: Sign EIP-3009 Authorization
    Note over Agent: TransferWithAuthorization signature

    Agent->>Server: GET /api/signals
    Note over Agent,Server: Header: X-PAYMENT (signed auth)
    
    Server->>MW: Verify payment
    MW->>PAY: POST /verify
    PAY-->>MW: {valid: true}
    
    MW->>PAY: POST /settle
    PAY->>USDC: transferWithAuthorization()
    USDC-->>PAY: tx: 0x...
    PAY-->>MW: {settled: true, tx: 0x...}
    
    MW->>SB: SELECT signals
    SB-->>MW: [{signal: "BUY", ...}]
    MW-->>Agent: 200 OK + signals
    Note over MW,Agent: Header: payment-response
```

## Agent Decision Loop

```mermaid
flowchart LR
    subgraph Agent["Vincent Agent (Python)"]
        direction TB
        INIT[Initialize]
        FETCH[Fetch Signals Tool]
        ANALYZE[Analyze Sentiment Tool]
        DECIDE[Record Decision Tool]
        STATS[Get Stats Tool]
        SLEEP[Sleep 60s]
    end

    subgraph LLM["LangChain + OpenRouter"]
        GPT[GPT-4o]
    end

    INIT --> GPT
    GPT --> FETCH
    FETCH --> GPT
    GPT --> ANALYZE
    ANALYZE --> GPT
    GPT --> DECIDE
    DECIDE --> GPT
    GPT --> STATS
    STATS --> SLEEP
    SLEEP --> GPT
```

## Data Models

```mermaid
erDiagram
    SIGNALS {
        uuid id PK
        string asset
        enum signal "BUY|SELL|HOLD"
        int confidence
        string reasoning
        float price_at_signal
        int sentiment_score
        string data_hash
        string tx_hash
        timestamp created_at
    }

    PRICE_TICKS {
        uuid id PK
        string asset
        float price
        int sentiment
        string data_hash
        timestamp created_at
    }

    SIGNAL_METRICS {
        uuid id PK
        string asset
        uuid signal_id FK
        string signal_hash
        enum signal
        int confidence
        float previous_price
        float current_price
        float return_pct
        int horizon_seconds
        boolean correct
        timestamp created_at
    }

    SIGNALS ||--o{ SIGNAL_METRICS : "has"
```

## Smart Contract Architecture

```mermaid
classDiagram
    class SignalRegistry {
        +address owner
        +mapping reports
        +attest(asset, signal, confidence, dataHash, price, sentiment)
        +getLatestReport(asset) Report
        +verifySignal(asset, dataHash) bool
    }

    class Report {
        +bytes32 dataHash
        +uint8 signal
        +uint8 confidence
        +uint256 timestamp
        +string asset
        +uint256 price
        +int256 sentiment
    }

    SignalRegistry --> Report : stores
```

## Frontend Component Tree

```mermaid
flowchart TB
    App[App.tsx]
    
    App --> Header
    App --> AssetTabs
    App --> SignalCard
    App --> MetricsPanel
    App --> PriceChart
    App --> ChainVerification
    App --> AgentActivity
    
    subgraph Components
        Header[Header.tsx]
        AssetTabs[AssetTabs.tsx]
        SignalCard[SignalCard.tsx]
        MetricsPanel[MetricsPanel.tsx]
        PriceChart[PriceChart.tsx]
        ChainVerification[ChainVerification.tsx]
        AgentActivity[AgentActivity.tsx]
    end

    subgraph Libraries
        Supabase[Supabase Client]
        Viem[Viem Chain Client]
        LWC[Lightweight Charts]
    end

    SignalCard --> Supabase
    PriceChart --> Supabase
    PriceChart --> LWC
    ChainVerification --> Viem
    AgentActivity --> Supabase
```

## Deployment Architecture

```mermaid
flowchart TB
    subgraph Development
        DEV_CRE[CRE Simulator]
        DEV_X402[x402 Server :4021]
        DEV_FE[Vite Dev :5173]
        DEV_AGENT[Python Agent]
    end

    subgraph Production
        PROD_CRE[CRE Deployed Workflow]
        PROD_X402[x402 Server Hosted]
        PROD_FE[Netlify/Vercel]
        PROD_AGENT[Agent Service]
    end

    subgraph External
        SB[(Supabase Cloud)]
        BC[Base Sepolia RPC]
        PAY[PayAI Facilitator]
        OR[OpenRouter API]
    end

    DEV_CRE --> SB
    DEV_CRE --> BC
    DEV_X402 --> SB
    DEV_X402 --> PAY
    DEV_FE --> SB
    DEV_FE --> BC
    DEV_AGENT --> DEV_X402
    DEV_AGENT --> OR
```

## Security Model

```mermaid
flowchart LR
    subgraph Secrets["Secret Management"]
        ENV[.env Files]
        CRE_SEC[CRE secrets.yaml]
    end

    subgraph Keys["Private Keys"]
        PAYER[Payer Wallet Key]
        RECEIVER[Receiver Address]
    end

    subgraph APIs["API Keys"]
        OR_KEY[OpenRouter Key]
        SB_KEY[Supabase Service Key]
    end

    ENV --> PAYER
    ENV --> OR_KEY
    ENV --> SB_KEY
    CRE_SEC --> OR_KEY
    CRE_SEC --> SB_KEY

    subgraph Protection["Protection Layer"]
        X402[x402 EIP-3009]
        GITIGNORE[.gitignore]
    end

    PAYER --> X402
    ENV --> GITIGNORE
```

## Network Topology

```mermaid
flowchart TB
    subgraph Internet
        CG[CoinGecko API]
        LC[LunarCrush API]
        OR[OpenRouter API]
        PAY[PayAI Facilitator]
    end

    subgraph BaseSepolia["Base Sepolia (Chain ID: 84532)"]
        USDC[USDC Contract<br/>0x036CbD53842c5426634e7929541eC2318f3dCF7e]
    end

    subgraph EthSepolia["Ethereum Sepolia (Chain ID: 11155111)"]
        SR[SignalRegistry<br/>0x0Fa25f00e71CE8E8BaD5E8E89d6b9C7882D2C923]
    end

    subgraph Supabase
        DB[(PostgreSQL)]
    end

    subgraph Local["Local Services"]
        X402[x402 Server<br/>:4021]
        FE[Frontend<br/>:5173]
        AGENT[Python Agent]
        CRE[CRE Simulator]
    end

    CRE --> CG
    CRE --> LC
    CRE --> OR
    CRE --> DB
    CRE --> SR

    X402 --> DB
    X402 --> PAY
    PAY --> USDC

    FE --> DB
    FE --> SR

    AGENT --> X402
    AGENT --> OR
```

---

## Key Addresses

| Contract | Network | Address |
|----------|---------|---------|
| USDC | Base Sepolia | `0x036CbD53842c5426634e7929541eC2318f3dCF7e` |
| SignalRegistry | Ethereum Sepolia | `0x0Fa25f00e71CE8E8BaD5E8E89d6b9C7882D2C923` |

## Key Endpoints

| Service | Endpoint | Description |
|---------|----------|-------------|
| x402 Server | `GET /api/signals` | Protected signal endpoint ($0.01 USDC) |
| x402 Server | `GET /api/paid-demo` | Demo endpoint with payment |
| PayAI | `POST /verify` | Verify payment signature |
| PayAI | `POST /settle` | Settle payment on-chain |
