export interface CountryDialCode {
  iso2: string;
  name: string;
  dialCode: string;
}

// Common countries for a guest phone picker. Not exhaustive of all ~240 ISO territories —
// extend this list if a specific country is missing rather than switching data sources.
export const COUNTRY_DIAL_CODES: CountryDialCode[] = [
  { iso2: "IN", name: "India", dialCode: "+91" },
  { iso2: "US", name: "United States", dialCode: "+1" },
  { iso2: "GB", name: "United Kingdom", dialCode: "+44" },
  { iso2: "AE", name: "United Arab Emirates", dialCode: "+971" },
  { iso2: "AU", name: "Australia", dialCode: "+61" },
  { iso2: "CA", name: "Canada", dialCode: "+1" },
  { iso2: "SG", name: "Singapore", dialCode: "+65" },
  { iso2: "DE", name: "Germany", dialCode: "+49" },
  { iso2: "FR", name: "France", dialCode: "+33" },
  { iso2: "IT", name: "Italy", dialCode: "+39" },
  { iso2: "ES", name: "Spain", dialCode: "+34" },
  { iso2: "NL", name: "Netherlands", dialCode: "+31" },
  { iso2: "CH", name: "Switzerland", dialCode: "+41" },
  { iso2: "SE", name: "Sweden", dialCode: "+46" },
  { iso2: "JP", name: "Japan", dialCode: "+81" },
  { iso2: "CN", name: "China", dialCode: "+86" },
  { iso2: "HK", name: "Hong Kong", dialCode: "+852" },
  { iso2: "KR", name: "South Korea", dialCode: "+82" },
  { iso2: "TH", name: "Thailand", dialCode: "+66" },
  { iso2: "MY", name: "Malaysia", dialCode: "+60" },
  { iso2: "ID", name: "Indonesia", dialCode: "+62" },
  { iso2: "PH", name: "Philippines", dialCode: "+63" },
  { iso2: "VN", name: "Vietnam", dialCode: "+84" },
  { iso2: "NZ", name: "New Zealand", dialCode: "+64" },
  { iso2: "ZA", name: "South Africa", dialCode: "+27" },
  { iso2: "NG", name: "Nigeria", dialCode: "+234" },
  { iso2: "EG", name: "Egypt", dialCode: "+20" },
  { iso2: "SA", name: "Saudi Arabia", dialCode: "+966" },
  { iso2: "QA", name: "Qatar", dialCode: "+974" },
  { iso2: "KW", name: "Kuwait", dialCode: "+965" },
  { iso2: "OM", name: "Oman", dialCode: "+968" },
  { iso2: "BH", name: "Bahrain", dialCode: "+973" },
  { iso2: "PK", name: "Pakistan", dialCode: "+92" },
  { iso2: "BD", name: "Bangladesh", dialCode: "+880" },
  { iso2: "LK", name: "Sri Lanka", dialCode: "+94" },
  { iso2: "NP", name: "Nepal", dialCode: "+977" },
  { iso2: "BR", name: "Brazil", dialCode: "+55" },
  { iso2: "MX", name: "Mexico", dialCode: "+52" },
  { iso2: "RU", name: "Russia", dialCode: "+7" },
  { iso2: "TR", name: "Turkey", dialCode: "+90" },
  { iso2: "IL", name: "Israel", dialCode: "+972" },
];

export const DEFAULT_COUNTRY_DIAL_CODE = COUNTRY_DIAL_CODES[0]!; // India — primary market
