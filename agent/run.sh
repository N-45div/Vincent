#!/bin/bash
# Vincent Signal Consumer Agent
# Autonomous AI agent that consumes CRE workflow signals via x402 payments

set -e

cd "$(dirname "$0")"

# Check if venv exists
if [ ! -d ".venv" ]; then
    echo "Creating virtual environment..."
    python3 -m venv .venv
fi

# Activate venv
source .venv/bin/activate

# Install dependencies
echo "Installing dependencies..."
pip install -q -r requirements.txt

# Check for .env
if [ ! -f ".env" ]; then
    echo "⚠️  No .env file found. Copy .env.example and configure:"
    echo "   cp .env.example .env"
    echo "   # Edit .env with your keys"
    exit 1
fi

# Run agent
echo ""
echo "🚀 Starting Vincent Signal Consumer Agent..."
echo ""
python agent.py
