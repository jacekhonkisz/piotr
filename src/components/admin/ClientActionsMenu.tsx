'use client';

import React, {
  useCallback,
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
} from 'react';
import { createPortal } from 'react-dom';
import {
  MoreHorizontal,
  Eye,
  FileText,
  Edit3,
  Key as KeyIcon,
  SlidersHorizontal,
  Trash2,
} from 'lucide-react';

export interface ClientActionsMenuProps {
  onOpenDashboard: () => void;
  onOpenReports: () => void;
  onGenerateReport: () => void;
  onEdit: () => void;
  onCredentials: () => void;
  onMetricsConfig?: () => void;
  onDelete: () => void;
}

// Visual constants - keep in sync with classes below
const MENU_WIDTH = 240; // matches w-60 (15rem)
const MENU_GAP = 6; // gap between trigger button and menu
const VIEWPORT_MARGIN = 8; // safe area from viewport edges

export default function ClientActionsMenu(props: ClientActionsMenuProps) {
  const {
    onOpenDashboard,
    onOpenReports,
    onGenerateReport,
    onEdit,
    onCredentials,
    onMetricsConfig,
    onDelete,
  } = props;

  const [open, setOpen] = useState(false);
  const [mounted, setMounted] = useState(false);
  const [coords, setCoords] = useState<{ top: number; left: number } | null>(
    null,
  );

  const buttonRef = useRef<HTMLButtonElement>(null);
  const menuRef = useRef<HTMLDivElement>(null);

  // Only render portal after mount to avoid SSR/hydration issues
  useEffect(() => {
    setMounted(true);
  }, []);

  // Compute menu coordinates relative to the viewport. The menu is rendered
  // through a portal with position:fixed, so it escapes any ancestor that has
  // `overflow:hidden` (such as the rounded ClientsTable container).
  const updateCoords = useCallback(() => {
    const btn = buttonRef.current;
    if (!btn) return;

    const rect = btn.getBoundingClientRect();
    const viewportW = window.innerWidth;
    const viewportH = window.innerHeight;

    // Horizontal: align menu's right edge with the trigger's right edge.
    let left = rect.right - MENU_WIDTH;
    if (left < VIEWPORT_MARGIN) left = VIEWPORT_MARGIN;
    if (left + MENU_WIDTH > viewportW - VIEWPORT_MARGIN) {
      left = viewportW - MENU_WIDTH - VIEWPORT_MARGIN;
    }

    // Vertical: prefer below the trigger, flip above if there's not enough
    // room and more space exists upward.
    const measuredH = menuRef.current?.offsetHeight ?? 0;
    const spaceBelow = viewportH - rect.bottom - VIEWPORT_MARGIN;
    const spaceAbove = rect.top - VIEWPORT_MARGIN;

    let top = rect.bottom + MENU_GAP;

    if (measuredH > 0 && measuredH + MENU_GAP > spaceBelow && spaceAbove > spaceBelow) {
      top = rect.top - measuredH - MENU_GAP;
    }

    // Final clamp so we never overflow the viewport vertically
    if (top < VIEWPORT_MARGIN) top = VIEWPORT_MARGIN;
    if (measuredH > 0 && top + measuredH > viewportH - VIEWPORT_MARGIN) {
      top = Math.max(VIEWPORT_MARGIN, viewportH - measuredH - VIEWPORT_MARGIN);
    }

    setCoords({ top, left });
  }, []);

  // First-pass position immediately on open (before paint), then again after
  // the menu mounts so we can use its measured height for flip logic.
  useLayoutEffect(() => {
    if (!open) {
      setCoords(null);
      return;
    }
    updateCoords();
  }, [open, updateCoords]);

  useEffect(() => {
    if (!open) return;
    // Second pass once the DOM has the menu node measured
    const id = requestAnimationFrame(updateCoords);
    return () => cancelAnimationFrame(id);
  }, [open, updateCoords]);

  // Outside click / Escape / reposition on scroll & resize
  useEffect(() => {
    if (!open) return;

    const handleClick = (e: MouseEvent) => {
      const target = e.target as Node;
      if (
        buttonRef.current?.contains(target) ||
        menuRef.current?.contains(target)
      ) {
        return;
      }
      setOpen(false);
    };

    const handleKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setOpen(false);
    };

    const handleReposition = () => updateCoords();

    document.addEventListener('mousedown', handleClick);
    document.addEventListener('keydown', handleKey);
    window.addEventListener('resize', handleReposition);
    // Capture-phase scroll listener so we catch scrolling on any ancestor
    window.addEventListener('scroll', handleReposition, true);

    return () => {
      document.removeEventListener('mousedown', handleClick);
      document.removeEventListener('keydown', handleKey);
      window.removeEventListener('resize', handleReposition);
      window.removeEventListener('scroll', handleReposition, true);
    };
  }, [open, updateCoords]);

  const handleItem = (action: () => void) => () => {
    setOpen(false);
    action();
  };

  const menu = (
    <div
      ref={menuRef}
      role="menu"
      style={{
        position: 'fixed',
        top: coords?.top ?? -9999,
        left: coords?.left ?? -9999,
        width: MENU_WIDTH,
        // Hide until we have real coordinates to avoid a flash in the corner
        visibility: coords ? 'visible' : 'hidden',
      }}
      className="z-[1000] bg-white border border-[#E9EEF5] rounded-xl shadow-[0_12px_32px_rgba(16,24,40,0.12)] py-1.5"
      onClick={(e) => e.stopPropagation()}
    >
      <MenuItem icon={Eye} label="Otwórz dashboard klienta" onClick={handleItem(onOpenDashboard)} />
      <MenuItem icon={FileText} label="Szczegółowe raporty" onClick={handleItem(onOpenReports)} />
      <MenuItem icon={FileText} label="Wygeneruj raport" onClick={handleItem(onGenerateReport)} />
      <Divider />
      <MenuItem icon={Edit3} label="Edytuj klienta" onClick={handleItem(onEdit)} />
      <MenuItem icon={KeyIcon} label="Dane logowania / hasło" onClick={handleItem(onCredentials)} />
      {onMetricsConfig && (
        <MenuItem
          icon={SlidersHorizontal}
          label="Konfiguracja metryk"
          onClick={handleItem(onMetricsConfig)}
        />
      )}
      <Divider />
      <MenuItem
        icon={Trash2}
        label="Usuń klienta"
        onClick={handleItem(onDelete)}
        destructive
      />
    </div>
  );

  return (
    <>
      <button
        ref={buttonRef}
        type="button"
        aria-label="Więcej akcji"
        aria-haspopup="menu"
        aria-expanded={open}
        onClick={(e) => {
          e.stopPropagation();
          setOpen((v) => !v);
        }}
        className="inline-flex items-center justify-center w-9 h-9 rounded-lg text-[#667085] hover:bg-[#F2F4F7] hover:text-[#344054] focus:outline-none focus:ring-2 focus:ring-[#BFD2FF] transition-colors"
      >
        <MoreHorizontal className="h-5 w-5" />
      </button>

      {open && mounted ? createPortal(menu, document.body) : null}
    </>
  );
}

function Divider() {
  return <div className="my-1 h-px bg-[#E9EEF5]" />;
}

interface MenuItemProps {
  icon: React.ComponentType<{ className?: string }>;
  label: string;
  onClick: () => void;
  destructive?: boolean;
}

function MenuItem({ icon: Icon, label, onClick, destructive }: MenuItemProps) {
  return (
    <button
      type="button"
      role="menuitem"
      onClick={onClick}
      className={`w-full flex items-center gap-2.5 px-3 py-2 text-sm text-left transition-colors ${
        destructive
          ? 'text-[#B42318] hover:bg-[#FEF3F2]'
          : 'text-[#344054] hover:bg-[#F8FAFC]'
      }`}
    >
      <Icon className={`h-4 w-4 flex-shrink-0 ${destructive ? 'text-[#D92D20]' : 'text-[#667085]'}`} />
      <span className="truncate">{label}</span>
    </button>
  );
}
