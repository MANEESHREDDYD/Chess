import { useEffect, useRef, useState, type ReactNode } from 'react';
import { cx } from './classNames';

export type PopoverTriggerProps = {
  'aria-expanded': boolean;
  'aria-haspopup': 'menu' | 'listbox' | 'dialog';
  onClick: () => void;
};

type NovaPopoverProps = {
  align?: 'left' | 'right';
  className?: string;
  panelClassName?: string;
  panelRole?: 'menu' | 'listbox' | 'dialog';
  ariaLabel?: string;
  /** Render the trigger; spread triggerProps onto your button. */
  renderTrigger: (state: { open: boolean; toggle: () => void; triggerProps: PopoverTriggerProps }) => ReactNode;
  /** Panel content. Call close() after an action to dismiss. */
  children: (close: () => void) => ReactNode;
};

/**
 * Accessible popover used by the More and Board Theme menus.
 *
 * The panel is mounted only while open (never an always-present `hidden`
 * element), so the legacy "CSS overrides [hidden]" / "opens behind content"
 * failures are structurally impossible. It must be hosted inside an elevated
 * stacking context (the Nova header) so it paints above route content.
 */
export function NovaPopover({
  align = 'right',
  className,
  panelClassName,
  panelRole = 'menu',
  ariaLabel,
  renderTrigger,
  children,
}: NovaPopoverProps) {
  const [open, setOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement | null>(null);
  const panelRef = useRef<HTMLDivElement | null>(null);

  const toggle = () => setOpen((prev) => !prev);
  const close = () => setOpen(false);

  useEffect(() => {
    if (!open) return undefined;

    const handlePointerDown = (event: PointerEvent) => {
      if (!rootRef.current?.contains(event.target as Node)) setOpen(false);
    };
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        setOpen(false);
        rootRef.current?.querySelector<HTMLElement>('[data-popover-trigger]')?.focus();
      }
    };
    document.addEventListener('pointerdown', handlePointerDown);
    document.addEventListener('keydown', handleKeyDown);
    return () => {
      document.removeEventListener('pointerdown', handlePointerDown);
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, [open]);

  useEffect(() => {
    if (!open) return;
    // Move focus into the panel predictably when it opens.
    const first = panelRef.current?.querySelector<HTMLElement>(
      'a[href], button:not([disabled]), [tabindex]:not([tabindex="-1"])'
    );
    first?.focus();
  }, [open]);

  return (
    <div className={cx('nova-popover', className)} ref={rootRef}>
      {renderTrigger({
        open,
        toggle,
        triggerProps: { 'aria-expanded': open, 'aria-haspopup': panelRole, onClick: toggle },
      })}
      {open ? (
        <div
          ref={panelRef}
          className={cx('nova-popover__panel', align === 'left' && 'nova-popover__panel--left', panelClassName)}
          role={panelRole}
          aria-label={ariaLabel}
        >
          {children(close)}
        </div>
      ) : null}
    </div>
  );
}
