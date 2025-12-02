import React, { useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  Menu, X, Play, Check, ChevronDown, ChevronRight, 
  ArrowRight, Star, Zap, Shield, Users, Mail,
  Twitter, Linkedin, Github, Heart
} from 'lucide-react';
import { 
  heroContent, features, steps, testimonials, 
  pricingPlans, faqs, footerLinks, navLinks 
} from '../data/landingContent';

// Animation variants
const fadeInUp = {
  hidden: { opacity: 0, y: 30 },
  visible: { opacity: 1, y: 0, transition: { duration: 0.6 } }
};

const staggerContainer = {
  hidden: { opacity: 0 },
  visible: { opacity: 1, transition: { staggerChildren: 0.1 } }
};

const LandingPage = () => {
  const navigate = useNavigate();
  const [isScrolled, setIsScrolled] = useState(false);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [activeTestimonial, setActiveTestimonial] = useState(0);
  const [billingAnnual, setBillingAnnual] = useState(true);
  const [openFaq, setOpenFaq] = useState(null);

  useEffect(() => {
    const handleScroll = () => setIsScrolled(window.scrollY > 50);
    window.addEventListener('scroll', handleScroll);
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  // Auto-rotate testimonials
  useEffect(() => {
    const interval = setInterval(() => {
      setActiveTestimonial(prev => (prev + 1) % testimonials.length);
    }, 5000);
    return () => clearInterval(interval);
  }, []);

  return (
    <div className="min-h-screen bg-white overflow-x-hidden">
      {/* Navbar */}
      <Navbar isScrolled={isScrolled} mobileMenuOpen={mobileMenuOpen} 
        setMobileMenuOpen={setMobileMenuOpen} navigate={navigate} />
      
      {/* Hero */}
      <HeroSection navigate={navigate} />
      
      {/* Trust Badges */}
      <TrustBadges />

      {/* Features */}
      <FeaturesSection />
      
      {/* Feature Highlights */}
      <FeatureHighlight1 />
      <FeatureHighlight2 />
      <FeatureHighlight3 />
      
      {/* How it works */}
      <HowItWorks />
      
      {/* Testimonials */}
      <TestimonialsSection active={activeTestimonial} setActive={setActiveTestimonial} />
      
      {/* Pricing 
      <PricingSection annual={billingAnnual} setAnnual={setBillingAnnual} navigate={navigate} />
      */}
      {/* FAQ */}
      <FAQSection openFaq={openFaq} setOpenFaq={setOpenFaq} />
      
      {/* Final CTA */}
      <FinalCTA navigate={navigate} />
      
      {/* Footer */}
      <Footer />
    </div>
  );
};

// ============ NAVBAR ============
const Navbar = ({ isScrolled, mobileMenuOpen, setMobileMenuOpen, navigate }) => (
  <motion.nav 
    initial={{ y: -100 }} animate={{ y: 0 }} transition={{ duration: 0.5 }}
    className={`fixed top-0 left-0 right-0 z-50 transition-all duration-300 ${
      isScrolled ? 'bg-white/80 backdrop-blur-lg shadow-sm' : 'bg-transparent'
    }`}>
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
      <div className="flex items-center justify-between h-16 lg:h-20">
        {/* Logo */}
        <a href="/" className="flex items-center gap-2">
          <img src="/logo-minimeet.png" alt="MiniMeet" className="h-8 lg:h-10" />
          <span className="text-xl font-bold bg-gradient-to-r from-[#4A90E2] to-[#8B7BE8] bg-clip-text text-transparent">
         
          </span>
        </a>

        {/* Desktop Nav */}
        <div className="hidden lg:flex items-center gap-8">
          {navLinks.map(link => (
            <a key={link.label} href={link.href} 
              className="text-gray-600 hover:text-[#1A1F71] font-medium transition-colors">
              {link.label}
            </a>
          ))}
        </div>

        {/* Desktop CTA */}
        <div className="hidden lg:flex items-center gap-3">
          <button onClick={() => navigate('/login')}
            className="px-4 py-2 text-[#1A1F71] font-medium hover:bg-gray-100 rounded-xl transition-colors">
            Connexion
          </button>
          <button onClick={() => navigate('/register')}
            className="px-5 py-2.5 bg-gradient-to-r from-[#4A90E2] to-[#8B7BE8] text-white font-medium rounded-xl hover:shadow-lg hover:shadow-blue-500/25 transition-all">
            Inscription
          </button>
        </div>

        {/* Mobile menu button */}
        <button onClick={() => setMobileMenuOpen(!mobileMenuOpen)} className="lg:hidden p-2">
          {mobileMenuOpen ? <X size={24} /> : <Menu size={24} />}
        </button>
      </div>
    </div>

    {/* Mobile Menu */}
    <AnimatePresence>
      {mobileMenuOpen && (
        <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: 'auto' }}
          exit={{ opacity: 0, height: 0 }} className="lg:hidden bg-white border-t">
          <div className="px-4 py-4 space-y-3">
            {navLinks.map(link => (
              <a key={link.label} href={link.href} className="block py-2 text-gray-600 font-medium">
                {link.label}
              </a>
            ))}
            <div className="pt-3 space-y-2">
              <button onClick={() => navigate('/login')} className="w-full py-2.5 border border-gray-200 rounded-xl font-medium">
                Connexion
              </button>
              <button onClick={() => navigate('/register')}
                className="w-full py-2.5 bg-gradient-to-r from-[#4A90E2] to-[#8B7BE8] text-white rounded-xl font-medium">
                Inscription
              </button>
            </div>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  </motion.nav>
);


// ============ HERO SECTION ============
const HeroSection = ({ navigate }) => (
  <section className="relative pt-24 lg:pt-32 pb-16 lg:pb-24 overflow-hidden">
    {/* Background gradient */}
    <div className="absolute inset-0 bg-gradient-to-br from-[#F0F2F5] via-white to-blue-50/50" />
    <div className="absolute top-20 right-0 w-96 h-96 bg-[#4A90E2]/10 rounded-full blur-3xl" />
    <div className="absolute bottom-0 left-0 w-80 h-80 bg-[#8B7BE8]/10 rounded-full blur-3xl" />
    
    <div className="relative max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
      <div className="grid lg:grid-cols-2 gap-12 items-center">
        {/* Text Content */}
        <motion.div initial="hidden" animate="visible" variants={staggerContainer} className="text-center lg:text-left">
          <motion.div variants={fadeInUp} className="inline-flex items-center gap-2 px-4 py-2 bg-blue-50 rounded-full mb-6">
            <Zap size={16} className="text-[#4A90E2]" />
            <span className="text-sm font-medium text-[#1A1F71]">Nouveau : Résumés IA automatiques</span>
          </motion.div>
          
          <motion.h1 variants={fadeInUp} className="text-4xl sm:text-5xl lg:text-6xl font-bold text-[#1A1F71] leading-tight">
            {heroContent.title}
            <span className="bg-gradient-to-r from-[#4A90E2] to-[#8B7BE8] bg-clip-text text-transparent block">
              {heroContent.titleHighlight}
            </span>
          </motion.h1>
          
          <motion.p variants={fadeInUp} className="mt-6 text-lg text-gray-600 max-w-xl mx-auto lg:mx-0">
            {heroContent.subtitle}
          </motion.p>
          
          <motion.div variants={fadeInUp} className="mt-8 flex flex-col sm:flex-row gap-4 justify-center lg:justify-start">
            <button onClick={() => navigate('/register')}
              className="px-8 py-4 bg-gradient-to-r from-[#4A90E2] to-[#8B7BE8] text-white font-semibold rounded-2xl hover:shadow-xl hover:shadow-blue-500/25 transition-all flex items-center justify-center gap-2">
              Démarrer gratuitement <ArrowRight size={20} />
            </button>
          </motion.div>
          
          <motion.div variants={fadeInUp} className="mt-8 flex flex-wrap gap-4 justify-center lg:justify-start">
            {heroContent.badges.map((badge, i) => (
              <div key={i} className="flex items-center gap-2 text-sm text-gray-600">
                <Check size={16} className="text-green-500" /> {badge}
              </div>
            ))}
          </motion.div>
        </motion.div>
        
        {/* Hero Visual */}
        <motion.div initial={{ opacity: 0, scale: 0.9 }} animate={{ opacity: 1, scale: 1 }}
          transition={{ duration: 0.8, delay: 0.3 }} className="relative">
          <div className="relative bg-gradient-to-br from-[#4A90E2] to-[#8B7BE8] rounded-3xl p-1">
            <div className="bg-white rounded-[22px] p-4 lg:p-6">
              {/* Mock interface */}
              <div className="bg-gray-900 rounded-2xl overflow-hidden aspect-video">
                <div className="p-3 flex items-center gap-2 border-b border-gray-800">
                  <div className="flex gap-1.5">
                    <div className="w-3 h-3 rounded-full bg-red-500" />
                    <div className="w-3 h-3 rounded-full bg-yellow-500" />
                    <div className="w-3 h-3 rounded-full bg-green-500" />
                  </div>
                  <div className="flex-1 text-center text-xs text-gray-400">MiniMeet - Réunion d'équipe</div>
                </div>
                <div className="p-4 grid grid-cols-2 gap-3">
                  {[1,2,3,4].map(i => (
                    <div key={i} className="aspect-video bg-gradient-to-br from-gray-800 to-gray-700 rounded-xl flex items-center justify-center">
                      <div className="w-12 h-12 rounded-full bg-gradient-to-br from-[#4A90E2] to-[#8B7BE8] flex items-center justify-center text-white font-bold">
                        {['M', 'T', 'S', 'A'][i-1]}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>
          {/* Floating elements */}
          <motion.div animate={{ y: [0, -10, 0] }} transition={{ duration: 3, repeat: Infinity }}
            className="absolute -top-4 -right-4 bg-white rounded-2xl shadow-xl p-3 flex items-center gap-2">
            <div className="w-8 h-8 bg-green-100 rounded-full flex items-center justify-center">
              <Check size={16} className="text-green-600" />
            </div>
            <span className="text-sm font-medium text-gray-700">Connecté</span>
          </motion.div>
          <motion.div animate={{ y: [0, 10, 0] }} transition={{ duration: 4, repeat: Infinity }}
            className="absolute -bottom-4 -left-4 bg-white rounded-2xl shadow-xl p-3">
            <div className="flex items-center gap-2">
              <Users size={16} className="text-[#4A90E2]" />
              <span className="text-sm font-medium">+ 4 participants</span>
            </div>
          </motion.div>
        </motion.div>
      </div>
    </div>
  </section>
);


// ============ TRUST BADGES ============
const TrustBadges = () => {
  const logos = ['TechCorp', 'InnoLab', 'StartupX', 'DigitalCo', 'CloudNet', 'DataFlow'];
  return (
    <section className="py-12 bg-[#F0F2F5]/50 overflow-hidden">
      <div className="max-w-7xl mx-auto px-4">
        <p className="text-center text-sm text-gray-500 mb-8">Ils nous font confiance</p>
        <div className="relative">
          <div className="flex animate-scroll gap-12">
            {[...logos, ...logos].map((logo, i) => (
              <div key={i} className="flex-shrink-0 px-8 py-4 bg-white rounded-xl shadow-sm">
                <span className="text-xl font-bold text-gray-300">{logo}</span>
              </div>
            ))}
          </div>
        </div>
      </div>
      <style>{`
        @keyframes scroll { 0% { transform: translateX(0); } 100% { transform: translateX(-50%); } }
        .animate-scroll { animation: scroll 20s linear infinite; width: max-content; }
      `}</style>
    </section>
  );
};

// ============ FEATURES SECTION ============
const FeaturesSection = () => (
  <section id="features" className="py-20 lg:py-28">
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
      <motion.div initial="hidden" whileInView="visible" viewport={{ once: true }} variants={fadeInUp} className="text-center mb-16">
        <h2 className="text-3xl lg:text-4xl font-bold text-[#1A1F71]">
          Tout ce dont vous avez besoin,
          <span className="bg-gradient-to-r from-[#4A90E2] to-[#8B7BE8] bg-clip-text text-transparent"> rien de superflu</span>
        </h2>
        <p className="mt-4 text-lg text-gray-600 max-w-2xl mx-auto">
          Des outils puissants et intuitifs pour des réunions productives
        </p>
      </motion.div>
      
      <motion.div initial="hidden" whileInView="visible" viewport={{ once: true }} variants={staggerContainer}
        className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4 lg:gap-6">
        {features.map((feature, i) => (
          <motion.div key={i} variants={fadeInUp}
            className="group p-5 lg:p-6 bg-white rounded-2xl border border-gray-100 hover:border-[#4A90E2]/30 hover:shadow-xl hover:shadow-blue-500/5 transition-all duration-300">
            <div className="w-12 h-12 lg:w-14 lg:h-14 bg-gradient-to-br from-blue-50 to-purple-50 rounded-xl flex items-center justify-center mb-4 group-hover:scale-110 transition-transform">
              <img src={feature.icon} alt={feature.title} className="w-7 h-7 lg:w-8 lg:h-8" />
            </div>
            <h3 className="font-semibold text-[#1A1F71] mb-1">{feature.title}</h3>
            <p className="text-sm text-gray-500">{feature.description}</p>
          </motion.div>
        ))}
      </motion.div>
    </div>
  </section>
);

// ============ FEATURE HIGHLIGHT 1 - AI ============
const FeatureHighlight1 = () => (
  <section className="py-20 bg-gradient-to-br from-[#1A1F71] to-[#4A90E2] text-white overflow-hidden">
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
      <div className="grid lg:grid-cols-2 gap-12 items-center">
        <motion.div initial="hidden" whileInView="visible" viewport={{ once: true }} variants={staggerContainer}>
          <motion.div variants={fadeInUp} className="inline-flex items-center gap-2 px-3 py-1.5 bg-white/10 rounded-full mb-4">
            <Zap size={14} /> <span className="text-sm">Propulsé par l'IA</span>
          </motion.div>
          <motion.h2 variants={fadeInUp} className="text-3xl lg:text-4xl font-bold mb-4">
            L'IA qui résume vos réunions
          </motion.h2>
          <motion.p variants={fadeInUp} className="text-lg text-blue-100 mb-6">
            Ne perdez plus de temps à prendre des notes. Notre IA transcrit et résume automatiquement vos réunions, identifie les points clés et les actions à suivre.
          </motion.p>
          <motion.ul variants={fadeInUp} className="space-y-3">
            {['Transcription automatique', 'Résumé intelligent', 'Actions identifiées', 'Export PDF'].map((item, i) => (
              <li key={i} className="flex items-center gap-3">
                <Check size={18} className="text-green-400" /> {item}
              </li>
            ))}
          </motion.ul>
        </motion.div>
        <motion.div initial={{ opacity: 0, x: 50 }} whileInView={{ opacity: 1, x: 0 }} viewport={{ once: true }}
          className="relative">
          <div className="bg-white/10 backdrop-blur-sm rounded-2xl p-6">
            <div className="bg-white rounded-xl p-4 text-gray-800">
              <div className="flex items-center gap-2 mb-3">
                <div className="w-8 h-8 bg-gradient-to-br from-[#4A90E2] to-[#8B7BE8] rounded-lg flex items-center justify-center">
                  <img src="/ai_summuraize.png" alt="AI" className="w-5 h-5" />
                </div>
                <span className="font-semibold">Résumé IA</span>
              </div>
              <div className="space-y-2 text-sm">
                <p className="font-medium">📋 Points clés :</p>
                <p className="text-gray-600 pl-4">• Validation du nouveau design</p>
                <p className="text-gray-600 pl-4">• Budget Q2 approuvé</p>
                <p className="font-medium mt-3">✅ Actions :</p>
                <p className="text-gray-600 pl-4">• Marie : Finaliser maquettes</p>
                <p className="text-gray-600 pl-4">• Thomas : Planifier sprint</p>
              </div>
            </div>
          </div>
        </motion.div>
      </div>
    </div>
  </section>
);


// ============ FEATURE HIGHLIGHT 2 - COLLABORATION ============
const FeatureHighlight2 = () => (
  <section className="py-20 bg-[#F0F2F5]/50">
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
      <div className="grid lg:grid-cols-2 gap-12 items-center">
        <motion.div initial={{ opacity: 0, x: -50 }} whileInView={{ opacity: 1, x: 0 }} viewport={{ once: true }}
          className="order-2 lg:order-1">
          <div className="bg-white rounded-2xl shadow-xl p-6">
            <div className="flex gap-4">
              {/* Whiteboard mock */}
              <div className="flex-1 bg-gray-50 rounded-xl p-4 border-2 border-dashed border-gray-200">
                <div className="text-xs text-gray-400 mb-2">Tableau blanc</div>
                <svg className="w-full h-32" viewBox="0 0 200 100">
                  <motion.path d="M20,50 Q50,20 80,50 T140,50" stroke="#4A90E2" strokeWidth="3" fill="none"
                    initial={{ pathLength: 0 }} whileInView={{ pathLength: 1 }} transition={{ duration: 2 }} />
                  <motion.circle cx="160" cy="40" r="15" fill="#8B7BE8" fillOpacity="0.3"
                    initial={{ scale: 0 }} whileInView={{ scale: 1 }} transition={{ delay: 1 }} />
                  <motion.rect x="30" y="60" width="40" height="25" fill="#4A90E2" fillOpacity="0.2" rx="4"
                    initial={{ scale: 0 }} whileInView={{ scale: 1 }} transition={{ delay: 0.5 }} />
                </svg>
              </div>
              {/* Todo mock */}
              <div className="w-40 bg-gray-50 rounded-xl p-3">
                <div className="text-xs text-gray-400 mb-2">Tâches</div>
                {['Design review', 'Update docs', 'Test deploy'].map((task, i) => (
                  <motion.div key={i} initial={{ opacity: 0, x: 20 }} whileInView={{ opacity: 1, x: 0 }}
                    transition={{ delay: i * 0.2 }} className="flex items-center gap-2 py-1.5 text-xs">
                    <div className={`w-4 h-4 rounded border-2 ${i === 0 ? 'bg-green-500 border-green-500' : 'border-gray-300'} flex items-center justify-center`}>
                      {i === 0 && <Check size={10} className="text-white" />}
                    </div>
                    <span className={i === 0 ? 'line-through text-gray-400' : 'text-gray-700'}>{task}</span>
                  </motion.div>
                ))}
              </div>
            </div>
          </div>
        </motion.div>
        <motion.div initial="hidden" whileInView="visible" viewport={{ once: true }} variants={staggerContainer}
          className="order-1 lg:order-2">
          <motion.h2 variants={fadeInUp} className="text-3xl lg:text-4xl font-bold text-[#1A1F71] mb-4">
            Collaborez en temps réel
          </motion.h2>
          <motion.p variants={fadeInUp} className="text-lg text-gray-600 mb-6">
            Tableau blanc interactif et liste de tâches partagée. Brainstormez, dessinez et organisez vos idées ensemble, comme si vous étiez dans la même pièce.
          </motion.p>
          <motion.ul variants={fadeInUp} className="space-y-3">
            {['Dessin collaboratif', 'Tâches synchronisées', 'Curseurs en temps réel', 'Export des contenus'].map((item, i) => (
              <li key={i} className="flex items-center gap-3 text-gray-700">
                <div className="w-6 h-6 bg-green-100 rounded-full flex items-center justify-center">
                  <Check size={14} className="text-green-600" />
                </div>
                {item}
              </li>
            ))}
          </motion.ul>
        </motion.div>
      </div>
    </div>
  </section>
);

// ============ FEATURE HIGHLIGHT 3 - LIVE ============
const FeatureHighlight3 = () => (
  <section className="py-20">
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
      <div className="grid lg:grid-cols-2 gap-12 items-center">
        <motion.div initial="hidden" whileInView="visible" viewport={{ once: true }} variants={staggerContainer}>
          <motion.div variants={fadeInUp} className="inline-flex items-center gap-2 px-3 py-1.5 bg-red-50 rounded-full mb-4">
            <div className="w-2 h-2 bg-red-500 rounded-full animate-pulse" />
            <span className="text-sm text-red-600 font-medium">Live Streaming</span>
          </motion.div>
          <motion.h2 variants={fadeInUp} className="text-3xl lg:text-4xl font-bold text-[#1A1F71] mb-4">
            Passez en Live avec vos invités
          </motion.h2>
          <motion.p variants={fadeInUp} className="text-lg text-gray-600 mb-6">
            Diffusez en direct avec plusieurs co-hôtes. Parfait pour les webinaires, formations et événements d'équipe. Interagissez avec votre audience via le chat et les réactions.
          </motion.p>
          <motion.div variants={fadeInUp} className="flex flex-wrap gap-3">
            {['Multi-hôtes', 'Chat live', 'Réactions', 'Modération'].map((tag, i) => (
              <span key={i} className="px-4 py-2 bg-gray-100 rounded-full text-sm font-medium text-gray-700">{tag}</span>
            ))}
          </motion.div>
        </motion.div>
        <motion.div initial={{ opacity: 0, scale: 0.9 }} whileInView={{ opacity: 1, scale: 1 }} viewport={{ once: true }}
          className="relative">
          <div className="bg-gray-900 rounded-2xl p-4">
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center gap-2">
                <div className="w-2 h-2 bg-red-500 rounded-full animate-pulse" />
                <span className="text-white text-sm font-medium">LIVE</span>
              </div>
              <div className="flex items-center gap-1 text-white/60 text-sm">
                <Users size={14} /> 234
              </div>
            </div>
            <div className="grid grid-cols-3 gap-2">
              {['H', 'I1', 'I2'].map((label, i) => (
                <motion.div key={i} initial={{ scale: 0 }} whileInView={{ scale: 1 }} transition={{ delay: i * 0.1 }}
                  className="aspect-video bg-gradient-to-br from-gray-800 to-gray-700 rounded-lg flex items-center justify-center relative">
                  <div className={`w-10 h-10 rounded-full flex items-center justify-center text-white font-bold ${
                    i === 0 ? 'bg-gradient-to-br from-[#4A90E2] to-[#8B7BE8]' : 'bg-gray-600'
                  }`}>
                    {label}
                  </div>
                  {i === 0 && <span className="absolute bottom-1 left-1 text-[10px] bg-red-500 text-white px-1.5 rounded">Hôte</span>}
                </motion.div>
              ))}
            </div>
            {/* Reactions */}
            <div className="mt-3 flex justify-center gap-2">
              {['❤️', '🔥', '👏', '✨'].map((emoji, i) => (
                <motion.span key={i} animate={{ y: [0, -5, 0] }} transition={{ duration: 1, delay: i * 0.2, repeat: Infinity }}
                  className="text-xl">{emoji}</motion.span>
              ))}
            </div>
          </div>
        </motion.div>
      </div>
    </div>
  </section>
);


// ============ HOW IT WORKS ============
const HowItWorks = () => (
  <section id="about" className="py-20 bg-gradient-to-br from-[#F0F2F5] to-white">
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
      <motion.div initial="hidden" whileInView="visible" viewport={{ once: true }} variants={fadeInUp} className="text-center mb-16">
        <h2 className="text-3xl lg:text-4xl font-bold text-[#1A1F71]">Comment ça marche ?</h2>
        <p className="mt-4 text-lg text-gray-600">Trois étapes pour des réunions réussies</p>
      </motion.div>
      
      <div className="grid md:grid-cols-3 gap-8">
        {steps.map((step, i) => (
          <motion.div key={i} initial={{ opacity: 0, y: 30 }} whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }} transition={{ delay: i * 0.2 }} className="relative">
            {i < steps.length - 1 && (
              <div className="hidden md:block absolute top-12 left-1/2 w-full h-0.5 bg-gradient-to-r from-[#4A90E2] to-[#8B7BE8]" />
            )}
            <div className="relative bg-white rounded-2xl p-6 shadow-lg hover:shadow-xl transition-shadow">
              <div className="w-16 h-16 bg-gradient-to-br from-[#4A90E2] to-[#8B7BE8] rounded-2xl flex items-center justify-center text-white text-2xl font-bold mb-4">
                {step.number}
              </div>
              <h3 className="text-xl font-bold text-[#1A1F71] mb-2">{step.title}</h3>
              <p className="text-gray-600">{step.description}</p>
            </div>
          </motion.div>
        ))}
      </div>
    </div>
  </section>
);

// ============ TESTIMONIALS ============
const TestimonialsSection = ({ active, setActive }) => (
  <section className="py-20">
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
      <motion.div initial="hidden" whileInView="visible" viewport={{ once: true }} variants={fadeInUp} className="text-center mb-12">
        <h2 className="text-3xl lg:text-4xl font-bold text-[#1A1F71]">Ce que disent nos utilisateurs</h2>
      </motion.div>
      
      <div className="max-w-3xl mx-auto">
        <AnimatePresence mode="wait">
          <motion.div key={active} initial={{ opacity: 0, x: 50 }} animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: -50 }} className="bg-white rounded-3xl shadow-xl p-8 lg:p-10">
            <div className="flex gap-1 mb-4">
              {[...Array(5)].map((_, i) => <Star key={i} size={20} className="fill-yellow-400 text-yellow-400" />)}
            </div>
            <p className="text-xl lg:text-2xl text-gray-700 mb-6 italic">"{testimonials[active].quote}"</p>
            <div className="flex items-center gap-4">
              <div className="w-14 h-14 bg-gradient-to-br from-[#4A90E2] to-[#8B7BE8] rounded-full flex items-center justify-center text-white text-xl font-bold">
                {testimonials[active].avatar}
              </div>
              <div>
                <p className="font-semibold text-[#1A1F71]">{testimonials[active].name}</p>
                <p className="text-gray-500">{testimonials[active].role}, {testimonials[active].company}</p>
              </div>
            </div>
          </motion.div>
        </AnimatePresence>
        
        <div className="flex justify-center gap-2 mt-6">
          {testimonials.map((_, i) => (
            <button key={i} onClick={() => setActive(i)}
              className={`w-3 h-3 rounded-full transition-all ${active === i ? 'bg-[#4A90E2] w-8' : 'bg-gray-300'}`} />
          ))}
        </div>
      </div>
    </div>
  </section>
);

// ============ PRICING ============
const PricingSection = ({ annual, setAnnual, navigate }) => (
  <section id="pricing" className="py-20 bg-[#F0F2F5]/50">
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
      <motion.div initial="hidden" whileInView="visible" viewport={{ once: true }} variants={fadeInUp} className="text-center mb-12">
        <h2 className="text-3xl lg:text-4xl font-bold text-[#1A1F71]">Tarifs simples et transparents</h2>
        <p className="mt-4 text-lg text-gray-600">Choisissez le plan adapté à vos besoins</p>
        
        <div className="flex items-center justify-center gap-4 mt-8">
          <span className={annual ? 'text-gray-400' : 'text-[#1A1F71] font-medium'}>Mensuel</span>
          <button onClick={() => setAnnual(!annual)}
            className={`w-14 h-8 rounded-full p-1 transition-colors ${annual ? 'bg-[#4A90E2]' : 'bg-gray-300'}`}>
            <div className={`w-6 h-6 bg-white rounded-full transition-transform ${annual ? 'translate-x-6' : ''}`} />
          </button>
          <span className={annual ? 'text-[#1A1F71] font-medium' : 'text-gray-400'}>
            Annuel <span className="text-green-500 text-sm">-20%</span>
          </span>
        </div>
      </motion.div>
      
      <div className="grid md:grid-cols-3 gap-6 lg:gap-8">
        {pricingPlans.map((plan, i) => (
          <motion.div key={i} initial={{ opacity: 0, y: 30 }} whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }} transition={{ delay: i * 0.1 }}
            className={`relative bg-white rounded-3xl p-6 lg:p-8 ${
              plan.popular ? 'ring-2 ring-[#4A90E2] shadow-xl scale-105' : 'border border-gray-200'
            }`}>
            {plan.popular && (
              <div className="absolute -top-4 left-1/2 -translate-x-1/2 px-4 py-1 bg-gradient-to-r from-[#4A90E2] to-[#8B7BE8] text-white text-sm font-medium rounded-full">
                Populaire
              </div>
            )}
            <h3 className="text-xl font-bold text-[#1A1F71]">{plan.name}</h3>
            <p className="text-gray-500 text-sm mb-4">{plan.description}</p>
            <div className="mb-6">
              <span className="text-4xl font-bold text-[#1A1F71]">
                {plan.price === 'Sur mesure' ? '' : (annual && plan.price !== '0€' ? 
                  `${Math.round(parseInt(plan.price) * 0.8)}€` : plan.price)}
              </span>
              {plan.price === 'Sur mesure' ? (
                <span className="text-2xl font-bold text-[#1A1F71]">Sur mesure</span>
              ) : (
                <span className="text-gray-500">{plan.period}</span>
              )}
            </div>
            <ul className="space-y-3 mb-8">
              {plan.features.map((feature, j) => (
                <li key={j} className="flex items-center gap-2 text-gray-600">
                  <Check size={18} className="text-green-500 flex-shrink-0" /> {feature}
                </li>
              ))}
            </ul>
            <button onClick={() => navigate('/register')}
              className={`w-full py-3 rounded-xl font-semibold transition-all ${
                plan.popular 
                  ? 'bg-gradient-to-r from-[#4A90E2] to-[#8B7BE8] text-white hover:shadow-lg' 
                  : 'border-2 border-gray-200 text-[#1A1F71] hover:border-[#4A90E2]'
              }`}>
              {plan.cta}
            </button>
          </motion.div>
        ))}
      </div>
    </div>
  </section>
);


