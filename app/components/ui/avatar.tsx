"use client";
import { initials } from '../../../lib/resources';

function Avatar({ name, index = 0, small = false }: { name: string; index?: number; small?: boolean }) { return <span className={`avatar color-${index % 6} ${small ? 'small' : ''}`}>{initials(name)}</span>; }

export { Avatar };
