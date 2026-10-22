"use client";
import { useAuth } from '../auth-gate';
import { Icon } from './icons';

function Empty({ text, action, onClick }: { text: string; action?: string; onClick?: () => void }) {
 const admin = useAuth().role === 'ADMIN';
 return <div className="empty-state"><Icon name="box" size={32}/><h3>{text}</h3>{admin && action && onClick && <button className="btn ghost small-btn" onClick={onClick}><Icon name="plus" size={14}/>{action}</button>}</div>;
}

export { Empty };
