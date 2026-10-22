export const accessRoles = ['ADMIN', 'GESTIONNAIRE_FLOTTE', 'AGENT_RESERVATION', 'AGENT_FACTURATION', 'CHARGE_CLIENTELE'] as const;
export type AccessRole = typeof accessRoles[number];
export type AuthUser = { id: string; email: string; role: AccessRole; employeeId?: string };
export const roleLabels: Record<AccessRole, string> = { ADMIN: 'Administrateur', GESTIONNAIRE_FLOTTE: 'Gestionnaire de flotte', AGENT_RESERVATION: 'Agent de réservation', AGENT_FACTURATION: 'Comptabilité', CHARGE_CLIENTELE: 'Chargé de clientèle' };
export const roleModules: Record<AccessRole, string> = { ADMIN: 'Gestion des ressources', GESTIONNAIRE_FLOTTE: 'Véhicules et maintenance', AGENT_RESERVATION: 'Réservations et disponibilités', AGENT_FACTURATION: 'Comptabilité', CHARGE_CLIENTELE: 'Réclamations clients' };

export const fleetJobs = ['Mécanicien', 'Préparateur automobile'];

export const managementModules = ['vehicles', 'reservations', 'billing', 'resources', 'complaints'] as const;
export type ManagementModule = typeof managementModules[number];
export const managementLabels: Record<ManagementModule, string> = { vehicles: 'Véhicules', reservations: 'Réservations', billing: 'Comptabilité', resources: 'Ressources', complaints: 'Réclamations' };
const managedModule: Record<AccessRole, ManagementModule> = { ADMIN: 'resources', GESTIONNAIRE_FLOTTE: 'vehicles', AGENT_RESERVATION: 'reservations', AGENT_FACTURATION: 'billing', CHARGE_CLIENTELE: 'complaints' };
export function canManage(role: AccessRole, module: ManagementModule): boolean { return role === 'ADMIN' || managedModule[role] === module; }
