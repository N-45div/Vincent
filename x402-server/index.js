import "dotenv/config"
import express from "express"
import cors from "cors"
import crypto from "crypto"
import * as ed25519 from "@noble/ed25519"
import { createClient } from "@supabase/supabase-js"
import { paymentMiddleware, x402ResourceServer } from "@x402/express"
import { HTTPFacilitatorClient } from "@x402/core/server"
import { ExactEvmScheme } from "@x402/evm/exact/server"
import { x402Client, wrapFetchWithPayment, x402HTTPClient } from "@x402/fetch"
import { registerExactEvmScheme } from "@x402/evm/exact/client"
import { privateKeyToAccount } from "viem/accounts"
import { facilitator, createFacilitatorConfig } from "@payai/facilitator"

const app = express()
app.use(express.json())
app.use(
  cors({
    origin: true,
    allowedHeaders: ["Content-Type", "X-PAYMENT", "x-world-id-token"],
    exposedHeaders: ["payment-required", "payment-response", "payment-signature", "x-world-id-token"],
  })
)

const supabaseUrl = process.env.SUPABASE_URL
const supabaseServiceKey = process.env.SUPABASE_SERVICE_KEY
const payTo = process.env.X402_RECEIVER_ADDRESS
const port = Number(process.env.PORT || 4021)

if (!supabaseUrl || !supabaseServiceKey) {
  throw new Error("Missing SUPABASE_URL or SUPABASE_SERVICE_KEY")
}
if (!payTo) {
  throw new Error("Missing X402_RECEIVER_ADDRESS")
}

const supabase = createClient(supabaseUrl, supabaseServiceKey)

const facilitatorUrl = process.env.X402_FACILITATOR_URL || "https://x402.org/facilitator"
const facilitatorApiKey = process.env.X402_FACILITATOR_API_KEY
const facilitatorAuthHeader = process.env.X402_FACILITATOR_AUTH_HEADER || "Authorization"
const facilitatorAuthValue =
  process.env.X402_FACILITATOR_AUTH_VALUE ||
  (facilitatorApiKey ? `Bearer ${facilitatorApiKey}` : null)
const payaiEnabled = process.env.X402_USE_PAYAI === "true"
const payaiKeyId = process.env.PAYAI_API_KEY_ID
const payaiKeySecret = process.env.PAYAI_API_KEY_SECRET
const price = process.env.X402_PRICE || "$0.01"
const payerPrivateKey = process.env.X402_PAYER_PRIVATE_KEY
const paywallUrl = process.env.X402_PAYWALL_URL || `http://localhost:${port}/api/signals`
const worldIdAppId = process.env.WORLD_ID_APP_ID
const worldIdRpId = process.env.WORLD_ID_RP_ID
const worldIdSigningKey = process.env.WORLD_ID_SIGNING_KEY
const worldIdAction = process.env.WORLD_ID_ACTION || "vincent-signal-access"
const worldIdStaging = process.env.WORLD_ID_STAGING === "true"
const worldIdVerifyBaseUrl = worldIdStaging 
  ? "https://staging-developer.worldcoin.org" 
  : "https://developer.worldcoin.org"
const worldIdTokenTtlSeconds = Number(process.env.WORLD_ID_TOKEN_TTL_SECONDS || 3600)
const worldIdAdminSecret = process.env.WORLD_ID_ADMIN_SECRET
const worldIdDevBypass = process.env.WORLD_ID_DEV_BYPASS === "true"

const worldIdTokens = new Map()
let latestWorldIdToken = null

let fetchWithPayment = null
let paymentHttpClient = null

if (payerPrivateKey) {
  const signer = privateKeyToAccount(payerPrivateKey)
  const buyerClient = new x402Client()
  registerExactEvmScheme(buyerClient, { signer })
  fetchWithPayment = wrapFetchWithPayment(fetch, buyerClient)
  paymentHttpClient = new x402HTTPClient(buyerClient)
}

