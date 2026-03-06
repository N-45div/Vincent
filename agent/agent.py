"""
Vincent Signal Consumer Agent
Autonomous AI agent that consumes CRE workflow signals via x402 payments

This agent demonstrates the "AI agents consuming CRE workflows with x402 payments" use case
for the Chainlink CRE & AI hackathon track.
"""

import os
import time
import json
from datetime import datetime
from typing import Optional, List
from dotenv import load_dotenv
from rich.console import Console
from rich.panel import Panel
from rich.table import Table
from rich.live import Live
from pydantic import BaseModel, Field

from langchain_openai import ChatOpenAI
from langchain_core.tools import tool
from langchain_core.messages import HumanMessage, SystemMessage, AIMessage
from langgraph.prebuilt import create_react_agent

load_dotenv()
console = Console()


# ============================================================================
# Configuration
# ============================================================================

OPENROUTER_API_KEY = os.getenv("OPENROUTER_API_KEY")
OPENROUTER_MODEL = os.getenv("OPENROUTER_MODEL", "openai/gpt-4o")
X402_SIGNAL_URL = os.getenv("X402_SIGNAL_URL", "http://localhost:4021/api/signals")
PAYER_PRIVATE_KEY = os.getenv("PAYER_PRIVATE_KEY")
WORLD_ID_TOKEN = os.getenv("WORLD_ID_TOKEN")
WORLD_ID_TOKEN_URL = os.getenv("WORLD_ID_TOKEN_URL", "http://localhost:4021/api/world-id/token")
WORLD_ID_ADMIN_SECRET = os.getenv("WORLD_ID_ADMIN_SECRET")
AGENT_INTERVAL = int(os.getenv("AGENT_INTERVAL", "60"))


# ============================================================================
# State
# ============================================================================

class AgentState:
    """Persistent state for the agent across runs"""
    
    def __init__(self):
        self.last_signals: dict = {}
        self.decisions: List[dict] = []
        self.payments_made: int = 0
        self.total_spent_usd: float = 0.0
    
    def record_decision(self, asset: str, signal: str, confidence: int, action: str, reasoning: str):
        self.decisions.append({
            "timestamp": datetime.now().isoformat(),
            "asset": asset,
            "signal": signal,
            "confidence": confidence,
            "action": action,
            "reasoning": reasoning,
        })
    
    def record_payment(self, amount_usd: float):
        self.payments_made += 1
        self.total_spent_usd += amount_usd


agent_state = AgentState()
world_id_cache = {"token": WORLD_ID_TOKEN, "expiresAt": None}


def get_world_id_token() -> Optional[str]:
    token = world_id_cache.get("token")
    expires_at = world_id_cache.get("expiresAt")
    if token and (expires_at is None or expires_at > int(time.time() * 1000) + 10000):
        return token

    if not WORLD_ID_TOKEN_URL:
        return token

    try:
        import httpx

        headers = {"x-world-id-admin": WORLD_ID_ADMIN_SECRET} if WORLD_ID_ADMIN_SECRET else None
        response = httpx.get(WORLD_ID_TOKEN_URL, headers=headers, timeout=10.0)
        data = response.json() if response.status_code == 200 else None
        if data and data.get("token"):
            world_id_cache["token"] = data["token"]
            world_id_cache["expiresAt"] = data.get("expiresAt")
            return data["token"]
    except Exception:
        return token

    return token


# ============================================================================
# Tools
# ============================================================================

