'use client';

import React, { useEffect, useRef, useState } from 'react';
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
  const wrapperRef = useRef<HTMLDivElement>(null);
  const menuRef = useRef<HTMLDivElement>(null);
  const [position, setPosition] = useState<'right' | 'left'>('right');

  // Close on outside click / Escape
  useEffect(() => {
    if (!open) return;

    const handleClick = (e: MouseEvent) => {
      if (wrapperRef.current && !wrapperRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setOpen(false);
    };

    document.addEventListener('mousedown', handleClick);
    document.addEventListener('keydown', handleKey);
    return () => {
      document.removeEventListener('mousedown', handleClick);
      document.removeEventListener('keydown', handleKey);
    };
  }, [open]);

  // Flip menu to the left if it would overflow the viewport
  useEffect(() => {
    if (!open) return;
    const rect = menuRef.current?.getBoundingClientRect();
    if (!rect) return;
    if (rect.right > window.innerWidth - 12) {
      setPosition('left');
    }
  }, [open]);

  const handleItem = (action: () => void) => () => {
    setOpen(false);
    action();
  };

  return (
    <div ref={wrapperRef} className="relative inline-block">
      <button
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

      {open && (
        <div
          ref={menuRef}
          role="menu"
          className={`absolute top-full mt-1.5 z-50 w-60 bg-white border border-[#E9EEF5] rounded-xl shadow-[0_12px_32px_rgba(16,24,40,0.12)] py-1.5 ${
            position === 'right' ? 'right-0' : 'left-0'
          }`}
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
      )}
    </div>
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
