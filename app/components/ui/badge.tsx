"use client";
import type { ReactNode } from 'react';

function Badge({ children, tone = 'gray' }: { children: ReactNode; tone?: string }) { return <span className={`badge ${tone}`}>{children}</span>; }

export { Badge };