@tool
def fetch_signals_with_payment() -> str:
    """
    Fetch the latest trading signals from the CRE workflow via x402 payment.
    This tool automatically handles the payment flow using EIP-3009 USDC authorization.
    The payment is processed by the PayAI facilitator on Base Sepolia.
    
    Returns a JSON string with signals for BTC, ETH, SOL including:
    - signal: BUY, SELL, or HOLD
    - confidence: 0-100
    - price_at_signal: current price when signal was generated
    - payment transaction hash
    """
    global agent_state
    
    import httpx

    # Use the paid-demo endpoint which handles x402 payment via official client
    paid_url = X402_SIGNAL_URL.replace("/api/signals", "/api/paid-demo")
    world_id_token = get_world_id_token()

    console.print("[yellow]🔐 Fetching signals via x402 payment...[/yellow]")

    try:
        with httpx.Client(timeout=60.0) as http:
            headers = {"x-world-id-token": world_id_token} if world_id_token else None
            response = http.get(paid_url, headers=headers)
            data = response.json()
    except Exception as e:
        console.print(f"[red]❌ Connection error: {e}[/red]")
        return json.dumps({"error": f"Connection failed: {str(e)}"})
    
    # Check for errors
    if data.get("error"):
        console.print(f"[red]❌ x402 error: {data['error']}[/red]")
        return json.dumps({"error": data["error"]})
    
    # Check payment status
    payment = data.get("payment", {})
    if payment.get("success"):
        agent_state.record_payment(0.01)  # $0.01 per request
        tx_hash = payment.get("transaction", "")
        console.print(f"[green]✅ Payment settled! Tx: {tx_hash[:20]}...[/green]")
    elif data.get("paymentError"):
        console.print(f"[yellow]⚠️ Payment issue: {data['paymentError']}[/yellow]")
    
    # Extract signals from body
    body = data.get("body", {})
    if body and "signals" in body:
        signals = body["signals"]
        agent_state.last_signals = {s["asset"]: s for s in signals}
        return json.dumps({
            "signals": signals[:5], 
            "payment_settled": payment.get("success", False),
            "payment_tx": payment.get("transaction"),
        })
    
    return json.dumps({"error": "No signals in response", "raw": data})


@tool
def analyze_market_sentiment(asset: str) -> str:
    """
    Analyze the current market sentiment and recent signals for a specific asset.
    
    Args:
        asset: The asset symbol to analyze (BTC, ETH, or SOL)
    
    Returns analysis of the asset's recent signals and sentiment.
    """
    global agent_state
    
    if asset not in agent_state.last_signals:
        return json.dumps({"error": f"No signals available for {asset}. Fetch signals first."})
    
    signal = agent_state.last_signals[asset]
    
    return json.dumps({
        "asset": asset,
        "latest_signal": signal.get("signal"),
        "confidence": signal.get("confidence"),
        "price": signal.get("price_at_signal"),
        "timestamp": signal.get("created_at"),
        "data_hash": signal.get("data_hash"),
    })


@tool
def record_trading_decision(asset: str, action: str, reasoning: str) -> str:
    """
    Record a trading decision made by the agent.
    
    Args:
        asset: The asset symbol (BTC, ETH, SOL)
        action: The action taken (BUY, SELL, HOLD, or SKIP)
        reasoning: Brief explanation of why this decision was made
    
    Returns confirmation of the recorded decision.
    """
    global agent_state
    
    signal_data = agent_state.last_signals.get(asset, {})
    
    agent_state.record_decision(
        asset=asset,
        signal=signal_data.get("signal", "UNKNOWN"),
        confidence=signal_data.get("confidence", 0),
        action=action,
        reasoning=reasoning,
    )
    
    return json.dumps({
        "recorded": True,
        "asset": asset,
        "action": action,
        "total_decisions": len(agent_state.decisions),
    })


@tool
def get_agent_stats() -> str:
    """
    Get statistics about the agent's activity.
    
    Returns:
        - Number of payments made
        - Total USD spent on signals
        - Number of decisions recorded
        - Recent decisions summary
    """
    global agent_state
    
    recent = agent_state.decisions[-5:] if agent_state.decisions else []
    
    return json.dumps({
        "payments_made": agent_state.payments_made,
        "total_spent_usd": agent_state.total_spent_usd,
        "total_decisions": len(agent_state.decisions),
        "recent_decisions": recent,
    })


# ============================================================================
# Agent Setup
# ============================================================================

SYSTEM_PROMPT = """You are Vincent, an autonomous AI trading signal consumer agent.

Your job is to:
1. Periodically fetch trading signals from the CRE workflow (paying via x402)
2. Analyze the signals for BTC, ETH, and SOL
3. Make and record trading decisions based on the signals

IMPORTANT RULES:
- Always use fetch_signals_with_payment first to get fresh data
- For each asset in the signals, analyze the signal and confidence
- Record your decision for each asset using record_trading_decision
- Be conservative: only recommend BUY/SELL if confidence > 60%
- If confidence is low, record HOLD or SKIP with reasoning

You are paying real USDC (testnet) for each signal fetch, so be efficient.
After analyzing, summarize what you did and your reasoning.
"""


