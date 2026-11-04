import React, { useEffect, useRef } from 'react';
import { cn } from '@/lib/utils';
import { X } from 'lucide-react';

interface ModalShellProps {
  isOpen: boolean;
  onClose: () => void;
  title: string;
  headerGradient: string;
  headerCategory?: string;
  headerBadge?: string;
  headerNote?: string;
  titleColor?: string;
  categoryColor?: string;
  badgeBg?: string;
  badgeBorder?: string;
  badgeTextColor?: string;
  isLowQuality?: boolean;
  reducedMotion?: boolean;
  children: React.ReactNode;
}

export function ModalShell({
  isOpen,
  onClose,
  title,
  headerGradient,
  headerCategory = 'CLASS: SMARTPHONE INC',
  headerBadge,
  headerNote,
  titleColor = '#1c1917',
  categoryColor = '#78350f',
  badgeBg = 'rgba(255, 255, 255, 0.45)',
  badgeBorder = 'rgba(120, 53, 15, 0.5)',
  badgeTextColor = '#1c1917',
  isLowQuality = false,
  reducedMotion = false,
  children,
}: ModalShellProps) {
  const modalRef = useRef<HTMLDivElement>(null);
  const previouslyFocusedElementRef = useRef<HTMLElement | null>(null);

  // Esc key and backdrop focus management
  useEffect(() => {
    if (!isOpen) return;

    previouslyFocusedElementRef.current = document.activeElement as HTMLElement | null;

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.preventDefault();
        onClose();
      }
    };

    window.addEventListener('keydown', handleKeyDown);

    // Focus modal container
    if (modalRef.current) {
      modalRef.current.focus();
    }

    return () => {
      window.removeEventListener('keydown', handleKeyDown);
      if (previouslyFocusedElementRef.current) {
        previouslyFocusedElementRef.current.focus?.();
      }
    };
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  return (
    <div
      className={cn(
        "absolute inset-0 z-50 flex items-center justify-center select-none font-sans",
        !isLowQuality && "backdrop-blur-[6px]",
        reducedMotion ? "transition-none" : "transition-opacity duration-300"
      )}
      style={{ backgroundColor: 'rgba(11, 18, 38, 0.55)' }}
      onClick={(e) => {
        if (e.target === e.currentTarget) {
          onClose();
        }
      }}
      role="dialog"
      aria-modal="true"
      aria-label={title}
    >
      {/* 1620x940 Modal Container positioned at x=150, y=70 within 1920x1080 stage */}
      <div
        ref={modalRef}
        tabIndex={-1}
        className={cn(
          "absolute left-[150px] top-[70px] w-[1620px] h-[940px] bg-white rounded-[28px] overflow-hidden flex flex-col outline-none",
          reducedMotion ? "scale-100" : "animate-in fade-in zoom-in-95 duration-300"
        )}
        style={{
          boxShadow: '0 18px 48px rgba(11, 18, 38, 0.45)',
        }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header Band (Height: 112px) */}
        <div
          className="relative h-[112px] px-11 flex items-center justify-between shrink-0 rounded-t-[28px]"
          style={{ background: headerGradient }}
        >
          {/* Left Title and Badges */}
          <div className="flex items-center gap-6">
            <div className="flex flex-col">
              <span
                className="text-[13px] font-black uppercase tracking-[3px] leading-tight"
                style={{ color: categoryColor }}
              >
                {headerCategory}
              </span>
              <span
                className="text-[38px] font-black tracking-tight leading-none mt-0.5"
                style={{ color: titleColor }}
              >
                {title}
              </span>
            </div>

            {/* Optional Round Pill */}
            {headerBadge && (
              <div
                className="h-[34px] px-5 rounded-full border flex items-center justify-center text-[15px] font-black tracking-wider shadow-xs"
                style={{
                  backgroundColor: badgeBg,
                  borderColor: badgeBorder,
                  color: badgeTextColor,
                }}
              >
                {headerBadge}
              </div>
            )}

            {/* Header Note/Subtitle */}
            {headerNote && (
              <span className="text-[16px] font-bold tracking-wide opacity-90 text-[#44250a] ml-2">
                {headerNote}
              </span>
            )}
          </div>

          {/* Close Button */}
          <button
            type="button"
            onClick={(e) => {
              e.preventDefault();
              e.stopPropagation();
              onClose();
            }}
            className="w-[44px] h-[44px] rounded-full flex items-center justify-center bg-black/15 hover:bg-black/25 active:scale-95 transition-all text-slate-900 cursor-pointer shadow-xs pointer-events-auto z-50 shrink-0"
            title="Close modal (Esc)"
            aria-label="Close modal"
          >
            <X className="w-6 h-6 stroke-[3] pointer-events-none" />
          </button>
        </div>

        {/* Modal Body */}
        <div className="flex-1 relative overflow-hidden bg-white">
          {children}
        </div>
      </div>
    </div>
  );
}
