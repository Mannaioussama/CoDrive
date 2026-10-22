import { VehiclesGestion } from './vehicles';
import { ReservationsGestion } from './reservations';
import { BillingGestion } from './billing';
import { ComplaintsGestion } from './complaints';
import type { ManagementModule } from '../../lib/access';
import type { ComponentType } from 'react';

/** Roots for gestions other than Ressources (Ressources owns the workspace shell today). */
export const gestionRegistry: Record<Exclude<ManagementModule, 'resources'>, ComponentType> = {
  vehicles: VehiclesGestion,
  reservations: ReservationsGestion,
  billing: BillingGestion,
  complaints: ComplaintsGestion,
};
