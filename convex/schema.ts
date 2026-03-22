import { defineSchema, defineTable } from "convex/server";
import { v } from "convex/values";

export default defineSchema({
  tokenIntel: defineTable({
    ca:           v.string(),
    fetchedAt:    v.string(),
    risk:         v.number(),
    tokenStat:    v.any(),
    walletTagsStat: v.any(),
    topBuyers:    v.any(),
    holderStat:   v.any(),
    tokenLink:    v.any(),
    community:    v.optional(v.any()),
  })
    .index("by_ca", ["ca"])
    .index("by_risk", ["risk"]),
});
