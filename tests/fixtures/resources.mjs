// Test fixtures only. Never imported by the application or backend.
export const seed = {
 employees: [
  { id: 'e1', name: 'Karim Ben Ali', role: 'Chauffeur', status: 'En mission', skills: 'Permis B, Permis D, Anglais, Longue distance', load: 86, email: 'karim@fleetpro.tn', phone: '+216 22 140 512' },
  { id: 'e2', name: 'Sami Trabelsi', role: 'Chauffeur', status: 'Disponible', skills: 'Permis B, Permis C, Utilitaires', load: 72, email: 'sami@fleetpro.tn', phone: '+216 24 620 350' },
  { id: 'e3', name: 'Yassine Mansour', role: 'Agent de livraison', status: 'Disponible', skills: 'Permis B, Remise des clés', load: 54, email: 'yassine@fleetpro.tn', phone: '+216 23 506 718' },
  { id: 'e4', name: 'Hela Riahi', role: 'Mécanicien·ne', status: 'Disponible', skills: 'Freinage, Diagnostic OBD, Vidange', load: 38, email: 'hela@fleetpro.tn', phone: '+216 26 380 915' },
  { id: 'e5', name: 'Nizar Kacem', role: 'Préparateur', status: 'Disponible', skills: 'Nettoyage, Contrôle état', load: 21, email: 'nizar@fleetpro.tn', phone: '+216 21 789 640' },
  { id: 'e6', name: 'Ines Saidi', role: 'Chargé·e clientèle', status: 'Congé', skills: 'Facturation, Français, Anglais', load: 0, email: 'ines@fleetpro.tn', phone: '+216 25 301 482' },
 ],
 tasks: [
  { id: 't1', title: 'Livraison de 3 Golf 8', client: 'Carthage Tech', location: 'Les Berges du Lac 2', date: '2026-10-26', start: '09:00', end: '12:00', skill: 'Permis B', employeeId: '', status: 'Proposée' },
  { id: 't2', title: 'Chauffeur · mission Sousse', client: 'Sahel Pharma', location: 'Sousse', date: '2026-10-27', start: '08:00', end: '17:00', skill: 'Permis B', employeeId: '', status: 'Proposée' },
  { id: 't3', title: 'Remplacement des plaquettes', client: 'Parc agence · Clio 5', location: 'Atelier Tunis', date: '2026-10-26', start: '08:00', end: '10:00', skill: 'Freinage', employeeId: '', status: 'Proposée' },
  { id: 't4', title: 'Préparation de 5 citadines', client: 'Medina Events', location: 'Agence Tunis', date: '2026-10-28', start: '10:00', end: '14:00', skill: 'Nettoyage', employeeId: '', status: 'Proposée' },
  { id: 't5', title: 'Transfert aéroport', client: 'Atlas Logistique', location: 'Tunis-Carthage', date: '2026-10-29', start: '09:00', end: '11:00', skill: 'Permis B', employeeId: 'e1', status: 'Affectée' },
  { id: 't6', title: 'Mission avec chauffeur', client: 'BTP Nord', location: 'Centre-ville Tunis', date: '2026-10-29', start: '10:00', end: '12:00', skill: 'Permis B', employeeId: 'e1', status: 'Affectée' },
 ],
 equipment: [
  { id: 'q1', name: 'Valise diagnostic OBD', assignment: 'Atelier · Hela Riahi', status: 'Opérationnel' },
  { id: 'q2', name: 'Pont élévateur 3,5 t', assignment: 'Atelier Tunis', status: 'Opérationnel' },
  { id: 'q3', name: 'Nettoyeur haute pression', assignment: 'Préparation · Nizar Kacem', status: 'En révision' },
  { id: 'q4', name: 'Booster de démarrage', assignment: 'Véhicule d’assistance', status: 'En prêt' },
  { id: 'q5', name: 'Cric hydraulique', assignment: 'Atelier Tunis', status: 'Opérationnel' },
 ],
 stock: [
  { id: 's1', name: 'Plaquettes de frein', quantity: 4, minimum: 10, unit: 'jeux' },
  { id: 's2', name: 'Filtres à huile', quantity: 18, minimum: 8, unit: 'pièces' },
  { id: 's3', name: 'Huile moteur 5W30', quantity: 42, minimum: 20, unit: 'litres' },
  { id: 's4', name: 'Balais essuie-glace', quantity: 6, minimum: 6, unit: 'paires' },
  { id: 's5', name: 'Ampoules H7', quantity: 25, minimum: 10, unit: 'pièces' },
 ],
 shifts: Array.from({ length: 5 }, (_, employee) => Array.from({ length: 5 }, (_, day) => ({ id: `h${employee}-${day}`, employeeId: `e${employee + 1}`, date: `2026-10-${26 + day}`, start: employee === 4 ? '10:00' : '08:00', end: employee === 4 ? '19:00' : '18:00' }))).flat(),
};
