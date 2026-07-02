import { createElement } from 'react';
import { afterEach, describe, expect, it } from 'vitest';
import { cleanup, render } from '@testing-library/react';
import { placeholderDomId } from './placeholders';

afterEach(cleanup);

// Exercises the full react + react-dom + @testing-library/react + jsdom harness
// against a real placeholder id, verifying the DOM test environment works.
describe('placeholder div rendering (harness check)', () => {
  it('renders a div whose id equals placeholderDomId(id)', () => {
    render(createElement('div', { id: placeholderDomId(101) }));
    const el = document.getElementById('ezoic-pub-ad-placeholder-101');
    expect(el).not.toBeNull();
    expect(el?.tagName).toBe('DIV');
  });
});
