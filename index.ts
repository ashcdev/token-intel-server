import { Hono } from "hono";
import { fetchIntel } from "./src/intel";
import { storeTokenIntel } from "./src/convex";

const app = new Hono();
const PORT = parseInt(process.env.PORT ?? "3847");

// ── CA extractor — handles any webhook shape ──────────────
// Tries common field names, then regex scans the whole body

const CA_FIELDS = [
  "ca", "contract_address", "contractAddress", "address",
  "token", "token_address", "tokenAddress", "mint", "mint_address",
];

const SOL_CA_REGEX = /[1-9A-HJ-NP-Za-km-z]{32,44}/g;

function extractCA(body: any): string | null {
  if (!body) return null;

  // Check known field names (flat + one level deep)
  for (const field of CA_FIELDS) {
    if (typeof body[field] === "string" && body[field].length >= 32) {
      return body[field];
    }
    // One level nested (e.g. body.data.ca, body.token.address)
    for (const key of Object.keys(body)) {
      if (body[key] && typeof body[key] === "object") {
        const nested = body[key];
        if (typeof nested[field] === "string" && nested[field].length >= 32) {
          return nested[field];
        }
      }
    }
  }

  // Last resort: regex scan stringified body
  const matches = JSON.stringify(body).match(SOL_CA_REGEX);
  if (matches) {
    // Filter out anything that looks like a wallet address we don't want
    // (prefer ones ending in 'pump' or exactly 44 chars)
    const pump = matches.find((m) => m.endsWith("pump"));
    if (pump) return pump;
    return matches[0];
  }

  return null;
}

// ── Routes ────────────────────────────────────────────────

app.get("/", (c) => c.json({ status: "ok", service: "token-intel-server" }));

app.get("/health", (c) => c.json({ ok: true, ts: Date.now() }));

// Main webhook endpoint — accepts any POST
app.post("/webhook", async (c) => {
  let body: any;
  try {
    body = await c.req.json();
  } catch {
    return c.json({ error: "Invalid JSON body" }, 400);
  }

  const ca = extractCA(body);
  if (!ca) {
    return c.json({ error: "Could not extract contract address from payload", body }, 422);
  }

  console.log(`[webhook] CA: ${ca}`);

  // Fire-and-forget — respond immediately, process in background
  processAndStore(ca).catch((e) =>
    console.error(`[error] ${ca}: ${e.message}`)
  );

  return c.json({ ok: true, ca, status: "processing" });
});

// Also expose a direct query endpoint for testing
app.get("/intel/:ca", async (c) => {
  const ca = c.req.param("ca");
  try {
    const intel = await fetchIntel(ca);
    return c.json(intel);
  } catch (e: any) {
    return c.json({ error: e.message }, 500);
  }
});

// ── Process + store ───────────────────────────────────────

async function processAndStore(ca: string): Promise<void> {
  const start = Date.now();
  console.log(`[intel] fetching ${ca}...`);

  const intel = await fetchIntel(ca);
  const elapsed = Date.now() - start;

  console.log(`[intel] done ${ca} — risk: ${intel.risk}/100 (${elapsed}ms)`);

  await storeTokenIntel(intel);
  console.log(`[convex] stored ${ca}`);
}

// ── Start ─────────────────────────────────────────────────

console.log(`🚀 Token Intel Server on port ${PORT}`);
export default {
  port: PORT,
  fetch: app.fetch,
};
