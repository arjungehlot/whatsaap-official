export const defaultCountryCode = "+91";

export const countryCodes = [
  { code: "+91", label: "India", flag: "IN" },
  { code: "+1", label: "United States / Canada", flag: "US" },
  { code: "+44", label: "United Kingdom", flag: "GB" },
  { code: "+971", label: "United Arab Emirates", flag: "AE" },
  { code: "+966", label: "Saudi Arabia", flag: "SA" },
  { code: "+974", label: "Qatar", flag: "QA" },
  { code: "+965", label: "Kuwait", flag: "KW" },
  { code: "+968", label: "Oman", flag: "OM" },
  { code: "+973", label: "Bahrain", flag: "BH" },
  { code: "+61", label: "Australia", flag: "AU" },
  { code: "+65", label: "Singapore", flag: "SG" },
  { code: "+60", label: "Malaysia", flag: "MY" },
  { code: "+977", label: "Nepal", flag: "NP" },
  { code: "+880", label: "Bangladesh", flag: "BD" },
  { code: "+94", label: "Sri Lanka", flag: "LK" },
];

export function splitPhoneNumber(phone = "") {
  const normalized = phone.trim();
  const match = countryCodes
    .slice()
    .sort((a, b) => b.code.length - a.code.length)
    .find((country) => normalized.startsWith(country.code));

  if (!match) return { countryCode: defaultCountryCode, localNumber: normalized.replace(/\D/g, "") };
  return {
    countryCode: match.code,
    localNumber: normalized.slice(match.code.length).replace(/\D/g, ""),
  };
}

export function buildPhoneNumber(countryCode: string, localNumber: string) {
  return `${countryCode}${localNumber.replace(/\D/g, "")}`;
}