// ============ FAQ ============
const FAQSection = ({ openFaq, setOpenFaq }) => (
  <section className="py-20">
    <div className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8">
      <motion.div initial="hidden" whileInView="visible" viewport={{ once: true }} variants={fadeInUp} className="text-center mb-12">
        <h2 className="text-3xl lg:text-4xl font-bold text-[#1A1F71]">Questions fréquentes</h2>
      </motion.div>
      
      <div className="space-y-4">
        {faqs.map((faq, i) => (
          <motion.div key={i} initial={{ opacity: 0, y: 20 }} whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }} transition={{ delay: i * 0.05 }}
            className="bg-white rounded-2xl border border-gray-200 overflow-hidden">
            <button onClick={() => setOpenFaq(openFaq === i ? null : i)}
              className="w-full px-6 py-4 flex items-center justify-between text-left">
              <span className="font-semibold text-[#1A1F71]">{faq.q}</span>
              <ChevronDown size={20} className={`text-gray-400 transition-transform ${openFaq === i ? 'rotate-180' : ''}`} />
            </button>
            <AnimatePresence>
              {openFaq === i && (
                <motion.div initial={{ height: 0 }} animate={{ height: 'auto' }} exit={{ height: 0 }}
                  className="overflow-hidden">
                  <p className="px-6 pb-4 text-gray-600">{faq.a}</p>
                </motion.div>
              )}
            </AnimatePresence>
          </motion.div>
        ))}
      </div>
    </div>
  </section>
);

