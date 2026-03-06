import {
  CronCapability,
  EVMClient,
  HTTPClient,
  Runner,
  bytesToHex,
  consensusIdenticalAggregation,
  consensusMedianAggregation,
  getNetwork,
  handler,
  hexToBase64,
  json,
  ok,
  type HTTPSendRequester,
  type Runtime,
} from "@chainlink/cre-sdk";
import { encodeAbiParameters, keccak256, parseAbiParameters, toBytes } from "viem";

export type Config = {
  schedule: string;
  assets?: Array<{
    symbol: string;
    priceApiUrl: string;
  }>;
  assetSymbol?: string;
  priceApiUrl?: string;
  enableTicks?: boolean;
  enableMetrics?: boolean;
  maxAssetsPerRun?: number;
  sentimentApiUrl: string;
  openrouterUrl: string;
  openrouterModel: string;
  evms: Array<{
    chainName: string;
    receiverAddress: string;
    gasLimit: string;
  }>;
};


type SignalDecision = {
  signal: "BUY" | "SELL" | "HOLD";
  confidence: number;
  reasoning: string;
};

type SupabaseSignal = {
  id: string;
  asset: string;
  signal: SignalDecision["signal"];
  confidence: number;
  price_at_signal: number | null;
  data_hash: string;
  created_at: string;
};

const SIGNAL_TO_CODE: Record<SignalDecision["signal"], number> = {
  HOLD: 0,
  BUY: 1,
  SELL: 2,
};

const HOLD_THRESHOLD_PCT = 0.25;

const httpClient = new HTTPClient();

const decodeJson = (response: { body: Uint8Array }) => {
  return json(response);
};

const getSecretValue = (runtime: Runtime<Config>, id: string): string => {
  const secret = runtime.getSecret({ id }).result();
  if (!secret?.value) {
    throw new Error(`Missing secret: ${id}`);
  }
  return secret.value;
};

const encodeJsonBody = (payload: unknown): string => {
  const bytes = toBytes(JSON.stringify(payload));
  return hexToBase64(bytesToHex(bytes));
};

const fetchPrice = (sendRequester: HTTPSendRequester, url: string): number => {
  const response = sendRequester.sendRequest({ url, method: "GET" }).result();
  if (!ok(response)) {
    throw new Error(`Price API failed: ${response.statusCode}`);
  }
  const data = decodeJson(response);
  const entry = data && typeof data === "object" ? Object.values(data)[0] : null;
  const price = (entry as { usd?: number } | null)?.usd;
  if (typeof price !== "number") {
    throw new Error("Price API response missing usd field");
  }
  return price;
};

const fetchSentiment = (sendRequester: HTTPSendRequester, url: string): number => {
  const response = sendRequester.sendRequest({ url, method: "GET" }).result();
  if (!ok(response)) {
    throw new Error(`Sentiment API failed: ${response.statusCode}`);
  }
  const data = decodeJson(response);
  const value = Number(data?.data?.[0]?.value);
  if (Number.isNaN(value)) {
    throw new Error("Sentiment API response missing data[0].value");
  }
  return value;
};

const fetchOpenRouterDecision = (
  sendRequester: HTTPSendRequester,
  url: string,
  model: string,
  apiKey: string,
  prompt: string,
  referer?: string,
  appName?: string,
): string => {
  const headers: Record<string, string> = {
    "Content-Type": "application/json",
    Authorization: `Bearer ${apiKey}`,
  };
  if (referer) {
    headers["HTTP-Referer"] = referer;
  }
  if (appName) {
    headers["X-Title"] = appName;
  }
  const response = sendRequester
    .sendRequest({
      url,
      method: "POST",
      headers,
      body: encodeJsonBody({
        model,
        messages: [{ role: "user", content: prompt }],
        temperature: 0,
        response_format: { type: "json_object" },
      }),
    })
    .result();

  if (!ok(response)) {
    throw new Error(`OpenRouter request failed: ${response.statusCode}`);
  }
  const data = decodeJson(response);
  const content = data?.choices?.[0]?.message?.content;
  if (!content) {
    throw new Error("OpenRouter response missing content");
  }
  return content;
};

const submitSupabase = (
  sendRequester: HTTPSendRequester,
  supabaseUrl: string,
  serviceKey: string,
  payload: Record<string, unknown>,
): string => {
  const response = sendRequester
    .sendRequest({
      url: `${supabaseUrl}/rest/v1/signals?on_conflict=data_hash`,
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        apikey: serviceKey,
        Authorization: `Bearer ${serviceKey}`,
        Prefer: "resolution=merge-duplicates,return=representation",
      },
      body: encodeJsonBody(payload),
    })
    .result();

  if (!ok(response)) {
    throw new Error(`Supabase insert failed: ${response.statusCode}`);
  }
  return "ok";
};

