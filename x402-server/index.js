import "dotenv/config"
import express from "express"
import cors from "cors"
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
    exposedHeaders: ["payment-required", "payment-response", "payment-signature"],
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
