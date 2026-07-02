/**
 * Zero-config semantic placements (the 900–999 range).
 *
 * Instead of choosing numeric placeholder ids, a publisher can name a semantic
 * position ("under_first_paragraph", "top_of_page", …) and let Ezoic map it to a
 * reserved id in the 900–999 range. This file holds the verified name↔id map and
 * a pure resolver that mirrors the standalone bundle's static-map lookup, used as
 * the fallback when the runtime `ezstandalone.GetGeneratedIdAsync` is not
 * available (see {@link ./generatedId}).
 *
 * The map, aliases, and lookup order are verified against the live Ezoic
 * standalone script and documented at
 * https://docs.ezoic.com/docs/ezoicads/integration/. The numbering is NOT a
 * simple offset: id 961 is intentionally skipped, and `sidebar_middle` is shared
 * by ids 904–906 — so the map is written out literally rather than generated.
 */

/**
 * Canonical semantic placement names, each mapped to its reserved placeholder id
 * in 900–999. Multiple ids can share a name (e.g. the three `sidebar_middle`
 * slots); id 961 is not assigned.
 */
export const ID_TO_LOCATION: Readonly<Record<number, string>> = {
  900: 'top_of_page',
  901: 'under_page_title',
  902: 'bottom_of_page',
  903: 'sidebar',
  904: 'sidebar_middle',
  905: 'sidebar_middle',
  906: 'sidebar_middle',
  907: 'sidebar_bottom',
  908: 'sidebar_floating_1',
  909: 'under_first_paragraph',
  910: 'under_second_paragraph',
  911: 'mid_content',
  912: 'long_content',
  913: 'longer_content',
  914: 'longest_content',
  915: 'incontent_5',
  916: 'incontent_6',
  917: 'incontent_7',
  918: 'incontent_8',
  919: 'incontent_9',
  920: 'incontent_10',
  921: 'incontent_11',
  922: 'incontent_12',
  923: 'incontent_13',
  924: 'incontent_14',
  925: 'incontent_15',
  926: 'incontent_16',
  927: 'incontent_17',
  928: 'incontent_18',
  929: 'incontent_19',
  930: 'incontent_20',
  931: 'incontent_21',
  932: 'incontent_22',
  933: 'incontent_23',
  934: 'incontent_24',
  935: 'incontent_25',
  936: 'incontent_26',
  937: 'incontent_27',
  938: 'incontent_28',
  939: 'incontent_29',
  940: 'incontent_30',
  941: 'incontent_31',
  942: 'incontent_32',
  943: 'incontent_33',
  944: 'incontent_34',
  945: 'incontent_35',
  946: 'incontent_36',
  947: 'incontent_37',
  948: 'incontent_38',
  949: 'incontent_39',
  950: 'incontent_40',
  951: 'incontent_41',
  952: 'incontent_42',
  953: 'incontent_43',
  954: 'incontent_44',
  955: 'incontent_45',
  956: 'incontent_46',
  957: 'incontent_47',
  958: 'incontent_48',
  959: 'incontent_49',
  960: 'incontent_50',
  // 961 is intentionally unassigned in the Ezoic map.
  962: 'incontent_51',
  963: 'incontent_52',
  964: 'incontent_53',
  965: 'incontent_54',
  966: 'incontent_55',
  967: 'incontent_56',
  968: 'incontent_57',
  969: 'incontent_58',
  970: 'incontent_59',
  971: 'incontent_60',
  972: 'incontent_61',
  973: 'incontent_62',
  974: 'incontent_63',
  975: 'incontent_64',
  976: 'incontent_65',
  977: 'incontent_66',
  978: 'incontent_67',
  979: 'incontent_68',
  980: 'incontent_69',
  981: 'incontent_70',
  982: 'incontent_71',
  983: 'incontent_72',
  984: 'incontent_73',
  985: 'incontent_74',
  986: 'incontent_75',
  987: 'incontent_76',
  988: 'incontent_77',
  989: 'incontent_78',
  990: 'incontent_79',
  991: 'incontent_80',
  992: 'incontent_81',
  993: 'incontent_82',
  994: 'incontent_83',
  995: 'incontent_84',
  996: 'incontent_85',
  997: 'incontent_86',
  998: 'incontent_87',
  999: 'incontent_88',
};