const fetchSupabaseLatestSignal = (
  sendRequester: HTTPSendRequester,
  supabaseUrl: string,
  serviceKey: string,
  asset: string,
): SupabaseSignal | null => {
  const response = sendRequester
    .sendRequest({
      url: `${supabaseUrl}/rest/v1/signals?asset=eq.${encodeURIComponent(
        asset,
      )}&order=created_at.desc&limit=1`,
      method: "GET",
      headers: {
        apikey: serviceKey,
        Authorization: `Bearer ${serviceKey}`,
      },
    })
    .result();

  if (!ok(response)) {
    throw new Error(`Supabase read failed: ${response.statusCode}`);
  }

  const data = decodeJson(response);
  if (!Array.isArray(data) || data.length === 0) {
    return null;
  }

  const row = data[0] as SupabaseSignal;
  return row;
};

const submitSupabaseMetric = (
  sendRequester: HTTPSendRequester,
  supabaseUrl: string,
  serviceKey: string,
  payload: Record<string, unknown>,
): string => {
  const response = sendRequester
    .sendRequest({
      url: `${supabaseUrl}/rest/v1/signal_metrics?on_conflict=signal_hash`,
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        apikey: serviceKey,
        Authorization: `Bearer ${serviceKey}`,
        Prefer: "resolution=merge-duplicates,return=representation",
      },
      body: encodeJsonBody(payload),
    })
    .result();

  if (!ok(response)) {
    throw new Error(`Supabase metric insert failed: ${response.statusCode}`);
  }
  return "ok";
};

const submitSupabaseTick = (
  sendRequester: HTTPSendRequester,
  supabaseUrl: string,
  serviceKey: string,
  payload: Record<string, unknown>,
): string => {
  const response = sendRequester
    .sendRequest({
      url: `${supabaseUrl}/rest/v1/price_ticks?on_conflict=data_hash`,
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        apikey: serviceKey,
        Authorization: `Bearer ${serviceKey}`,
        Prefer: "resolution=merge-duplicates,return=representation",
      },
      body: encodeJsonBody(payload),
    })
    .result();

  if (!ok(response)) {
    throw new Error(`Supabase tick insert failed: ${response.statusCode}`);
  }
  return "ok";
};

const parseDecision = (raw: string): SignalDecision => {
  const parsed = JSON.parse(raw);
  const signal = String(parsed.signal || "").toUpperCase() as SignalDecision["signal"];
  if (!(signal in SIGNAL_TO_CODE)) {
    throw new Error(`Invalid signal returned: ${parsed.signal}`);
  }
  const confidence = Math.max(0, Math.min(100, Number(parsed.confidence ?? 0)));
  const reasoning = typeof parsed.reasoning === "string" ? parsed.reasoning : "";
  return { signal, confidence, reasoning };
};

const buildPrompt = (asset: string, price: number, sentiment: number) => {
  return [
    `You are an on-chain trading signal agent for ${asset}.`,
    "Return JSON ONLY in this exact format:",
    '{"signal":"BUY|SELL|HOLD","confidence":0-100,"reasoning":"short"}',
    "Current data:",
    `- Price (USD): ${price}`,
    `- Sentiment score (0-100): ${sentiment}`,
    "Be conservative. If uncertain, choose HOLD.",
  ].join("\n");
};