const facilitatorClient = payaiEnabled
  ? new HTTPFacilitatorClient(
      payaiKeyId && payaiKeySecret
        ? createFacilitatorConfig(payaiKeyId, payaiKeySecret)
        : facilitator,
    )
  : new HTTPFacilitatorClient({
      url: facilitatorUrl,
      createAuthHeaders: facilitatorAuthValue
        ? async () => ({
            verify: { [facilitatorAuthHeader]: facilitatorAuthValue },
            settle: { [facilitatorAuthHeader]: facilitatorAuthValue },
            supported: { [facilitatorAuthHeader]: facilitatorAuthValue },
          })
        : undefined,
    })

const server = new x402ResourceServer(facilitatorClient)
  .register("eip155:84532", new ExactEvmScheme())

// Generate RP signature for World ID v4
app.post("/api/world-id/rp-signature", async (req, res) => {
  if (!worldIdSigningKey) {
    res.status(500).json({ error: "WORLD_ID_SIGNING_KEY not configured" })
    return
  }
  if (!worldIdRpId) {
    res.status(500).json({ error: "WORLD_ID_RP_ID not configured" })
    return
  }

  const { action } = req.body || {}
  const actionName = action || worldIdAction

  try {
    const nonce = crypto.randomUUID()
    const createdAt = Math.floor(Date.now() / 1000)
    const expiresAt = createdAt + 300 // 5 minutes

    // Create the message to sign: action + nonce + created_at + expires_at
    const message = `${actionName}${nonce}${createdAt}${expiresAt}`
    
    // Import the signing key (hex encoded ed25519 seed - 32 bytes)
    const privateKey = Buffer.from(worldIdSigningKey.replace(/^0x/, ''), 'hex')
    
    // Sign the message using @noble/ed25519
    const messageBytes = new TextEncoder().encode(message)
    const signature = await ed25519.signAsync(messageBytes, privateKey)
    const sig = Buffer.from(signature).toString('base64')

    res.json({
      sig,
      nonce,
      created_at: createdAt,
      expires_at: expiresAt,
      rp_id: worldIdRpId,
      app_id: worldIdAppId,
    })
  } catch (error) {
    console.error("[World ID] RP signature error:", error)
    res.status(500).json({ error: "Failed to generate RP signature" })
  }
})

app.post("/api/world-id/verify", async (req, res) => {
  const payload = req.body || {}
  
  // Support both v4 (full payload) and v2 (individual fields) formats
  const isV4Payload = payload.protocol_version || payload.responses
  
  try {
    let verifyUrl, verifyBody
    
    if (isV4Payload && worldIdRpId) {
      // v4 API - forward payload directly
      verifyUrl = `${worldIdVerifyBaseUrl}/api/v4/verify/${worldIdRpId}`
      verifyBody = payload
      console.log(`[World ID] Verifying with v4 API: ${verifyUrl}`)
    } else {
      // v2 API fallback
      if (!worldIdAppId) {
        res.status(500).json({ error: "WORLD_ID_APP_ID not configured" })
        return
      }
      const { nullifier_hash, merkle_root, proof, verification_level, action, signal } = payload
      if (!nullifier_hash || !merkle_root || !proof) {
        res.status(400).json({ error: "Missing World ID proof fields" })
        return
      }
      verifyUrl = `${worldIdVerifyBaseUrl}/api/v2/verify/${worldIdAppId}`
      verifyBody = {
        nullifier_hash,
        merkle_root,
        proof,
        verification_level: verification_level || "device",
        action: action || worldIdAction,
        signal: signal || "",
      }
      console.log(`[World ID] Verifying with v2 API: ${verifyUrl}`)
    }

    const verifyResponse = await fetch(verifyUrl, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(verifyBody),
    })

    const data = await verifyResponse.json().catch(() => null)
    if (!verifyResponse.ok) {
      console.error("[World ID] Verification failed:", data)
      res.status(400).json({ error: data?.detail || data?.error || "World ID verification failed" })
      return
    }

    const token = crypto.randomUUID()
    const expiresAt = Date.now() + worldIdTokenTtlSeconds * 1000
    const nullifier = isV4Payload ? data?.nullifier_hash : payload.nullifier_hash
    worldIdTokens.set(token, { nullifier_hash: nullifier, expiresAt })
    latestWorldIdToken = token

    res.json({ verified: true, token, expiresAt })
  } catch (error) {
    console.error("[World ID] Verification error:", error)
    res.status(500).json({ error: error?.message || "World ID verification error" })
  }
})

