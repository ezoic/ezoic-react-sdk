import { describe, expect, it } from 'vitest';
import {
  ID_TO_LOCATION,
  LOCATION_ALIASES,
  isKnownLocation,
  resolveLocationIdFromMap,
} from './locations';

describe('ID_TO_LOCATION map', () => {
  it('maps the documented named locations to their reserved ids', () => {
    expect(ID_TO_LOCATION[900]).toBe('top_of_page');
    expect(ID_TO_LOCATION[901]).toBe('under_page_title');
    expect(ID_TO_LOCATION[902]).toBe('bottom_of_page');
    expect(ID_TO_LOCATION[909]).toBe('under_first_paragraph');
    expect(ID_TO_LOCATION[910]).toBe('under_second_paragraph');
    expect(ID_TO_LOCATION[911]).toBe('mid_content');
  });

  it('shares sidebar_middle across ids 904–906', () => {
    expect(ID_TO_LOCATION[904]).toBe('sidebar_middle');
    expect(ID_TO_LOCATION[905]).toBe('sidebar_middle');
    expect(ID_TO_LOCATION[906]).toBe('sidebar_middle');
  });

  it('numbers the in-content family with the verified 961 gap', () => {
    // 915..960 = incontent_5..incontent_50, then 961 is skipped, then 962..999.
    expect(ID_TO_LOCATION[915]).toBe('incontent_5');
    expect(ID_TO_LOCATION[960]).toBe('incontent_50');
    expect(ID_TO_LOCATION[961]).toBeUndefined();
    expect(ID_TO_LOCATION[962]).toBe('incontent_51');
    expect(ID_TO_LOCATION[999]).toBe('incontent_88');
  });

  it('covers exactly 99 ids (900–999 inclusive minus the 961 gap)', () => {
    expect(Object.keys(ID_TO_LOCATION)).toHaveLength(99);
  });
});

describe('LOCATION_ALIASES', () => {
  it('resolves the documented aliases to canonical names', () => {
    expect(LOCATION_ALIASES.incontent_0).toBe('under_second_paragraph');
    expect(LOCATION_ALIASES.incontent_1).toBe('mid_content');
    expect(LOCATION_ALIASES.sidebar_floating).toBe('sidebar_floating_1');
  });
});

describe('isKnownLocation', () => {
  it('accepts canonical names, aliases, and in-content names', () => {
    expect(isKnownLocation('top_of_page')).toBe(true);
    expect(isKnownLocation('under_first_paragraph')).toBe(true);
    expect(isKnownLocation('incontent_1')).toBe(true); // alias
    expect(isKnownLocation('incontent_5')).toBe(true); // canonical
  });

  it('rejects typos and out-of-range in-content names', () => {
    expect(isKnownLocation('under_frist_paragraph')).toBe(false);
    expect(isKnownLocation('banana')).toBe(false);
    expect(isKnownLocation('incontent_999')).toBe(false);
    expect(isKnownLocation('')).toBe(false);
  });
});

describe('resolveLocationIdFromMap', () => {
  it('returns the precise id for a canonical name', () => {
    expect(resolveLocationIdFromMap('top_of_page')).toBe(900);
    expect(resolveLocationIdFromMap('under_first_paragraph')).toBe(909);
    expect(resolveLocationIdFromMap('mid_content')).toBe(911);
  });

  it('resolves aliases before looking up the id', () => {
    expect(resolveLocationIdFromMap('incontent_1')).toBe(911); // -> mid_content
    expect(resolveLocationIdFromMap('incontent_0')).toBe(910); // -> under_second_paragraph
    expect(resolveLocationIdFromMap('sidebar_floating')).toBe(908); // -> sidebar_floating_1
  });

  it('returns undefined for an unknown location', () => {
    expect(resolveLocationIdFromMap('nope')).toBeUndefined();
  });

  it('walks the in-content family for a taken generic slot', () => {
    // mid_content (911) is taken; the next free in-content id is 915.
    expect(resolveLocationIdFromMap('mid_content', (id) => id === 911)).toBe(915);
  });

  it('walks the sidebar family for a taken sidebar slot', () => {
    // sidebar (903) is taken; the next free sidebar id is 904.
    expect(resolveLocationIdFromMap('sidebar', (id) => id === 903)).toBe(904);
  });

  it('falls back to the precise id when the whole family is taken', () => {
    expect(resolveLocationIdFromMap('top_of_page', () => true)).toBe(900);
  });
});
