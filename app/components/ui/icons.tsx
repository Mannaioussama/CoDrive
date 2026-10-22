"use client";
import type { ReactNode } from 'react';

function Icon({ name, size = 20 }: { name: string; size?: number }) {
 const paths: Record<string, ReactNode> = {
 settings: <><path d="m9 3 1-1h4l1 3 3 1 3-1 2 4-2 2v3l2 2-2 4-3-1-3 1-1 3h-4l-1-3-3-1-3 1-2-4 2-2v-3L1 8l2-4 3 1z"/><circle cx="12" cy="12" r="3"/></>,
 car: <><path d="m5 16 2-8h10l2 8M3 16h18M7 8l1-3h8l1 3M5 16v3m14-3v3M7 12h1m8 0h1"/></>,
 grid: <><rect x="3" y="3" width="7" height="8" rx="1.5"/><rect x="14" y="3" width="7" height="5" rx="1.5"/><rect x="3" y="15" width="7" height="6" rx="1.5"/><rect x="14" y="12" width="7" height="9" rx="1.5"/></>,
 users: <><circle cx="9" cy="8" r="3"/><path d="M3 21v-2a6 6 0 0 1 12 0v2M16 5a3 3 0 0 1 0 6m2 4a5 5 0 0 1 3 5"/></>,
 calendar: <><rect x="3" y="5" width="18" height="16" rx="3"/><path d="M7 3v4m10-4v4M3 11h18m-13 5h2m4 0h2"/></>,
 file: <><path d="M14 3H5v18h14V8zM14 3v5h5M8 13h8m-8 4h5"/></>,
 chat: <path d="M21 11a9 9 0 0 1-12 8l-6 2 2-6a9 9 0 1 1 16-4Z"/>,
 spark: <><path d="m12 3 2.5 6.5L21 12l-6.5 2.5L12 21l-2.5-6.5L3 12l6.5-2.5ZM20 2v4m-2-2h4"/></>,
 plus: <path d="M12 5v14M5 12h14"/>, search: <><circle cx="10.5" cy="10.5" r="6.5"/><path d="m16 16 4.5 4.5"/></>,
 bell: <><path d="M6 9a6 6 0 0 1 12 0c0 7 3 8 3 8H3s3-1 3-8m4 12h4"/></>,
 arrow: <path d="m9 5 7 7-7 7"/>, clock: <><circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/></>,
 pin: <><path d="M19 10c0 5-7 11-7 11S5 15 5 10a7 7 0 0 1 14 0Z"/><circle cx="12" cy="10" r="2"/></>,
 check: <path d="m5 12 4 4L19 6"/>, edit: <><path d="m14 4 6 6M4 14 16 2l6 6-12 12-7 1z"/><path d="M13 21h9"/></>,
 trash: <><path d="M3 6h18M9 6V3h6v3M5 6l1 15h12l1-15M10 10v7m4-7v7"/></>,
 box: <><path d="m3 7 9-5 9 5v10l-9 5-9-5zM3 7l9 5 9-5m-9 5v10M7 5l10 5"/></>,
 wrench: <path d="M14 3a6 6 0 0 0-7 8L2 16a3 3 0 0 0 4 4l5-5a6 6 0 0 0 10-6l-4 4-5-5z"/>,
 alert: <><path d="m12 3 10 18H2zM12 9v5m0 3v.1"/></>,
 shield: <><path d="m12 2 9 4v6c0 6-9 10-9 10S3 18 3 12V6z"/><path d="m8 12 3 3 5-6"/></>,
 more: <><circle cx="5" cy="12" r="1"/><circle cx="12" cy="12" r="1"/><circle cx="19" cy="12" r="1"/></>,
 wifi: <><path d="M3 8a15 15 0 0 1 18 0M6 12a10 10 0 0 1 12 0m-9 4a5 5 0 0 1 6 0"/><circle cx="12" cy="20" r=".5"/></>,
 download: <><path d="M12 3v12m-5-5 5 5 5-5M4 16v5h16v-5"/></>,
 help: <><circle cx="12" cy="12" r="9"/><path d="M9 9a3 3 0 1 1 4 3c-1 0-1 2-1 2m0 3v.1"/></>,
 };
 return <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">{paths[name] || paths.grid}</svg>;
}

export { Icon };
