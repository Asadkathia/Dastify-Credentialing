// Maps a US state name (full or 2-letter, mixed case) to the canonical
// 2-letter uppercase ISO code. Returns null for unknown input.
//
// Includes the 50 states + DC + Puerto Rico + the four other US territories
// the credentialing process can encounter.

const STATE_NAME_TO_CODE: Record<string, string> = {
  alabama: "AL",
  alaska: "AK",
  arizona: "AZ",
  arkansas: "AR",
  california: "CA",
  colorado: "CO",
  connecticut: "CT",
  delaware: "DE",
  florida: "FL",
  georgia: "GA",
  hawaii: "HI",
  idaho: "ID",
  illinois: "IL",
  indiana: "IN",
  iowa: "IA",
  kansas: "KS",
  kentucky: "KY",
  louisiana: "LA",
  maine: "ME",
  maryland: "MD",
  massachusetts: "MA",
  michigan: "MI",
  minnesota: "MN",
  mississippi: "MS",
  missouri: "MO",
  montana: "MT",
  nebraska: "NE",
  nevada: "NV",
  "new hampshire": "NH",
  "new jersey": "NJ",
  "new mexico": "NM",
  "new york": "NY",
  "north carolina": "NC",
  "north dakota": "ND",
  ohio: "OH",
  oklahoma: "OK",
  oregon: "OR",
  pennsylvania: "PA",
  "rhode island": "RI",
  "south carolina": "SC",
  "south dakota": "SD",
  tennessee: "TN",
  texas: "TX",
  utah: "UT",
  vermont: "VT",
  virginia: "VA",
  washington: "WA",
  "west virginia": "WV",
  wisconsin: "WI",
  wyoming: "WY",
  "district of columbia": "DC",
  "puerto rico": "PR",
  "u.s. virgin islands": "VI",
  "us virgin islands": "VI",
  "virgin islands": "VI",
  guam: "GU",
  "american samoa": "AS",
  "northern mariana islands": "MP",
};

const VALID_2_LETTER_CODES = new Set(Object.values(STATE_NAME_TO_CODE));

/**
 * Normalize a single state input. Accepts a 2-letter code or a full state
 * name (case- and whitespace-insensitive). Returns the canonical 2-letter
 * uppercase code, or null when nothing matches.
 */
export function normalizeStateCode(input: string | null | undefined): string | null {
  if (!input) return null;
  const trimmed = input.trim();
  if (trimmed.length === 0) return null;

  // 2-letter code?
  const upper = trimmed.toUpperCase();
  if (upper.length === 2 && VALID_2_LETTER_CODES.has(upper)) return upper;

  // Full name?
  const key = trimmed.toLowerCase().replace(/\s+/g, " ");
  const match = STATE_NAME_TO_CODE[key];
  return match ?? null;
}

/**
 * Split a multi-state cell into individual state inputs. Accepts comma,
 * semicolon, slash, or newline as delimiters. Returns the trimmed parts.
 * An empty input returns an empty array.
 */
export function splitMultiStateCell(input: string | null | undefined): string[] {
  if (!input) return [];
  const trimmed = input.trim();
  if (trimmed.length === 0) return [];
  return trimmed
    .split(/[,;/\n]+/)
    .map((s) => s.trim())
    .filter((s) => s.length > 0);
}
