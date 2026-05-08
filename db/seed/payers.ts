/**
 * Initial payer master list. Curated set of major US payers — admins can add more
 * via the portal. Names are the canonical brand name; clients see these verbatim.
 */
type SeedPayer = {
  name: string;
  payerType: "commercial" | "medicare" | "medicaid" | "tricare" | "other";
  statesActive: string[];
  recredCycleMonths: number;
};

const ALL_STATES = [
  "AL", "AK", "AZ", "AR", "CA", "CO", "CT", "DE", "DC", "FL",
  "GA", "HI", "ID", "IL", "IN", "IA", "KS", "KY", "LA", "ME",
  "MD", "MA", "MI", "MN", "MS", "MO", "MT", "NE", "NV", "NH",
  "NJ", "NM", "NY", "NC", "ND", "OH", "OK", "OR", "PA", "RI",
  "SC", "SD", "TN", "TX", "UT", "VT", "VA", "WA", "WV", "WI", "WY",
];

export const payers: SeedPayer[] = [
  // National commercial
  { name: "Aetna", payerType: "commercial", statesActive: ALL_STATES, recredCycleMonths: 36 },
  { name: "Cigna", payerType: "commercial", statesActive: ALL_STATES, recredCycleMonths: 36 },
  { name: "Humana", payerType: "commercial", statesActive: ALL_STATES, recredCycleMonths: 36 },
  { name: "UnitedHealthcare", payerType: "commercial", statesActive: ALL_STATES, recredCycleMonths: 36 },

  // BCBS — federation; one entry per state plan (most common ones)
  { name: "Blue Cross Blue Shield of Texas", payerType: "commercial", statesActive: ["TX"], recredCycleMonths: 36 },
  { name: "Blue Shield of California", payerType: "commercial", statesActive: ["CA"], recredCycleMonths: 36 },
  { name: "Anthem Blue Cross (CA)", payerType: "commercial", statesActive: ["CA"], recredCycleMonths: 36 },
  { name: "Empire BlueCross BlueShield (NY)", payerType: "commercial", statesActive: ["NY"], recredCycleMonths: 36 },
  { name: "BCBS of Illinois", payerType: "commercial", statesActive: ["IL"], recredCycleMonths: 36 },
  { name: "BCBS of Florida (Florida Blue)", payerType: "commercial", statesActive: ["FL"], recredCycleMonths: 36 },

  // Medicare / Medicaid (federal + state)
  { name: "Medicare (CMS)", payerType: "medicare", statesActive: ALL_STATES, recredCycleMonths: 60 },
  { name: "Medicare Advantage (UHC)", payerType: "medicare", statesActive: ALL_STATES, recredCycleMonths: 36 },

  { name: "Texas Medicaid", payerType: "medicaid", statesActive: ["TX"], recredCycleMonths: 36 },
  { name: "California Medi-Cal", payerType: "medicaid", statesActive: ["CA"], recredCycleMonths: 36 },
  { name: "New York Medicaid", payerType: "medicaid", statesActive: ["NY"], recredCycleMonths: 36 },
  { name: "Florida Medicaid", payerType: "medicaid", statesActive: ["FL"], recredCycleMonths: 36 },

  // TRICARE
  { name: "TRICARE East (Humana Military)", payerType: "tricare", statesActive: ALL_STATES, recredCycleMonths: 36 },
  { name: "TRICARE West (Health Net)", payerType: "tricare", statesActive: ALL_STATES, recredCycleMonths: 36 },

  // Other major
  { name: "Molina Healthcare", payerType: "commercial", statesActive: ALL_STATES, recredCycleMonths: 36 },
  { name: "Centene / Ambetter", payerType: "commercial", statesActive: ALL_STATES, recredCycleMonths: 36 },
  { name: "Kaiser Permanente", payerType: "commercial", statesActive: ["CA", "CO", "GA", "HI", "MD", "OR", "VA", "WA", "DC"], recredCycleMonths: 36 },
];
