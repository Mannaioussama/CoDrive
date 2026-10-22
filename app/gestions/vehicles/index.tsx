"use client";
import { canManage, managementLabels, type ManagementModule } from '../../../lib/access';
import { useAuth } from '../../components/auth-gate';
import { Badge } from '../../components/ui/badge';
import './vehicles.css';

export function VehiclesGestion() {
  const user = useAuth();
  const management = 'vehicles' as ManagementModule;
  return (
    <section className="panel access-note">
      <h1>{managementLabels[management]}</h1>
      <Badge tone="blue">{canManage(user.role, management) ? 'Gestion autorisée' : 'Consultation uniquement'}</Badge>
      <p>Ce module métier reste à développer. Vos droits sont définis pour son intégration.</p>
    </section>
  );
}
