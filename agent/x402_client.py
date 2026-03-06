"""
x402 Payment Client for Python
Handles automatic payment for x402-protected resources using PayAI facilitator
"""

import json
import httpx
import time
import secrets
from typing import Optional
from eth_account import Account
from dataclasses import dataclass


@dataclass
class PaymentRequirements:
    """Parsed x402 payment requirements from 402 response"""
    scheme: str
    network: str
    max_amount: str
    resource: str
    pay_to: str
    asset: str
    extra: dict


@dataclass
class X402Response:
    """Response from x402 request"""
    status: int
    data: Optional[dict]
    payment_settled: bool
    payment_tx: Optional[str]
    error: Optional[str]


def parse_payment_required(header_value: str) -> Optional[PaymentRequirements]:
    """Parse the payment-required header (supports both JSON and base64-encoded JSON for v2)"""
    try:
        # Try direct JSON first (v1)
        try:
            data = json.loads(header_value)
        except json.JSONDecodeError:
            # Try base64 decode (v2)
            import base64
            decoded = base64.b64decode(header_value).decode('utf-8')
            data = json.loads(decoded)
        
        if not data.get("accepts"):
            return None
        accept = data["accepts"][0]
        
        # Support both v1 (maxAmountRequired) and v2 (amount)
        max_amount = accept.get("maxAmountRequired") or accept.get("amount") or "0"
        
        return PaymentRequirements(
            scheme=accept.get("scheme", "exact"),
            network=accept.get("network", ""),
            max_amount=max_amount,
            resource=accept.get("resource", ""),
            pay_to=accept.get("payTo", ""),
            asset=accept.get("asset", ""),
            extra=accept.get("extra", {}),
        )
    except Exception:
        return None


def create_eip3009_authorization(
    private_key: str,
    pay_to: str,
    amount: str,
    chain_id: int,
    token_address: str,
) -> dict:
    """
    Create EIP-3009 transferWithAuthorization signature for PayAI facilitator
    Uses the exact format expected by x402 protocol
    """
    account = Account.from_key(private_key)
    
    valid_after = 0
    valid_before = int(time.time()) + 3600  # 1 hour validity
    nonce = "0x" + secrets.token_hex(32)
    
    # Convert amount to int for signing
    amount_int = int(amount)
    
    # EIP-712 typed data for transferWithAuthorization
    # Domain must match USDC contract expectations
    domain_data = {
        "name": "USD Coin",
        "version": "2",
        "chainId": chain_id,
        "verifyingContract": token_address,
    }
    
    types = {
        "TransferWithAuthorization": [
            {"name": "from", "type": "address"},
            {"name": "to", "type": "address"},
            {"name": "value", "type": "uint256"},
            {"name": "validAfter", "type": "uint256"},
            {"name": "validBefore", "type": "uint256"},
            {"name": "nonce", "type": "bytes32"},
        ],
    }
    
    message = {
        "from": account.address,
        "to": pay_to,
        "value": amount_int,
        "validAfter": valid_after,
        "validBefore": valid_before,
        "nonce": nonce,
    }
    
    # Sign using eth_account's sign_typed_data
    signed = account.sign_typed_data(domain_data, types, message)
    
    # Format signature as 0x-prefixed hex
    signature_hex = "0x" + signed.signature.hex() if not signed.signature.hex().startswith("0x") else signed.signature.hex()
    
    return {
        "signature": signature_hex,
        "authorization": {
            "from": account.address,
            "to": pay_to,
            "value": str(amount_int),
            "validAfter": str(valid_after),
            "validBefore": str(valid_before),
            "nonce": nonce,
        },
    }


