"use client";
import { useEffect, useRef, type ReactNode } from 'react';

function Dialog({ children, close, title }: { children: ReactNode; close: () => void; title: string }) {
 const ref = useRef<HTMLElement>(null);
 useEffect(() => { const previous = document.activeElement as HTMLElement | null; const oldOverflow = document.body.style.overflow; document.body.style.overflow = 'hidden'; ref.current?.focus(); return () => { document.body.style.overflow = oldOverflow; previous?.focus(); }; }, []);
 return <div className="modal-backdrop" onMouseDown={e => { if (e.target === e.currentTarget) close(); }}><section className="modal" ref={ref} tabIndex={-1} role="dialog" aria-modal="true" aria-label={title} onKeyDown={e => { if (e.key === 'Escape') close(); if (e.key === 'Tab') { const els = Array.from(ref.current?.querySelectorAll<HTMLElement>('button:not([disabled]), input, select, textarea, a[href]') || []); const first = els[0], last = els[els.length - 1]; if (e.shiftKey && (document.activeElement === first || document.activeElement === ref.current)) { e.preventDefault(); last?.focus(); } else if (!e.shiftKey && (document.activeElement === last || document.activeElement === ref.current)) { e.preventDefault(); first?.focus(); } } }}><button className="modal-close icon-btn" onClick={close} aria-label="Fermer">×</button>{children}</section></div>;
}

export { Dialog };