// ============ FINAL CTA ============
const FinalCTA = ({ navigate }) => (
  <section className="py-20 relative overflow-hidden">
    <div className="absolute inset-0 bg-gradient-to-br from-[#4A90E2] to-[#8B7BE8]" />
    <div className="absolute inset-0 opacity-30">
      <div className="absolute top-10 left-10 w-32 h-32 bg-white/20 rounded-full blur-2xl" />
      <div className="absolute bottom-10 right-10 w-48 h-48 bg-white/20 rounded-full blur-3xl" />
      <div className="absolute top-1/2 left-1/2 w-64 h-64 bg-white/10 rounded-full blur-3xl" />
    </div>
    
    <div className="relative max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
      <motion.div initial="hidden" whileInView="visible" viewport={{ once: true }} variants={staggerContainer}>
        <motion.h2 variants={fadeInUp} className="text-3xl lg:text-5xl font-bold text-white mb-4">
          Prêt à transformer vos réunions ?
        </motion.h2>
        <motion.p variants={fadeInUp} className="text-xl text-white/80 mb-8">
          Rejoignez des milliers de professionnels qui ont déjà adopté MiniMeet
        </motion.p>
        <motion.div variants={fadeInUp} className="flex flex-col sm:flex-row gap-4 justify-center max-w-md mx-auto">
          <input type="email" placeholder="Votre email professionnel"
            className="flex-1 px-5 py-4 rounded-xl bg-white/10 backdrop-blur-sm border border-white/20 text-white placeholder-white/60 focus:outline-none focus:ring-2 focus:ring-white/50" />
          <button onClick={() => navigate('/register')}
            className="px-8 py-4 bg-white text-[#4A90E2] font-semibold rounded-xl hover:shadow-xl transition-all flex items-center justify-center gap-2">
            Commencer <ArrowRight size={20} />
          </button>
        </motion.div>
        <motion.p variants={fadeInUp} className="mt-4 text-sm text-white/60">
          Gratuit pour toujours • Pas de carte requise
        </motion.p>
      </motion.div>
    </div>
  </section>
);

