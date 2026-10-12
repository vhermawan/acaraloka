import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";

import { AiSourceCard } from "@/components/certificate/ai/ai-source-card";
import { AI_DENIAL_MESSAGES } from "@/lib/ai-config";
import type { AiAccess } from "@/server/ai-access";

function render(access: AiAccess) {
  return renderToStaticMarkup(createElement(AiSourceCard, { eventId: "ev1", access }));
}

describe("AiSourceCard", () => {
  it("renders nothing when AI is hidden", () => {
    expect(render({ status: "HIDDEN", message: "Fitur AI sedang tidak tersedia." })).toBe("");
  });

  it("shows the badge, the beta note, the remaining attempts and a link to the AI page", () => {
    const html = render({ status: "AVAILABLE", remaining: 2 });
    expect(html).toContain("Beta");
    expect(html).toContain("Gratis selama beta");
    expect(html).toContain("2 dari 3 percobaan tersisa untuk acara ini");
    expect(html).toContain('href="/organizer/events/ev1/certificate/ai"');
  });

  it.each([
    ["PAUSED", AI_DENIAL_MESSAGES.CAP],
    ["QUOTA", AI_DENIAL_MESSAGES.EVENT_LIMIT],
    ["DAILY", AI_DENIAL_MESSAGES.DAILY_LIMIT],
  ] as const)("keeps %s reachable for earlier results and explains why", (status, message) => {
    const html = render({ status, message });
    expect(html).toContain(message);
    expect(html).toContain("Lihat hasil sebelumnya");
    expect(html).toContain('href="/organizer/events/ev1/certificate/ai"');
  });

  it("disables the card when the design is locked", () => {
    const html = render({ status: "LOCKED", message: AI_DENIAL_MESSAGES.LOCKED });
    expect(html).toContain(AI_DENIAL_MESSAGES.LOCKED);
    expect(html).toContain("disabled");
    expect(html).not.toContain("/certificate/ai");
  });
});
