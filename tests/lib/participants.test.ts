import { describe, expect, it } from "vitest";

import { answerValue, parsePage, parseQuery, participantStatus } from "@/lib/participants";

describe("participantStatus", () => {
  it("maps registration state", () => {
    expect(participantStatus({ status: "CONFIRMED", checkedInAt: null })).toBe("REGISTERED");
    expect(participantStatus({ status: "CONFIRMED", checkedInAt: new Date() })).toBe("ATTENDED");
    expect(participantStatus({ status: "CANCELLED", checkedInAt: null })).toBe("CANCELLED");
  });
});

describe("search params", () => {
  it.each([
    [undefined, 1],
    ["3", 3],
    ["0", 1],
    ["-2", 1],
    ["abc", 1],
    [["2", "5"], 2],
    ["1e20", 1],
    ["99999999999999999999", 1],
    ["10001", 10_000],
    ["2.5", 1],
  ])("parsePage(%j) = %d", (input, expected) => {
    expect(parsePage(input)).toBe(expected);
  });

  it("trims and bounds the query", () => {
    expect(parseQuery("  budi ")).toBe("budi");
    expect(parseQuery(undefined)).toBe("");
    expect(parseQuery("x".repeat(200))).toHaveLength(100);
  });
});

describe("answerValue", () => {
  it("reads snapshot answers by field id", () => {
    const answers = [{ fieldId: "f1", label: "Instansi", value: "Kampus A" }];
    expect(answerValue(answers, "f1")).toBe("Kampus A");
    expect(answerValue(answers, "f2")).toBe("");
    expect(answerValue(null, "f1")).toBe("");
  });
});
