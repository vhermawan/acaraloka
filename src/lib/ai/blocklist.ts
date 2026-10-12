export const BLOCKLIST_CATEGORIES = ["SEXUAL", "HATE", "DRUGS", "VIOLENCE"] as const;

export type BlocklistCategory = (typeof BLOCKLIST_CATEGORIES)[number];

export type BlocklistResult = { blocked: false } | { blocked: true; category: BlocklistCategory };

const TERMS: Record<BlocklistCategory, readonly string[]> = {
  SEXUAL: ["porn", "porno", "pornografi", "pornography", "bokep", "bugil", "hentai", "ngentot"],
  HATE: [
    "nigger",
    "nigga",
    "faggot",
    "kike",
    "heil hitler",
    "sieg heil",
    "white power",
    "ku klux klan",
    "cina babi",
    "china babi",
    "babi cina",
    "kafir laknat",
    "yahudi laknat",
    "bunuh cina",
    "usir cina",
    "islam teroris",
  ],
  DRUGS: ["ganja", "kokain", "cocaine", "heroin", "ekstasi", "ecstasy", "mdma", "marijuana", "putau", "inex"],
  VIOLENCE: [
    "bunuh",
    "membunuh",
    "dibunuh",
    "pembunuhan",
    "bantai",
    "pembantaian",
    "mutilasi",
    "penggal",
    "memenggal",
    "gorok",
    "tembak mati",
  ],
};

const CONTEXT_EXEMPT: readonly BlocklistCategory[] = ["DRUGS", "VIOLENCE"];
const PREVENTION_CONTEXT = /(?:^| )(?:anti|tolak|stop|bahaya|cegah|pencegahan|lawan|melawan|prevention|awareness)(?: |$)/;

const LEET: Record<string, string> = { "0": "o", "1": "i", "3": "e", "4": "a", "5": "s" };

export function normalizeForBlocklist(text: string): string {
  return text
    .normalize("NFD")
    .replace(/\p{M}/gu, "")
    .toLowerCase()
    .replace(/[01345]/g, (char) => LEET[char] ?? char)
    .replace(/(.)\1{2,}/g, "$1")
    .replace(/[^a-z\s]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

const MATCHERS = (Object.entries(TERMS) as [BlocklistCategory, readonly string[]][]).map(
  ([category, terms]) => ({ category, pattern: new RegExp(`(?:^| )(?:${terms.join("|")})(?: |$)`) }),
);

export function checkBlocklist(text: string): BlocklistResult {
  const normalized = normalizeForBlocklist(text);
  if (!normalized) return { blocked: false };
  const prevention = PREVENTION_CONTEXT.test(normalized);
  for (const { category, pattern } of MATCHERS) {
    if (prevention && CONTEXT_EXEMPT.includes(category)) continue;
    if (pattern.test(normalized)) return { blocked: true, category };
  }
  return { blocked: false };
}

const FORBIDDEN_VISUALS = /\b(?:hexagram|six[- ]pointed|star of david|swastika)\b/i;

export function hasForbiddenVisual(text: string): boolean {
  return FORBIDDEN_VISUALS.test(text);
}