app.get("/api/world-id/token", (req, res) => {
  if (!isAdminAuthorized(req)) {
    res.status(403).json({ error: "Unauthorized" })
    return
  }
  if (!latestWorldIdToken) {
    res.status(404).json({ error: "No World ID token available" })
    return
  }
  const record = worldIdTokens.get(latestWorldIdToken)
  if (!record) {
    res.status(404).json({ error: "Token expired" })
    return
  }
  if (record.expiresAt < Date.now()) {
    worldIdTokens.delete(latestWorldIdToken)
    latestWorldIdToken = null
    res.status(404).json({ error: "Token expired" })
    return
  }
  res.json({ token: latestWorldIdToken, expiresAt: record.expiresAt })
})

app.use(
  paymentMiddleware(
    {
      "GET /api/signals": {
        accepts: [
          {
            scheme: "exact",
            price,
            network: "eip155:84532",
            payTo,
          },
        ],
        description: "Latest AI trading signals",
        mimeType: "application/json",
      },
    },
    server,
  ),
)

app.get("/", (req, res) => {
  res.json({ status: "ok", service: "signal-attestor-x402" })
})

app.get("/api/signals", async (req, res) => {
  if (!isWorldIdAllowed(req)) {
    res.status(401).json({ error: "World ID verification required" })
    return
  }
  const limitRaw = Number(req.query?.limit || 25)
  const limit = Number.isFinite(limitRaw) ? Math.min(Math.max(limitRaw, 1), 100) : 25

  const { data, error } = await supabase
    .from("signals")
    .select("*")
    .order("created_at", { ascending: false })
    .limit(limit)

  if (error) {
    res.status(500).json({ error: error.message })
    return
  }

  res.json({ signals: data })
})

app.get("/api/paid-demo", async (req, res) => {
  if (!isWorldIdAllowed(req)) {
    res.status(401).json({ error: "World ID verification required" })
    return
  }
  if (!fetchWithPayment || !paymentHttpClient) {
    res.status(500).json({ error: "Missing X402_PAYER_PRIVATE_KEY" })
    return
  }

  try {
    const url = new URL(paywallUrl)
    if (!url.searchParams.has("limit")) {
      url.searchParams.set("limit", "5")
    }

    const response = await fetchWithPayment(url.toString(), { method: "GET" })
    const body = await response.json().catch(() => null)
    let payment = null
    let paymentError = null

    try {
      payment = paymentHttpClient.getPaymentSettleResponse((name) => response.headers.get(name))
    } catch (error) {
      paymentError = error?.message || "Payment settlement headers missing"
    }

    res.status(response.status).json({
      status: response.status,
      payment,
      paymentError,
      body,
    })
  } catch (error) {
    res.status(500).json({ error: error?.message || "Payment failed" })
  }
})

app.listen(port, () => {
  console.log(`x402 signal api listening on http://localhost:${port}`)
})

function isWorldIdAllowed(req) {
  if (!worldIdAppId || worldIdDevBypass) {
    return true
  }
  const token = req.headers["x-world-id-token"]
  if (!token || typeof token !== "string") {
    return false
  }
  const record = worldIdTokens.get(token)
  if (!record) {
    return false
  }
  if (record.expiresAt < Date.now()) {
    worldIdTokens.delete(token)
    return false
  }
  return true
}

function isAdminAuthorized(req) {
  if (!worldIdAdminSecret) {
    return true
  }
  const headerSecret = req.headers["x-world-id-admin"]
  const querySecret = req.query?.secret
  if (headerSecret && headerSecret === worldIdAdminSecret) {
    return true
  }
  if (querySecret && querySecret === worldIdAdminSecret) {
    return true
  }
  return false
}