class X402Client:
    """
    Autonomous x402 payment client
    Automatically detects 402 responses and pays for access
    """
    
    # Base Sepolia USDC address
    USDC_BASE_SEPOLIA = "0x036CbD53842c5426634e7929541eC2318f3dCF7e"
    CHAIN_ID_BASE_SEPOLIA = 84532
    
    def __init__(self, private_key: str):
        self.private_key = private_key
        self.account = Account.from_key(private_key)
        self.http = httpx.Client(timeout=30.0)
    
    @property
    def address(self) -> str:
        return self.account.address
    
    def fetch_with_payment(self, url: str, method: str = "GET", debug: bool = False) -> X402Response:
        """
        Fetch a resource, automatically paying if 402 is returned
        
        1. Make initial request
        2. If 402, parse payment requirements
        3. Sign EIP-3009 authorization
        4. Retry with payment header
        5. Return response
        """
        # Initial request
        try:
            response = self.http.request(method, url)
        except Exception as e:
            return X402Response(
                status=0,
                data=None,
                payment_settled=False,
                payment_tx=None,
                error=f"Connection error: {str(e)}",
            )
        
        # Not payment required - return as is
        if response.status_code != 402:
            try:
                data = response.json()
            except:
                data = None
            return X402Response(
                status=response.status_code,
                data=data,
                payment_settled=False,
                payment_tx=None,
                error=None if response.status_code < 400 else f"HTTP {response.status_code}",
            )
        
        # Parse payment requirements
        payment_header = response.headers.get("payment-required")
        if not payment_header:
            return X402Response(
                status=402,
                data=None,
                payment_settled=False,
                payment_tx=None,
                error="402 without payment-required header",
            )
        
        if debug:
            print(f"[x402] Payment header: {payment_header[:200]}...")
        
        requirements = parse_payment_required(payment_header)
        if not requirements:
            return X402Response(
                status=402,
                data=None,
                payment_settled=False,
                payment_tx=None,
                error="Failed to parse payment requirements",
            )
        
        if debug:
            print(f"[x402] Pay to: {requirements.pay_to}, Amount: {requirements.max_amount}, Network: {requirements.network}")
        
        # Create payment authorization
        try:
            chain_id = int(requirements.network.split(":")[-1])
        except:
            chain_id = self.CHAIN_ID_BASE_SEPOLIA
        
        token_address = requirements.asset or self.USDC_BASE_SEPOLIA
        
        try:
            eip3009_payload = create_eip3009_authorization(
                private_key=self.private_key,
                pay_to=requirements.pay_to,
                amount=requirements.max_amount,
                chain_id=chain_id,
                token_address=token_address,
            )
        except Exception as e:
            return X402Response(
                status=402,
                data=None,
                payment_settled=False,
                payment_tx=None,
                error=f"Failed to create payment signature: {str(e)}",
            )
        
        # Build payment payload
        payment_payload = {
            "x402Version": 1,
            "scheme": "exact",
            "network": requirements.network,
            "payload": eip3009_payload,
        }
        
        if debug:
            print(f"[x402] Sending payment from {self.address}")
        
        # Retry with payment
        try:
            payment_response = self.http.request(
                method,
                url,
                headers={
                    "X-PAYMENT": json.dumps(payment_payload),
                },
            )
        except Exception as e:
            return X402Response(
                status=0,
                data=None,
                payment_settled=False,
                payment_tx=None,
                error=f"Payment request failed: {str(e)}",
            )
        
        # Parse response
        payment_resp_header = payment_response.headers.get("payment-response")
        payment_tx = None
        if payment_resp_header:
            try:
                pr = json.loads(payment_resp_header)
                payment_tx = pr.get("transaction") or pr.get("txHash")
                if debug:
                    print(f"[x402] Payment response: {pr}")
            except:
                pass
        
        try:
            data = payment_response.json()
        except:
            data = None
        
        # Check for error in response body
        error_msg = None
        if payment_response.status_code >= 400:
            if data and isinstance(data, dict):
                error_msg = data.get("error") or data.get("message") or f"HTTP {payment_response.status_code}"
            else:
                error_msg = f"HTTP {payment_response.status_code}"
            if debug:
                print(f"[x402] Payment failed: {error_msg}")
        
        return X402Response(
            status=payment_response.status_code,
            data=data,
            payment_settled=payment_response.status_code == 200,
            payment_tx=payment_tx,
            error=error_msg,
        )
    
    def close(self):
        self.http.close()
