// Illustrative home-page data only. Never imported by CRUD services or persisted in MongoDB.
export const DEMO_FINANCE = {
 months: ['Mai', 'Juin', 'Juil.', 'Août', 'Sept.', 'Oct.'],
 revenue: [29400, 34200, 32800, 40500, 43100, 48600],
 expenses: [12100, 14200, 15800, 15300, 17200, 18750],
 monthlyReservations: [72, 86, 91, 115, 118, 128],
 dailyLabels: ['Lun', 'Mar', 'Mer', 'Jeu', 'Ven', 'Sam', 'Dim'],
 dailyReservations: [12, 18, 14, 22, 27, 24, 11],
};
export const DEMO_RESERVATIONS = [
 { id: 'RES-1048', client: 'Horizon Conseil', vehicle: 'Volkswagen Golf 8', period: '21–24 oct.', time: '09:00', status: 'En cours' },
 { id: 'RES-1049', client: 'Nova Distribution', vehicle: 'Renault Clio 5', period: '21–23 oct.', time: '10:30', status: 'En cours' },
 { id: 'RES-1050', client: 'Atlas Services', vehicle: 'Peugeot 3008', period: '22–26 oct.', time: '08:00', status: 'À venir' },
 { id: 'RES-1051', client: 'Optima Groupe', vehicle: 'Toyota Corolla', period: '22–25 oct.', time: '11:00', status: 'À venir' },
 { id: 'RES-1052', client: 'Horizon Conseil', vehicle: 'Mercedes Classe C', period: '23–27 oct.', time: '09:30', status: 'À venir' },
];
export const DEMO_ALERTS = [
 { tone: 'orange', title: 'Révision à planifier', text: 'Peugeot 208 · entretien prévu dans 3 jours.', icon: 'tool' },
 { tone: 'blue', title: 'Restitutions attendues', text: '5 véhicules à réceptionner cet après-midi.', icon: 'car' },
 { tone: 'orange', title: 'Réclamations à traiter', text: '4 demandes clients en attente de réponse.', icon: 'chat' },
];
