import { ConvexHttpClient } from "convex/browser";
import type { TokenIntelResult } from "./intel";

const CONVEX_URL = process.env.CONVEX_URL;
if (!CONVEX_URL) throw new Error("CONVEX_URL env var required");

const client = new ConvexHttpClient(CONVEX_URL);

export async function storeTokenIntel(intel: TokenIntelResult): Promise<void> {
  await client.mutation("tokenIntel:store", intel as any);
}

export async function getTokenIntel(ca: string): Promise<any> {
  return client.query("tokenIntel:get", { ca });
}