def create_agent():
    """Create the LangChain ReAct agent with OpenRouter"""
    
    llm = ChatOpenAI(
        model=OPENROUTER_MODEL,
        openai_api_key=OPENROUTER_API_KEY,
        openai_api_base="https://openrouter.ai/api/v1",
        default_headers={
            "HTTP-Referer": "https://vincent.cre-attest.demo",
            "X-Title": "Vincent Signal Consumer Agent",
        },
    )
    
    tools = [
        fetch_signals_with_payment,
        analyze_market_sentiment,
        record_trading_decision,
        get_agent_stats,
    ]
    
    agent = create_react_agent(llm, tools)
    
    return agent


# ============================================================================
# Main Loop
# ============================================================================

def display_status():
    """Display agent status in a nice table"""
    global agent_state
    
    table = Table(title="Vincent Agent Status")
    table.add_column("Metric", style="cyan")
    table.add_column("Value", style="green")
    
    # Get wallet from env
    from eth_account import Account
    wallet = Account.from_key(PAYER_PRIVATE_KEY).address if PAYER_PRIVATE_KEY else "Not configured"
    table.add_row("Wallet", wallet)
    table.add_row("Payments Made", str(agent_state.payments_made))
    table.add_row("Total Spent", f"${agent_state.total_spent_usd:.2f} USDC")
    table.add_row("Decisions Recorded", str(len(agent_state.decisions)))
    
    if agent_state.last_signals:
        for asset, sig in agent_state.last_signals.items():
            table.add_row(f"{asset} Signal", f"{sig.get('signal')} ({sig.get('confidence')}%)")
    
    console.print(table)


def run_agent_cycle(agent):
    """Run one cycle of the agent"""
    
    console.print(Panel.fit(
        f"[bold blue]🤖 Agent Cycle Started[/bold blue]\n"
        f"Time: {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}",
        border_style="blue",
    ))
    
    messages = [
        SystemMessage(content=SYSTEM_PROMPT),
        HumanMessage(content=(
            "Fetch the latest signals, analyze them, and record your trading decisions. "
            "Be thorough but efficient - this costs real USDC."
        )),
    ]
    
    try:
        result = agent.invoke({"messages": messages})
        
        # Extract final response
        final_message = result["messages"][-1]
        if hasattr(final_message, "content"):
            console.print(Panel(
                final_message.content,
                title="[bold green]Agent Response[/bold green]",
                border_style="green",
            ))
    except Exception as e:
        console.print(f"[red]❌ Agent error: {e}[/red]")
    
    display_status()


def main():
    """Main entry point"""
    from eth_account import Account
    
    console.print(Panel.fit(
        "[bold magenta]🚀 Vincent Signal Consumer Agent[/bold magenta]\n"
        "Autonomous AI agent consuming CRE workflow signals via x402 payments\n"
        "Chainlink CRE & AI Hackathon Demo",
        border_style="magenta",
    ))
    
    # Validate config
    if not OPENROUTER_API_KEY:
        console.print("[red]❌ Missing OPENROUTER_API_KEY[/red]")
        return
    
    if not PAYER_PRIVATE_KEY:
        console.print("[red]❌ Missing PAYER_PRIVATE_KEY[/red]")
        return
    
    # Show wallet info
    wallet = Account.from_key(PAYER_PRIVATE_KEY).address
    console.print(f"[green]✅ Wallet configured[/green]")
    console.print(f"   Address: {wallet}")
    console.print(f"   Signal URL: {X402_SIGNAL_URL}")
    console.print(f"   Model: {OPENROUTER_MODEL}")
    console.print(f"   Interval: {AGENT_INTERVAL}s")
    console.print()
    
    # Create agent
    agent = create_agent()
    console.print("[green]✅ LangChain agent created[/green]")
    console.print()
    
    # Run loop
    try:
        while True:
            run_agent_cycle(agent)
            console.print(f"\n[dim]Sleeping {AGENT_INTERVAL}s until next cycle...[/dim]\n")
            time.sleep(AGENT_INTERVAL)
    except KeyboardInterrupt:
        console.print("\n[yellow]Agent stopped by user[/yellow]")
    finally:
        # Final stats
        console.print(Panel.fit(
            f"[bold]Final Statistics[/bold]\n"
            f"Payments: {agent_state.payments_made}\n"
            f"Spent: ${agent_state.total_spent_usd:.2f} USDC\n"
            f"Decisions: {len(agent_state.decisions)}",
            border_style="cyan",
        ))


if __name__ == "__main__":
    main()
