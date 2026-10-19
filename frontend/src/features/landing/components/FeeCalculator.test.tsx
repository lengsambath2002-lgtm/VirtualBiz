import { fireEvent, render, screen } from '@testing-library/react';
import { NextIntlClientProvider } from 'next-intl';
import { describe, expect, it } from 'vitest';

import messages from '../../../../messages/en/index';
import { FeeCalculator } from './FeeCalculator';

function setup() {
  render(
    <NextIntlClientProvider locale="en" messages={messages}>
      <FeeCalculator />
    </NextIntlClientProvider>,
  );
  const text = (id: string) => screen.getByTestId(`calc-${id}`).textContent;
  return { text };
}

describe('FeeCalculator', () => {
  it('starts at $2,000 online + $4,000 counter', () => {
    const { text } = setup();
    expect(text('online')).toBe('$2,000');
    expect(text('counter')).toBe('$4,000');
    expect(text('fee')).toBe('$100');
    expect(text('keep')).toBe('$5,900');
    expect(text('effective')).toBe('1.7%');
  });

  it('charges 5% of online sales only as the sliders move', () => {
    const { text } = setup();
    fireEvent.change(screen.getByLabelText(/Online sales per month/), {
      target: { value: '7300' },
    });
    fireEvent.change(screen.getByLabelText(/Counter \(POS\) sales per month/), {
      target: { value: '12500' },
    });
    expect(text('fee')).toBe('$365');
    expect(text('keep')).toBe('$19,435');
    expect(text('effective')).toBe('1.8%');
  });

  it('shows 0% with no sales', () => {
    const { text } = setup();
    fireEvent.change(screen.getByLabelText(/Online sales per month/), { target: { value: '0' } });
    fireEvent.change(screen.getByLabelText(/Counter \(POS\) sales per month/), {
      target: { value: '0' },
    });
    expect(text('effective')).toBe('0%');
  });
});
