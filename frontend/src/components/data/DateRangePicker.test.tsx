import { fireEvent, render, screen } from '@testing-library/react';
import { NextIntlClientProvider } from 'next-intl';
import { describe, expect, it, vi } from 'vitest';

import messages from '../../../messages/en/index';
import { DateRangePicker, type DateRangePickerProps } from './DateRangePicker';

function setup(props: Partial<DateRangePickerProps> = {}) {
  const onChange = vi.fn();
  render(
    <NextIntlClientProvider locale="en" messages={messages} timeZone="Asia/Phnom_Penh">
      <DateRangePicker label="Placed" from="" to="" onChange={onChange} {...props} />
    </NextIntlClientProvider>,
  );
  const day = (d: string) => document.querySelector<HTMLButtonElement>(`[data-day="${d}"]`)!;
  return { onChange, day };
}

describe('DateRangePicker', () => {
  it('names the field and its value on the button', () => {
    setup({ from: '2026-10-01', to: '2026-10-21' });
    expect(screen.getByRole('button', { name: 'Placed: 1 Oct – 21 Oct 2026' })).toBeTruthy();
  });

  it('says "Any time" when no range is picked', () => {
    setup();
    expect(screen.getByRole('button', { name: 'Placed: Any time' })).toBeTruthy();
  });

  it('picks a start, then an end, and applies them', () => {
    const { onChange, day } = setup({ from: '2026-10-01', to: '2026-10-21' });
    fireEvent.click(screen.getByRole('button', { name: /^Placed:/ }));
    fireEvent.click(day('2026-10-05'));
    fireEvent.click(day('2026-10-01'));
    // Picked backwards: the earlier day becomes the start.
    fireEvent.click(screen.getByRole('button', { name: 'Apply' }));
    expect(onChange).toHaveBeenCalledWith('2026-10-01', '2026-10-05');
  });

  it('applies a preset and clears with "Any time"', () => {
    const { onChange } = setup({ from: '2026-10-01', to: '2026-10-21' });
    fireEvent.click(screen.getByRole('button', { name: /^Placed:/ }));
    fireEvent.click(screen.getByRole('button', { name: 'Any time' }));
    expect(onChange).toHaveBeenCalledWith('', '');
  });

  it('cancel leaves the range as it was', () => {
    const { onChange, day } = setup({ from: '2026-10-01', to: '2026-10-21' });
    fireEvent.click(screen.getByRole('button', { name: /^Placed:/ }));
    fireEvent.click(day('2026-10-05'));
    fireEvent.click(screen.getByRole('button', { name: 'Cancel' }));
    expect(onChange).not.toHaveBeenCalled();
    expect(screen.queryByRole('dialog')).toBeNull();
  });

  it('picks one day at once in single mode and blocks days after max', () => {
    const { onChange, day } = setup({
      mode: 'single',
      from: '2026-10-10',
      to: '2026-10-10',
      max: '2026-10-12',
    });
    fireEvent.click(screen.getByRole('button', { name: 'Placed: 10 Oct 2026' }));
    expect(day('2026-10-13').disabled).toBe(true);
    fireEvent.click(day('2026-10-11'));
    expect(onChange).toHaveBeenCalledWith('2026-10-11', '2026-10-11');
    expect(screen.queryByRole('dialog')).toBeNull();
  });

  it('moves between days with the arrow keys', () => {
    const { onChange } = setup({ mode: 'single', from: '2026-10-10', to: '2026-10-10' });
    fireEvent.click(screen.getByRole('button', { name: /^Placed:/ }));
    const dialog = screen.getByRole('dialog');
    fireEvent.keyDown(dialog, { key: 'ArrowRight' });
    fireEvent.keyDown(dialog, { key: 'ArrowDown' });
    fireEvent.keyDown(dialog, { key: 'Enter' });
    expect(onChange).toHaveBeenCalledWith('2026-10-18', '2026-10-18');
  });
});
