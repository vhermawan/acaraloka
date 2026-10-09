import { describe, expect, it } from "vitest";

import {
  AUTH_RATE_LIMIT_ERROR,
  classifyResetError,
  classifySignInError,
  classifySignUpError,
  isValidEmail,
  normalizeEmail,
} from "@/lib/auth-errors";
import { describeAuthNotice, parseAuthNotice } from "@/lib/auth-notice";
import { checkEmailPath, continuePath, forgotPasswordPath, pathWithNext, registerPathFor } from "@/lib/roles";

describe("sign-in errors", () => {
  it("sends unverified accounts to the check-email page", () => {
    expect(classifySignInError({ status: 403, code: "EMAIL_NOT_VERIFIED" })).toEqual({ kind: "unverified" });
  });

  it("uses one message for wrong email and wrong password and hints at Google", () => {
    const failure = classifySignInError({ status: 401, code: "INVALID_EMAIL_OR_PASSWORD" });
    expect(failure).toMatchObject({ kind: "form" });
    expect("message" in failure && failure.message).toContain("Google");
  });

  it("explains a disabled account", () => {
    const failure = classifySignInError({ status: 403, code: "ACCOUNT_DISABLED" });
    expect(failure).toMatchObject({ kind: "form" });
    expect("message" in failure && failure.message).toContain("dinonaktifkan");
  });

  it("explains rate limits for every form", () => {
    for (const classify of [classifySignInError, classifySignUpError, classifyResetError]) {
      expect(classify({ status: 429 })).toEqual({ kind: "rate-limited", message: AUTH_RATE_LIMIT_ERROR });
    }
  });
});

describe("sign-up and reset errors", () => {
  it("maps password and terms problems to their fields", () => {
    expect(classifySignUpError({ code: "PASSWORD_TOO_SHORT" })).toMatchObject({ kind: "field", field: "password" });
    expect(classifySignUpError({ code: "TERMS_NOT_ACCEPTED" })).toMatchObject({ kind: "field", field: "terms" });
    expect(classifyResetError({ code: "INVALID_TOKEN" })).toMatchObject({ kind: "form" });
  });

  it("never reveals whether an email is registered", () => {
    expect(classifySignUpError({ status: 422, code: "USER_ALREADY_EXISTS" })).toMatchObject({ kind: "form" });
  });
});

describe("email input", () => {
  it("normalizes and validates", () => {
    expect(normalizeEmail("  Budi@Contoh.TEST ")).toBe("budi@contoh.test");
    expect(isValidEmail("budi@contoh.test")).toBe(true);
    expect(isValidEmail("budi@contoh")).toBe(false);
    expect(isValidEmail("budi contoh@x.test")).toBe(false);
  });
});

describe("auth notices and paths", () => {
  it("only accepts known notice codes", () => {
    expect(parseAuthNotice("role-organizer", "reset")).toBe("reset");
    expect(parseAuthNotice("<script>")).toBeNull();
    expect(describeAuthNotice("reset").tone).toBe("success");
    expect(describeAuthNotice("account_not_linked").tone).toBe("error");
  });

  it("builds role aware links", () => {
    expect(registerPathFor("PARTICIPANT")).toBe("/register");
    expect(registerPathFor("ORGANIZER")).toBe("/organizer/register");
    expect(pathWithNext("/register", "PARTICIPANT", "/me/tickets")).toBe("/register");
    expect(pathWithNext("/register", "PARTICIPANT", "/e/abc")).toBe("/register?next=%2Fe%2Fabc");
    expect(forgotPasswordPath("ORGANIZER")).toBe("/forgot-password?intent=organizer");
    expect(continuePath("ORGANIZER", "/organizer")).toBe("/auth/continue?intent=organizer&next=%2Forganizer");
    expect(checkEmailPath("PARTICIPANT", "/me/tickets", "a@b.test")).toBe("/check-email?email=a%40b.test&intent=participant");
  });
});
