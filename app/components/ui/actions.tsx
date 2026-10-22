"use client";
import { Icon } from './icons';

function Actions({ edit, remove, label, disabled = false }: { edit: () => void; remove: () => void; label: string; disabled?: boolean }) { return <div className="actions"><button className="icon-btn" disabled={disabled} onClick={edit} aria-label={`Modifier ${label}`} title="Modifier"><Icon name="edit" size={15}/></button><button className="icon-btn danger" disabled={disabled} onClick={remove} aria-label={`Supprimer ${label}`} title="Supprimer"><Icon name="trash" size={15}/></button></div>; }

export { Actions };
