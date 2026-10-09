import { describe, expect, it, vi } from "vitest";

import { createResendSender } from "@/server/resend";

const config = { apiKey: "re_test", from: "Acaraloka <noreply@send.acaraloka.test>", replyTo: "halo@acaraloka.test", dailyBudget: 95 };
const email = { to: "budi@contoh.test", subject: "Halo", html: "<p>Halo</p>", text: "Halo" };

function jsonResponse(status: number, body: unknown) {
  return new Response(JSON.stringify(body), { status, headers: { "Content-Type": "application/json" } });
}

describe("createResendSender", () => {
  it("posts one email with the idempotency key", async () => {
    const fetchMock = vi.fn(async () => jsonResponse(200, { id: "msg_1" }));
    const send = createResendSender(config, fetchMock as unknown as typeof fetch);

    await expect(send(email, "ticket-confirmed:reg1")).resolves.toEqual({ ok: true, id: "msg_1" });

    const [url, init] = fetchMock.mock.calls[0] as unknown as [string, RequestInit];
    expect(url).toBe("https://api.resend.com/emails");
    expect(init.headers).toMatchObject({ Authorization: "Bearer re_test", "Idempotency-Key": "ticket-confirmed:reg1" });
    expect(JSON.parse(String(init.body))).toEqual({
      from: config.from,
      to: ["budi@contoh.test"],
      reply_to: "halo@acaraloka.test",
      subject: "Halo",
      html: "<p>Halo</p>",
      text: "Halo",
    });
  });

  it("returns the status and provider message on failure", async () => {
    const send = createResendSender(config, (async () => jsonResponse(429, { message: "Too many requests" })) as unknown as typeof fetch);

    await expect(send(email, "k")).resolves.toEqual({ ok: false, status: 429, message: "Too many requests" });
  });

  it("treats network errors as status null", async () => {
    const send = createResendSender(config, (async () => {
      throw new Error("ECONNRESET");
    }) as unknown as typeof fetch);

    await expect(send(email, "k")).resolves.toEqual({ ok: false, status: null, message: "ECONNRESET" });
  });
});
