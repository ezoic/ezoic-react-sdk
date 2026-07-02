import { describe, expect, it } from 'vitest';
import {
  EZOIC_PLACEHOLDER_PREFIX,
  MAX_PLACEHOLDER_ID,
  MIN_PLACEHOLDER_ID,
  isValidPlaceholderId,
  placeholderDomId,
} from './placeholders';

describe('isValidPlaceholderId', () => {
  it('accepts the inclusive 1–999 range', () => {
    expect(isValidPlaceholderId(MIN_PLACEHOLDER_ID)).toBe(true);
    expect(isValidPlaceholderId(101)).toBe(true);
    expect(isValidPlaceholderId(MAX_PLACEHOLDER_ID)).toBe(true);
    // zero-config semantic range (900–999) is a subset of 1–999
    expect(isValidPlaceholderId(909)).toBe(true);
  });

  it('rejects ids outside 1–999', () => {
    expect(isValidPlaceholderId(0)).toBe(false);
    expect(isValidPlaceholderId(1000)).toBe(false);
    expect(isValidPlaceholderId(MAX_PLACEHOLDER_ID + 1)).toBe(false);
    expect(isValidPlaceholderId(MIN_PLACEHOLDER_ID - 1)).toBe(false);
    expect(isValidPlaceholderId(-1)).toBe(false);
    expect(isValidPlaceholderId(-909.5)).toBe(false);
  });

  it('rejects non-integers and non-numbers', () => {
    expect(isValidPlaceholderId(1.5)).toBe(false);
    expect(isValidPlaceholderId(Number.NaN)).toBe(false);
    expect(isValidPlaceholderId(Number.POSITIVE_INFINITY)).toBe(false);
    expect(isValidPlaceholderId('101')).toBe(false);
    expect(isValidPlaceholderId(null)).toBe(false);
    expect(isValidPlaceholderId(undefined)).toBe(false);
  });
});

describe('placeholderDomId', () => {
  it('builds the ezoic-pub-ad-placeholder-<id> DOM id', () => {
    expect(placeholderDomId(101)).toBe(`${EZOIC_PLACEHOLDER_PREFIX}101`);
    expect(placeholderDomId(101)).toBe('ezoic-pub-ad-placeholder-101');
    expect(placeholderDomId(909)).toBe('ezoic-pub-ad-placeholder-909');
  });

  it('throws RangeError on an invalid id', () => {
    expect(() => placeholderDomId(0)).toThrow(RangeError);
    expect(() => placeholderDomId(1000)).toThrow(RangeError);
    expect(() => placeholderDomId(MAX_PLACEHOLDER_ID + 1)).toThrow(RangeError);
    // @ts-expect-error runtime guard also protects non-number callers
    expect(() => placeholderDomId('101')).toThrow(RangeError);
  });

  it('names the valid range in the thrown error message', () => {
    expect(() => placeholderDomId(1000)).toThrow(
      `${String(MIN_PLACEHOLDER_ID)} and ${String(MAX_PLACEHOLDER_ID)}`,
    );
  });
});
