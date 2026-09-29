// NAV-145's "Action to be Taken" is not a NAV field: the team's Excel works it out with this formula (column AG of
// "NAV-145 - Design Map Planning Report.xlsx"). The nav_mirror tables carry only NAV fields, so the app repeats it.
//   library        = Matching Code + Size + Shape is in NAV-028 "Map Serial Inventory - Map Library"
//   design         = Design is in NAV-028 "Map Serial Inventory" (any location)
//   matching       = Matching Code is in it
//   designSize     = Design + Size + Shape is in it
//   matchingSize   = Matching Code + Size + Shape is in it
// The IFs run in the Excel's order; the odd-looking "Sketch & Matching" branch for a matching-size-shape hit is the
// formula as written, kept so the app and the sheet agree.
export interface MapLookups {
  library: boolean;
  design: boolean;
  matching: boolean;
  designSize: boolean;
  matchingSize: boolean;
}

export function actionToBeTaken({ library, design, matching, designSize, matchingSize }: MapLookups): string {
  if (library) return "Available";
  if (design && matching && designSize && matchingSize) return "Print";
  if (design && matchingSize && !matching && !designSize) return "Sketch & Matching";
  if (design && matching && !designSize && !matchingSize) return "Sketch & Color Copy";
  if (design && designSize && !matching && !matchingSize) return "Matching";
  if (design && matching && designSize && !matchingSize) return "Color Copy";
  if (!design && !matching && !designSize && !matchingSize) return "Sketch & Matching";
  if (design && !matching && !designSize && !matchingSize) return "Matching";
  return "";
}