/**
 * Location aliases the bundle resolves to a canonical name before the id lookup.
 * e.g. `incontent_0` → `under_second_paragraph`.
 */
export const LOCATION_ALIASES: Readonly<Record<string, string>> = {
  incontent_0: 'under_second_paragraph',
  incontent_1: 'mid_content',
  incontent_2: 'long_content',
  incontent_3: 'longer_content',
  incontent_4: 'longest_content',
  sidebar_floating: 'sidebar_floating_1',
  sidebar_floating_2: 'sidebar_middle',
  sidebar_floating_3: 'sidebar_bottom',
};

/** Canonical (non-alias) semantic placement names, for editor autocomplete. */
export type EzoicNamedLocation =
  | 'top_of_page'
  | 'under_page_title'
  | 'bottom_of_page'
  | 'sidebar'
  | 'sidebar_middle'
  | 'sidebar_bottom'
  | 'sidebar_floating_1'
  | 'under_first_paragraph'
  | 'under_second_paragraph'
  | 'mid_content'
  | 'long_content'
  | 'longer_content'
  | 'longest_content';

/** Documented aliases that resolve to a canonical name. */
export type EzoicLocationAlias =
  | 'incontent_0'
  | 'incontent_1'
  | 'incontent_2'
  | 'incontent_3'
  | 'incontent_4'
  | 'sidebar_floating'
  | 'sidebar_floating_2'
  | 'sidebar_floating_3';

/** The in-content family (`incontent_5` … `incontent_88`). */
export type EzoicIncontentLocation = `incontent_${number}`;

/**
 * A semantic placement name accepted by `<EzoicAd location=…>`. The exact valid
 * set is enforced at runtime by {@link isKnownLocation}; the template-literal
 * member keeps the in-content family readable without listing all 84 entries.
 */
export type EzoicLocation = EzoicNamedLocation | EzoicLocationAlias | EzoicIncontentLocation;

/** Every canonical location value, precomputed for membership checks. */
const LOCATION_VALUES: ReadonlySet<string> = new Set(Object.values(ID_TO_LOCATION));

/** Reserved ids in ascending order, precomputed for the resolver's search loop. */
const SORTED_IDS: readonly number[] = Object.keys(ID_TO_LOCATION)
  .map(Number)
  .sort((a, b) => a - b);

/**
 * Whether `name` is a documented semantic location — a canonical name or an
 * alias. Unknown names (typos) return `false` so callers can report them instead
 * of silently allocating a slot.
 */
export function isKnownLocation(name: string): boolean {
  return Object.prototype.hasOwnProperty.call(LOCATION_ALIASES, name) || LOCATION_VALUES.has(name);
}

/**
 * Resolves a semantic location to a reserved placeholder id using the static
 * map — the fallback used when the runtime `GetGeneratedIdAsync` is unavailable.
 * Mirrors the bundle's lookup: resolve aliases, take the precise id for the name
 * when free, otherwise walk the same family (sidebar → sidebar, else in-content)
 * for the first free id.
 *
 * @param location A documented location name or alias.
 * @param isTaken Reports ids already claimed on the page, so repeated locations
 *   resolve to distinct free ids. Defaults to "nothing is taken".
 * @returns The reserved id, or `undefined` when `location` is not a documented
 *   name. For a known name whose whole family is taken, returns the name's
 *   precise id as a deterministic last resort.
 */
export function resolveLocationIdFromMap(
  location: string,
  isTaken: (id: number) => boolean = () => false,
): number | undefined {
  const canonical = LOCATION_ALIASES[location] ?? location;
  if (!LOCATION_VALUES.has(canonical)) return undefined;

  const preciseId = SORTED_IDS.find((id) => ID_TO_LOCATION[id] === canonical);
  if (preciseId !== undefined && !isTaken(preciseId)) return preciseId;

  const wantsSidebar = canonical.toLowerCase().includes('sidebar');
  for (const id of SORTED_IDS) {
    if (isTaken(id)) continue;
    const loc = ID_TO_LOCATION[id];
    if (!loc) continue;
    const matches = wantsSidebar
      ? loc.toLowerCase().includes('sidebar')
      : loc.startsWith('incontent_');
    if (matches) return id;
  }

  return preciseId;
}
