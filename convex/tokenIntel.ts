import { mutation, query } from "./_generated/server";
import { v } from "convex/values";

// Store or update intel for a CA (upsert by CA)
export const store = mutation({
  args: {
    ca:             v.string(),
    fetchedAt:      v.string(),
    risk:           v.number(),
    tokenStat:      v.any(),
    walletTagsStat: v.any(),
    topBuyers:      v.any(),
    holderStat:     v.any(),
    tokenLink:      v.any(),
    community:      v.optional(v.any()),
  },
  handler: async (ctx, args) => {
    const existing = await ctx.db
      .query("tokenIntel")
      .withIndex("by_ca", (q) => q.eq("ca", args.ca))
      .first();

    if (existing) {
      await ctx.db.patch(existing._id, args);
      return existing._id;
    } else {
      return ctx.db.insert("tokenIntel", args);
    }
  },
});

// Get latest intel for a CA
export const get = query({
  args: { ca: v.string() },
  handler: async (ctx, { ca }) => {
    return ctx.db
      .query("tokenIntel")
      .withIndex("by_ca", (q) => q.eq("ca", ca))
      .first();
  },
});

// Get all high-risk tokens (risk >= threshold)
export const getHighRisk = query({
  args: { threshold: v.optional(v.number()) },
  handler: async (ctx, { threshold = 60 }) => {
    return ctx.db
      .query("tokenIntel")
      .withIndex("by_risk", (q) => q.gte("risk", threshold))
      .order("desc")
      .take(50);
  },
});

// Get recently fetched tokens
export const getRecent = query({
  args: { limit: v.optional(v.number()) },
  handler: async (ctx, { limit = 20 }) => {
    return ctx.db
      .query("tokenIntel")
      .order("desc")
      .take(limit);
  },
});
