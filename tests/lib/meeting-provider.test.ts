import { describe, expect, it } from "vitest";

import { detectMeetingProvider, parseHttpsUrl } from "@/lib/meeting-provider";

describe("detectMeetingProvider", () => {
  it.each([
    ["https://zoom.us/j/123", "zoom"],
    ["https://us02web.zoom.us/j/123?pwd=x", "zoom"],
    ["https://meet.google.com/abc-defg-hij", "meet"],
    ["https://teams.microsoft.com/l/meetup-join/xyz", "teams"],
    ["https://teams.live.com/meet/123", "teams"],
    ["https://www.youtube.com/watch?v=abc", "youtube"],
    ["https://youtu.be/abc", "youtube"],
    ["https://example.com/room", "link"],
    ["https://notzoom.us/j/1", "link"],
    ["https://zoom.us.evil.test/j/1", "link"],
    ["not a url", "link"],
    ["http://zoom.us/j/1", "link"],
  ])("detects %s as %s", (url, id) => {
    expect(detectMeetingProvider(url).id).toBe(id);
  });

  it("labels the generic fallback", () => {
    expect(detectMeetingProvider("https://example.com").label).toBe("Tautan");
  });
});

describe("parseHttpsUrl", () => {
  it("accepts plain https and rejects other schemes and credentials", () => {
    expect(parseHttpsUrl(" https://zoom.us/j/1 ")?.hostname).toBe("zoom.us");
    expect(parseHttpsUrl("http://zoom.us")).toBeNull();
    expect(parseHttpsUrl("ftp://zoom.us")).toBeNull();
    expect(parseHttpsUrl("https://a:b@zoom.us")).toBeNull();
    expect(parseHttpsUrl("https://localhost")).toBeNull();
  });
});
