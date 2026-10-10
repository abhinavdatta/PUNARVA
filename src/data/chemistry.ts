export interface ChemistryOption {
  id: string
  label: string
  /** Typical single-cell / block nominal voltage in volts, null when variable. */
  typicalNominalV: number | null
}

/**
 * Common chemistries offered in the Battery Check form. Selecting one only
 * pre-fills the nominal-voltage field when the user has not entered a value —
 * the user can always edit or clear it. We do not invent ratings.
 */
export const CHEMISTRIES: ChemistryOption[] = [
  { id: 'li-ion', label: 'Li-ion (lithium-ion)', typicalNominalV: 3.7 },
  { id: 'lifepo4', label: 'LiFePO4 (lithium iron phosphate)', typicalNominalV: 3.2 },
  { id: 'lead-acid', label: 'Lead-acid (12 V block)', typicalNominalV: 12 },
  { id: 'nimh', label: 'NiMH (nickel-metal hydride)', typicalNominalV: 1.2 },
  { id: 'alkaline', label: 'Alkaline', typicalNominalV: 1.5 },
  { id: 'other', label: 'Other / not sure', typicalNominalV: null },
]

export function chemistryLabel(id: string): string {
  return CHEMISTRIES.find((c) => c.id === id)?.label ?? id
}

export function typicalNominalV(id: string): number | null {
  return CHEMISTRIES.find((c) => c.id === id)?.typicalNominalV ?? null
}
