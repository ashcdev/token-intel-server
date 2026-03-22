/**
 * GMGN Token Intel — importable module
 * Fetches token_stat, wallet_tags_stat, top_buyers, holder_stat, community
 */

import crypto from "crypto";

// ── Fingerprint params ────────────────────────────────────

function buildParams(): string {
  const deviceId = crypto.randomUUID();
  const fpDid = crypto.randomBytes(16).toString("hex");
  const date = new Date().toISOString().slice(0, 10).replace(/-/g, "");
  const rand = Math.floor(Math.random() * 99999);
  const hex = crypto.randomBytes(4).toString("hex");
  const clientId = `gmgn_web_${date}-${rand}-${hex}`;
  return [
    `device_id=${deviceId}`,
    `fp_did=${fpDid}`,
    `client_id=${clientId}`,
    `from_app=gmgn`,
    `app_ver=${clientId.replace("gmgn_web_", "")}`,
    `tz_name=America/Los_Angeles`,
    `tz_offset=-25200`,
    `app_lang=en-US`,
    `os=web`,
    `worker=0`,
  ].join("&");
}

const BASE = "https://gmgn.ai";

const HEADERS = {
  accept: "application/json, text/plain, */*",
  "user-agent":
    "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/146.0.0.0 Safari/537.36",
  referer: "https://gmgn.ai/",
  "accept-language": "en-US,en;q=0.9",
};

// ── Fetch helpers ─────────────────────────────────────────

async function gmgnFetch(url: string): Promise<any> {
  const res = await fetch(url, { headers: HEADERS });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  return res.json();
}

async function gmgnFetchSafe(url: string): Promise<any> {
  try {
    return await gmgnFetch(url);
  } catch (e) {
    return { error: (e as Error).message };
  }
}

// ── Community lookup ──────────────────────────────────────

async function fetchCommunity(tokenLinkData: any, params: string): Promise<any> {
  const twitterUsername = tokenLinkData?.data?.link?.twitter_username;
  if (!twitterUsername) return null;

  const m = twitterUsername.match(/i\/communities\/(\d+)/);
  if (!m) return null;

  const communityId = m[1];
  const url = `${BASE}/api/v1/twitter/community?id=${communityId}&${params}`;
  try {
    const data = await gmgnFetch(url);
    return data?.data ?? null;
  } catch {
    return null;
  }
}

// ── Main export ───────────────────────────────────────────

export interface TokenIntelResult {
  ca: string;
  fetchedAt: string;
  risk: number;
  tokenStat: any;
  walletTagsStat: any;
  topBuyers: any;
  holderStat: any;
  tokenLink: any;
  community: any | null;
}

export async function fetchIntel(ca: string): Promise<TokenIntelResult> {
  const params = buildParams();

  const endpoints = {
    tokenStat:      `${BASE}/api/v1/token_stat/sol/${ca}?${params}`,
    walletTagsStat: `${BASE}/api/v1/token_wallet_tags_stat/sol/${ca}?${params}`,
    topBuyers:      `${BASE}/defi/quotation/v1/tokens/top_buyers/sol/${ca}?${params}`,
    holderStat:     `${BASE}/vas/api/v1/token_holder_stat/sol/${ca}?${params}`,
    tokenLink:      `${BASE}/api/v1/mutil_window_token_link_rug_vote/sol/${ca}?${params}`,
  };

  // Fetch all in parallel
  const [tokenStat, walletTagsStat, topBuyers, holderStat, tokenLink] =
    await Promise.all(Object.values(endpoints).map(gmgnFetchSafe));

  // Community requires tokenLink result
  const community = await fetchCommunity(tokenLink, params);

  const risk = calcRisk({ tokenStat, holderStat, topBuyers });

  return {
    ca,
    fetchedAt: new Date().toISOString(),
    risk,
    tokenStat,
    walletTagsStat,
    topBuyers,
    holderStat,
    tokenLink,
    community,
  };
}

// ── Risk score (0–100) ────────────────────────────────────

function calcRisk({ tokenStat, holderStat, topBuyers }: any): number {
  const stat = tokenStat?.data;
  if (!stat) return 0;

  let score = 0;

  const bundler = parseFloat(stat.top_bundler_trader_percentage ?? 0);
  const bot     = parseFloat(stat.bot_degen_rate ?? 0);
  const fresh   = parseFloat(stat.fresh_wallet_rate ?? 0);
  const top10   = parseFloat(stat.top_10_holder_rate ?? 0);
  const creator = parseInt(stat.creator_created_count ?? 0);
  const entrap  = parseFloat(stat.top_entrapment_trader_percentage ?? 0);

  if (bundler > 0.50) score += 35;
  else if (bundler > 0.30) score += 20;
  else if (bundler > 0.15) score += 10;

  if (bot > 0.60) score += 25;
  else if (bot > 0.40) score += 15;
  else if (bot > 0.20) score += 8;

  if (fresh > 0.30) score += 15;
  else if (fresh > 0.15) score += 8;

  if (top10 > 0.60) score += 15;
  else if (top10 > 0.40) score += 8;

  if (creator > 50000) score += 15;
  else if (creator > 50) score += 10;
  else if (creator > 10) score += 5;

  if (entrap > 0.60) score += 15;
  else if (entrap > 0.40) score += 8;

  // Holding rate penalty
  const holdingRate = parseFloat(
    topBuyers?.data?.holders?.statusNow?.holding_rate ?? 1
  );
  if (holdingRate < 0.01) score += 15;
  else if (holdingRate < 0.05) score += 8;

  return Math.min(score, 100);
}
