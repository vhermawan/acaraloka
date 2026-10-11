import { Link2, Video } from "lucide-react";
import { siGooglemeet, siYoutube, siZoom } from "simple-icons";

import type { MeetingProviderId } from "@/lib/meeting-provider";

const BRAND_ICONS = {
  zoom: siZoom,
  meet: siGooglemeet,
  youtube: siYoutube,
} as const;

type MeetingProviderIconProps = {
  provider: MeetingProviderId;
  className?: string;
};

function MeetingProviderIcon({ provider, className = "size-5" }: MeetingProviderIconProps) {
  if (provider === "teams") return <Video aria-hidden="true" className={className} />;
  if (provider === "link") return <Link2 aria-hidden="true" className={className} />;

  const icon = BRAND_ICONS[provider];
  return (
    <svg role="img" aria-hidden="true" viewBox="0 0 24 24" fill={`#${icon.hex}`} className={className}>
      <path d={icon.path} />
    </svg>
  );
}

export { MeetingProviderIcon };
