// Combining a selected country code with a typed national number needs one
// normalization step that every call site was skipping: in Ghana (and the
// UK, France, Germany, and most countries that use "0" as a domestic trunk
// prefix), a phone number is customarily written *with* that leading 0 --
// "0243505598" -- but the E.164 form actually stored/looked-up in the
// backend has it stripped: "+233243505598". Naive concatenation produced
// "+2330243505598", one digit too many, which silently never matches an
// existing patient's real record -- found via a real bug report where a
// genuinely-existing patient's phone kept routing through the new-patient
// path. `code` is expected in "+NNN" form (see lib/country-codes.ts).
export function normalizePhone(code: string, number: string): string {
  const codeDigits = code.replace(/\D/g, '')
  const numberDigits = number.replace(/\D/g, '').replace(/^0/, '')
  return `+${codeDigits}${numberDigits}`
}
