import { describe, expect, it } from "vitest";

import { cancelEventSchema } from "@/lib/validation/cancellation";

describe("cancelEventSchema", () => {
  const schema = cancelEventSchema("Workshop Next.js");

  it("accepts matching title and reason", () => {
    expect(schema.safeParse({ reason: "Pembicara sakit", confirmTitle: " Workshop Next.js " }).success).toBe(true);
  });

  it("rejects mismatched title and short reason", () => {
    const result = schema.safeParse({ reason: "x", confirmTitle: "workshop next.js" });
    expect(Object.keys(result.error!.flatten().fieldErrors).sort()).toEqual(["confirmTitle", "reason"]);
  });
});
