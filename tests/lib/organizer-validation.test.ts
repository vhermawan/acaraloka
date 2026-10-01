import { describe, expect, it } from "vitest";
import { organizerProfileSchema } from "@/lib/validation/organizer";

const valid = { orgName: "HIMA Informatika", contactPhone: "0812-3456-7890", contactEmail: "" };

describe("organizerProfileSchema", () => {
  it("normalizes phone and drops empty email", () => {
    expect(organizerProfileSchema.parse(valid)).toEqual({
      orgName: "HIMA Informatika",
      contactPhone: "081234567890",
      contactEmail: undefined,
    });
  });

  it.each(["+6281234567890", "6281234567890", "081234567"])("accepts phone %s", (contactPhone) => {
    expect(organizerProfileSchema.safeParse({ ...valid, contactPhone }).success).toBe(true);
  });

  it.each(["12345", "021123456", "08abc"])("rejects phone %s", (contactPhone) => {
    expect(organizerProfileSchema.safeParse({ ...valid, contactPhone }).success).toBe(false);
  });

  it("rejects short org name and bad email", () => {
    const result = organizerProfileSchema.safeParse({ orgName: "A", contactPhone: "081234567890", contactEmail: "x" });
    expect(result.success).toBe(false);
    expect(Object.keys(result.error!.flatten().fieldErrors).sort()).toEqual(["contactEmail", "orgName"]);
  });
});
