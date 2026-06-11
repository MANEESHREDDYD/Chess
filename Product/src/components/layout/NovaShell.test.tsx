import { act, fireEvent, render, screen, within } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { describe, expect, it, vi } from 'vitest';
import { AppHeader } from './AppHeader';
import { AppearanceToggle } from './AppearanceToggle';
import { BoardThemeMenu } from './BoardThemeMenu';
import { MoreMenu } from './MoreMenu';

function renderInRouter(ui: React.ReactNode) {
  return render(<MemoryRouter>{ui}</MemoryRouter>);
}

function clickOutside() {
  // Robust across jsdom: the popover listens for `pointerdown` on document.
  act(() => {
    document.dispatchEvent(new MouseEvent('pointerdown', { bubbles: true }));
  });
}

const headerProps = {
  activeTheme: 'standard',
  setActiveTheme: vi.fn(),
  audioEnabled: false,
  setAudioEnabled: vi.fn(),
  audioVolume: 0.5,
  setAudioVolume: vi.fn(),
};

describe('MoreMenu', () => {
  it('opens on click, lists destinations, and closes on outside click', () => {
    renderInRouter(<MoreMenu />);
    expect(screen.queryByRole('menu')).toBeNull();

    fireEvent.click(screen.getByRole('button', { name: 'More' }));
    const menu = screen.getByRole('menu');
    expect(within(menu).getByRole('menuitem', { name: /Import games/ })).toBeInTheDocument();
    expect(within(menu).getByRole('menuitem', { name: /Engine diagnostics/ })).toBeInTheDocument();

    clickOutside();
    expect(screen.queryByRole('menu')).toBeNull();
  });

  it('closes on Escape', () => {
    renderInRouter(<MoreMenu />);
    fireEvent.click(screen.getByRole('button', { name: 'More' }));
    expect(screen.getByRole('menu')).toBeInTheDocument();
    fireEvent.keyDown(document, { key: 'Escape' });
    expect(screen.queryByRole('menu')).toBeNull();
  });

  it('navigates via menu link', () => {
    renderInRouter(
      <>
        <MoreMenu />
      </>
    );
    fireEvent.click(screen.getByRole('button', { name: 'More' }));
    const link = screen.getByRole('menuitem', { name: /Import games/ });
    expect(link).toHaveAttribute('href', '/import-pgn');
  });
});

describe('BoardThemeMenu', () => {
  it('shows the current theme label', () => {
    renderInRouter(<BoardThemeMenu activeTheme="mahabharata" setActiveTheme={vi.fn()} />);
    expect(screen.getByRole('button', { name: /Board theme: Kurukshetra/ })).toBeInTheDocument();
  });

  it('opens and selecting Kurukshetra updates the theme and closes', () => {
    const setActiveTheme = vi.fn();
    renderInRouter(<BoardThemeMenu activeTheme="standard" setActiveTheme={setActiveTheme} />);

    fireEvent.click(screen.getByRole('button', { name: /Board theme: Classic/ }));
    const listbox = screen.getByRole('listbox');
    expect(within(listbox).getByRole('option', { name: /Classic/ })).toHaveAttribute('aria-selected', 'true');

    fireEvent.click(within(listbox).getByRole('option', { name: /Kurukshetra/ }));
    expect(setActiveTheme).toHaveBeenCalledWith('mahabharata');
    expect(screen.queryByRole('listbox')).toBeNull();
  });

  it('selecting Classic updates the theme', () => {
    const setActiveTheme = vi.fn();
    renderInRouter(<BoardThemeMenu activeTheme="mahabharata" setActiveTheme={setActiveTheme} />);
    fireEvent.click(screen.getByRole('button', { name: /Board theme: Kurukshetra/ }));
    fireEvent.click(within(screen.getByRole('listbox')).getByRole('option', { name: /Classic/ }));
    expect(setActiveTheme).toHaveBeenCalledWith('standard');
  });
});

describe('AppHeader', () => {
  it('contains no native select control', () => {
    const { container } = renderInRouter(<AppHeader {...headerProps} />);
    expect(container.querySelector('select')).toBeNull();
  });

  it('exposes audio volume inside a popover (not in the header chrome)', () => {
    renderInRouter(<AppHeader {...headerProps} />);
    // No slider rendered until the audio popover is opened.
    expect(screen.queryByRole('slider')).toBeNull();
    fireEvent.click(screen.getByRole('button', { name: 'Sound off' }));
    const slider = screen.getByRole('slider', { name: 'Audio volume' });
    expect(slider).toBeDisabled();
  });
});

describe('AppearanceToggle', () => {
  it('shows only the opposite appearance and switches on click', () => {
    const setTheme = vi.fn();
    const { rerender } = render(<AppearanceToggle theme="dark" setTheme={setTheme} />);

    // Dark mode offers light; there is exactly ONE icon-only switch button.
    expect(screen.getAllByRole('button')).toHaveLength(1);
    fireEvent.click(screen.getByRole('button', { name: 'Switch to light appearance' }));
    expect(setTheme).toHaveBeenCalledWith('light');

    rerender(<AppearanceToggle theme="light" setTheme={setTheme} />);
    fireEvent.click(screen.getByRole('button', { name: 'Switch to dark appearance' }));
    expect(setTheme).toHaveBeenCalledWith('dark');
  });
});
