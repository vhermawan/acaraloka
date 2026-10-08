import { describe, expect, it } from "vitest";

import { eventSectionHref, parseEventPath } from "@/components/events/event-sections";

describe("parseEventPath", () => {
  it("reads the event id and section from an event path", () => {
    expect(parseEventPath("/organizer/events/abc123/checkin")).toMatchObject({
      eventId: "abc123",
      section: { segment: "checkin", label: "Check-in" },
    });
  });

  it("treats the event root as the detail section", () => {
    expect(parseEventPath("/organizer/events/abc123")?.section.label).toBe("Detail");
  });

  it("ignores the list and the new event form", () => {
    expect(parseEventPath("/organizer")).toBeNull();
    expect(parseEventPath("/organizer/events/new")).toBeNull();
  });
});

describe("eventSectionHref", () => {
  it("builds detail and section links", () => {
    expect(eventSectionHref("abc123", "")).toBe("/organizer/events/abc123");
    expect(eventSectionHref("abc123", "tickets")).toBe("/organizer/events/abc123/tickets");
  });
});
