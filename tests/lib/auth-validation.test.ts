import { describe, expect, it } from "vitest";

import { forgotPasswordSchema, resetPasswordSchema, signInSchema, signUpSchema } from "@/lib/validation/auth";

describe("auth form schemas", () => {
  it("normalizes email on sign-in", () => {
    const parsed = signInSchema.parse({ email: "  Budi@Example.COM ", password: "x" });
    expect(parsed.email).toBe("budi@example.com");
  });

  it("rejects an empty password on sign-in", () => {
    const result = signInSchema.safeParse({ email: "budi@example.com", password: "" });
    expect(result.success).toBe(false);
  });

  it("requires terms, name, and a long enough password on sign-up", () => {
    const result = signUpSchema.safeParse({ name: " ", email: "budi", password: "short", terms: false });
    expect(result.success).toBe(false);
    const fields = result.error?.flatten().fieldErrors ?? {};
    expect(Object.keys(fields).sort()).toEqual(["email", "name", "password", "terms"]);
  });

  it("accepts a valid sign-up", () => {
    const result = signUpSchema.safeParse({ name: "Budi", email: "budi@example.com", password: "rahasia123", terms: true });
    expect(result.success).toBe(true);
  });

  it("validates forgot and reset password input", () => {
    expect(forgotPasswordSchema.safeParse({ email: "bukan-email" }).success).toBe(false);
    expect(resetPasswordSchema.safeParse({ password: "1234567" }).success).toBe(false);
    expect(resetPasswordSchema.safeParse({ password: "12345678" }).success).toBe(true);
  });
});
