"use client";

import { useEffect, useRef, type ReactNode, type RefObject } from "react";

type DialogProps = {
  open: boolean;
  onClose: () => void;
  titleId: string;
  descriptionId?: string;
  role?: "dialog" | "alertdialog";
  initialFocusRef?: RefObject<HTMLElement | null>;
  maxWidthClass?: string;
  closeOnScrim?: boolean;
  alignTop?: boolean;
  children: ReactNode;
};

const FOCUSABLE_SELECTOR =
  'a[href], button:not([disabled]), textarea:not([disabled]), input:not([disabled]), select:not([disabled]), [tabindex]:not([tabindex="-1"])';

export default function Dialog({
  open,
  onClose,
  titleId,
  descriptionId,
  role = "dialog",
  initialFocusRef,
  maxWidthClass = "max-w-md",
  closeOnScrim = true,
  alignTop = false,
  children,
}: DialogProps) {
  const panelRef = useRef<HTMLDivElement>(null);
  const previousFocusRef = useRef<HTMLElement | null>(null);
  const onCloseRef = useRef(onClose);

  useEffect(() => {
    onCloseRef.current = onClose;
  }, [onClose]);

  useEffect(() => {
    if (!open) return;

    previousFocusRef.current = document.activeElement instanceof HTMLElement ? document.activeElement : null;

    const focusTimer = window.setTimeout(() => {
      if (initialFocusRef?.current) {
        initialFocusRef.current.focus();
        return;
      }
      const firstFocusable = panelRef.current?.querySelector<HTMLElement>(FOCUSABLE_SELECTOR);
      if (firstFocusable) {
        firstFocusable.focus();
      } else {
        panelRef.current?.focus();
      }
    }, 0);

    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") {
        event.preventDefault();
        onCloseRef.current();
        return;
      }

      if (event.key !== "Tab" || !panelRef.current) return;
      const focusables = Array.from(panelRef.current.querySelectorAll<HTMLElement>(FOCUSABLE_SELECTOR)).filter(
        (el) => el.offsetParent !== null || el === document.activeElement,
      );
      if (focusables.length === 0) {
        event.preventDefault();
        return;
      }

      const first = focusables[0];
      const last = focusables[focusables.length - 1];
      if (event.shiftKey) {
        if (document.activeElement === first || !panelRef.current.contains(document.activeElement)) {
          event.preventDefault();
          last.focus();
        }
      } else if (document.activeElement === last || !panelRef.current.contains(document.activeElement)) {
        event.preventDefault();
        first.focus();
      }
    }

    document.addEventListener("keydown", handleKeyDown);

    return () => {
      window.clearTimeout(focusTimer);
      document.removeEventListener("keydown", handleKeyDown);
      previousFocusRef.current?.focus();
    };
  }, [open, initialFocusRef]);

  if (!open) return null;

  return (
    <div
      className={`fixed inset-0 z-50 flex justify-center bg-[var(--scrim)] p-4 backdrop-blur-xs ${
        alignTop ? "items-start pt-12 sm:pt-16" : "items-center"
      }`}
      onMouseDown={(event) => {
        if (closeOnScrim && event.target === event.currentTarget) {
          onClose();
        }
      }}
    >
      <div
        ref={panelRef}
        tabIndex={-1}
        role={role}
        aria-modal="true"
        aria-labelledby={titleId}
        aria-describedby={descriptionId}
        className={`dialog-enter w-full ${maxWidthClass} max-h-[85dvh] overflow-y-auto rounded-[2rem] border border-[var(--line)] bg-[var(--surface)] p-6 shadow-2xl outline-none`}
      >
        {children}
      </div>
    </div>
  );
}
