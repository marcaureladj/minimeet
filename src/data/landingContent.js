// Landing Page Content Data
export const navLinks = [
  { label: 'Fonctionnalités', href: '#features' },
  { label: 'Tarifs', href: '#pricing' },
  { label: 'À propos', href: '#about' },
];

export const heroContent = {
  title: 'Réunions simples.',
  titleHighlight: 'Résultats extraordinaires.',
  subtitle: 'La visioconférence pensée pour les professionnels qui veulent aller à l\'essentiel.',
  badges: ['Multi-utilisateurs'],
};

export const features = [
  { icon: '/p2p.png', title: 'Visioconférence P2P', description: 'Connexion directe et sécurisée entre participants' },
  { icon: '/real.png', title: 'Chat en temps réel', description: 'Messagerie instantanée pendant vos réunions' },
  { icon: '/screen.png', title: 'Partage d\'écran', description: 'Partagez votre écran en un clic' },
  { icon: '/rec.png', title: 'Enregistrement', description: 'Enregistrez vos réunions importantes' },
  { icon: '/room.png', title: 'Rooms réutilisables', description: 'Créez des salles permanentes pour vos équipes' },
  { icon: '/todo_list.png', title: 'Todo List collaborative', description: 'Gérez vos tâches en équipe' },
  { icon: '/whiteboard.png', title: 'Tableau blanc', description: 'Dessinez et annotez ensemble' },
  { icon: '/ai_summuraize.png', title: 'Résumés IA', description: 'Résumés automatiques de vos réunions' },
];

export const steps = [
  { number: '01', title: 'Créez votre room', description: 'En un clic, générez une salle de réunion unique et sécurisée.' },
  { number: '02', title: 'Invitez votre équipe', description: 'Partagez le lien et vos collaborateurs rejoignent instantanément.' },
  { number: '03', title: 'Collaborez efficacement', description: 'Profitez de tous les outils pour des réunions productives.' },
];

export const testimonials = [
  { name: 'Marie Dupont', role: 'CEO', company: 'TechStart', quote: 'MiniMeet a transformé nos réunions d\'équipe. Simple, efficace, indispensable.', avatar: 'M' },
  { name: 'Thomas Martin', role: 'Product Manager', company: 'InnoLab', quote: 'Les résumés IA nous font gagner un temps précieux après chaque réunion.', avatar: 'T' },
  { name: 'Sophie Bernard', role: 'Designer', company: 'CreativeHub', quote: 'Le tableau blanc collaboratif est parfait pour nos sessions de brainstorming.', avatar: 'S' },
];

export const pricingPlans = [
  {
    name: 'Gratuit',
    price: '0€',
    period: '/mois',
    description: 'Pour démarrer',
    features: ['Réunions jusqu\'à 40 min', '2 participants max', 'Chat en temps réel', 'Partage d\'écran'],
    cta: 'Commencer gratuitement',
    popular: false,
  },
  {
    name: 'Pro',
    price: '12€',
    period: '/mois',
    description: 'Pour les équipes',
    features: ['Réunions illimitées', '10 participants', 'Enregistrement', 'Résumés IA', 'Tableau blanc', 'Support prioritaire'],
    cta: 'Essai gratuit 14 jours',
    popular: true,
  },
  {
    name: 'Enterprise',
    price: 'Sur mesure',
    period: '',
    description: 'Pour les grandes équipes',
    features: ['Participants illimités', 'SSO & SAML', 'API access', 'SLA garanti', 'Account manager dédié', 'Formation incluse'],
    cta: 'Nous contacter',
    popular: false,
  },
];

export const faqs = [
  { q: 'MiniMeet est-il vraiment gratuit ?', a: 'Oui ! Notre plan gratuit vous permet de faire des réunions jusqu\'à 40 minutes avec 2 participants, sans carte bancaire.' },
  { q: 'Comment fonctionne le résumé IA ?', a: 'Notre IA transcrit automatiquement vos réunions et génère un résumé des points clés, décisions et actions à suivre.' },
  { q: 'Mes données sont-elles sécurisées ?', a: 'Absolument. Toutes les communications sont chiffrées de bout en bout. Vos données restent privées.' },
  { q: 'Puis-je utiliser MiniMeet sur mobile ?', a: 'Oui, MiniMeet fonctionne sur tous les navigateurs modernes, desktop et mobile.' },
  { q: 'Comment inviter des participants ?', a: 'Partagez simplement le lien de votre room. Aucune inscription requise pour rejoindre.' },
  { q: 'Puis-je personnaliser mes rooms ?', a: 'Avec le plan Pro, vous pouvez créer des rooms permanentes avec des URLs personnalisées.' },
];

export const footerLinks = {
  product: ['Fonctionnalités', 'Tarifs', 'Intégrations', 'Changelog'],
  resources: ['Documentation', 'Tutoriels', 'Blog', 'Webinaires'],
  company: ['À propos', 'Carrières', 'Presse', 'Contact'],
  legal: ['Confidentialité', 'CGU', 'Cookies', 'RGPD'],
};