// ============ FOOTER ============
const Footer = () => (
  <footer className="bg-[#1A1F71] text-white py-16">
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
      <div className="grid grid-cols-2 md:grid-cols-5 gap-8 mb-12">
        {/* Brand */}
        <div className="col-span-2 md:col-span-1">
          <div className="flex items-center gap-2 mb-4">
            <img src="/logo-minimeet.png" alt="MiniMeet" className="h-8 brightness-0 invert" />
          
          </div>
          <p className="text-white/60 text-sm mb-4">La visioconférence simple et efficace.</p>
          <div className="flex gap-3">
            {[Twitter, Linkedin, Github].map((Icon, i) => (
              <a key={i} href="#" className="w-10 h-10 bg-white/10 rounded-lg flex items-center justify-center hover:bg-white/20 transition-colors">
                <Icon size={18} />
              </a>
            ))}
          </div>
        </div>
        
        {/* Links */}
        {Object.entries(footerLinks).map(([title, links]) => (
          <div key={title}>
            <h4 className="font-semibold mb-4 capitalize">{title === 'legal' ? 'Légal' : title === 'company' ? 'Entreprise' : title}</h4>
            <ul className="space-y-2">
              {links.map((link, i) => (
                <li key={i}><a href="#" className="text-white/60 hover:text-white text-sm transition-colors">{link}</a></li>
              ))}
            </ul>
          </div>
        ))}
      </div>
      
      <div className="pt-8 border-t border-white/10 flex flex-col md:flex-row items-center justify-between gap-4">
        <p className="text-white/60 text-sm">© 2024 MiniMeet. Tous droits réservés.</p>
        <p className="text-white/60 text-sm flex items-center gap-1">
          Made with <Heart size={14} className="text-red-400 fill-red-400" /> in Bénin
        </p>
      </div>
    </div>
  </footer>
);

export default LandingPage;