export const onCronTrigger = (runtime: Runtime<Config>): string => {
  const config = runtime.config;
  const openrouterApiKey = getSecretValue(runtime, "OPENROUTER_API_KEY");
  const supabaseUrl = getSecretValue(runtime, "SUPABASE_URL");
  const supabaseServiceKey = getSecretValue(runtime, "SUPABASE_SERVICE_KEY");

  const assets =
    config.assets && config.assets.length
      ? config.assets
      : config.assetSymbol && config.priceApiUrl
        ? [{ symbol: config.assetSymbol, priceApiUrl: config.priceApiUrl }]
        : [];

  const shouldWriteTicks = config.enableTicks !== false;
  const shouldWriteMetrics = config.enableMetrics !== false;
  const maxAssets = Number.isFinite(config.maxAssetsPerRun)
    ? Math.max(1, Math.floor(Number(config.maxAssetsPerRun)))
    : null;
  let selectedAssets = maxAssets ? assets.slice(0, maxAssets) : assets;

  if (maxAssets === 1 && assets.length > 1) {
    const rotationIndex = Math.floor(Date.now() / 1000 / 30) % assets.length;
    selectedAssets = [assets[rotationIndex]];
  }

  if (!selectedAssets.length) {
    throw new Error("No assets configured for workflow");
  }

  const evmConfig = config.evms?.[0];
  if (!evmConfig) {
    throw new Error("Missing evms[0] in config");
  }

  const network = getNetwork({
    chainFamily: "evm",
    chainSelectorName: evmConfig.chainName,
    isTestnet: true,
  });
  if (!network) {
    throw new Error(`Network not found: ${evmConfig.chainName}`);
  }

  const evmClient = new EVMClient(network.chainSelector.selector);

  for (const asset of selectedAssets) {
    const assetSymbol = asset.symbol;
    const price = httpClient
      .sendRequest(runtime, fetchPrice, consensusMedianAggregation<number>())(asset.priceApiUrl)
      .result();

    const sentiment = httpClient
      .sendRequest(runtime, fetchSentiment, consensusMedianAggregation<number>())(config.sentimentApiUrl)
      .result();

    const tickTimestamp = Math.floor(Date.now() / 1000);

    if (shouldWriteTicks) {
      const tickHash = keccak256(
        toBytes(
          JSON.stringify({
            asset: assetSymbol,
            price,
            sentiment,
            timestamp: tickTimestamp,
          }),
        ),
      );

      httpClient
        .sendRequest(runtime, submitSupabaseTick, consensusIdenticalAggregation<string>())(
          supabaseUrl,
          supabaseServiceKey,
          {
            asset: assetSymbol,
            price,
            sentiment,
            data_hash: tickHash,
            created_at: new Date(tickTimestamp * 1000).toISOString(),
          },
        )
        .result();
    }

    if (shouldWriteMetrics) {
      const latestSignal = httpClient
        .sendRequest(runtime, fetchSupabaseLatestSignal, consensusIdenticalAggregation<SupabaseSignal | null>())(
          supabaseUrl,
          supabaseServiceKey,
          assetSymbol,
        )
        .result();

      if (latestSignal) {
        const previousPrice = Number(latestSignal.price_at_signal);
        const now = tickTimestamp;
        const createdAt = Date.parse(latestSignal.created_at);
        const horizonSeconds = Number.isFinite(createdAt)
          ? Math.max(0, Math.floor(now - createdAt / 1000))
          : null;

        if (Number.isFinite(previousPrice) && previousPrice > 0) {
          const returnPct = ((price - previousPrice) / previousPrice) * 100;
          const signal = latestSignal.signal;
          const correct =
            signal === "BUY"
              ? returnPct > 0
              : signal === "SELL"
                ? returnPct < 0
                : Math.abs(returnPct) <= HOLD_THRESHOLD_PCT;

          httpClient
            .sendRequest(runtime, submitSupabaseMetric, consensusIdenticalAggregation<string>())(
              supabaseUrl,
              supabaseServiceKey,
              {
                asset: latestSignal.asset,
                signal_id: latestSignal.id,
                signal_hash: latestSignal.data_hash,
                signal,
                confidence: latestSignal.confidence,
                previous_price: previousPrice,
                current_price: price,
                return_pct: returnPct,
                horizon_seconds: horizonSeconds,
                correct,
                created_at: new Date(now * 1000).toISOString(),
              },
            )
            .result();
        }
      }
    }

    const prompt = buildPrompt(assetSymbol, price, sentiment);
    const rawDecision = httpClient
      .sendRequest(runtime, fetchOpenRouterDecision, consensusIdenticalAggregation<string>())(
        config.openrouterUrl,
        config.openrouterModel,
        openrouterApiKey,
        prompt,
        undefined,
        undefined,
      )
      .result();

    const decision = parseDecision(rawDecision);
    const timestamp = Math.floor(Date.now() / 1000);

    const reportPayload = {
      asset: assetSymbol,
      price,
      sentiment,
      signal: decision.signal,
      confidence: decision.confidence,
      reasoning: decision.reasoning,
      timestamp,
    };

    const dataHash = keccak256(toBytes(JSON.stringify(reportPayload)));
    const encodedPayload = encodeAbiParameters(
      parseAbiParameters(
        "bytes32 dataHash, uint8 signal, uint8 confidence, uint256 timestamp, string asset, uint256 price, int256 sentiment"
      ),
      [
        dataHash,
        SIGNAL_TO_CODE[decision.signal],
        decision.confidence,
        BigInt(timestamp),
        assetSymbol,
        BigInt(Math.round(price * 100)),
        BigInt(Math.round(sentiment)),
      ],
    );

    const report = runtime
      .report({
        encodedPayload: hexToBase64(encodedPayload),
        encoderName: "evm",
        signingAlgo: "ecdsa",
        hashingAlgo: "keccak256",
      })
      .result();

    const writeResult = evmClient
      .writeReport(runtime, {
        receiver: evmConfig.receiverAddress,
        report,
        gasConfig: { gasLimit: evmConfig.gasLimit },
      })
      .result();

    const txHash = bytesToHex(writeResult.txHash || new Uint8Array(32));

    httpClient
      .sendRequest(runtime, submitSupabase, consensusIdenticalAggregation<string>())(
        supabaseUrl,
        supabaseServiceKey,
        {
          asset: assetSymbol,
          signal: decision.signal,
          confidence: decision.confidence,
          reasoning: decision.reasoning,
          price_at_signal: price,
          sentiment_score: sentiment,
          data_hash: dataHash,
          tx_hash: txHash,
          created_at: new Date(timestamp * 1000).toISOString(),
        },
      )
      .result();

    runtime.log(
      `Signal attested: ${assetSymbol} ${decision.signal} (${decision.confidence}%)`,
    );
    runtime.log(`Tx hash: ${txHash}`);
  }

  return `Signals attested: ${selectedAssets.map((asset) => asset.symbol).join(", ")}`;
};

export const initWorkflow = (config: Config) => {
  const cron = new CronCapability();

  return [
    handler(cron.trigger({ schedule: config.schedule }), onCronTrigger),
  ];
};

export async function main() {
  const runner = await Runner.newRunner<Config>();
  await runner.run(initWorkflow);
}
