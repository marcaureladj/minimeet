import React from 'react';
import { Link } from 'react-router-dom';
import { Video, MessageCircle, Monitor, Shield, Users, Zap, ArrowRight, CheckCircle } from 'lucide-react';

const NewLandingPage = () => {
  const features = [
    { icon: Video, title: 'Appels HD', description: 'Vidéo et audio de haute qualité pour des réunions fluides' },
    { icon: MessageCircle, title: 'Chat intégré', description: 'Communiquez par messages pendant vos appels' },
    { icon: Monitor, title: 'Partage d\'écran', description: 'Partagez votre écran en un clic' },
    { icon: Shield, title: 'Sécurisé', description: 'Connexions chiffrées de bout en bout' },
    { icon: Users, title: 'Collaboratif', description: 'Liste de tâches partagée en temps réel' },
    { icon: Zap, title: 'Rapide', description: 'Créez une réunion en quelques secondes' },
  ];

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-50 to-gray-100">
      {/* Navigation */}
      <nav className="fixed top-0 left-0 right-0 z-50 bg-white/80 backdrop-blur-md border-b border-gray-100">
        <div className="max-w-7xl mx-auto px-6 py-4">
          <div className="flex items-center justify-between">
            <Link to="/" className="flex items-center space-x-3">
              <div className="w-10 h-10 bg-blue-600 rounded-xl flex items-center justify-center">
                <Video size={20} className="text-white" />
              </div>
              <span className="text-xl font-bold text-gray-900">MiniMeet</span>
            </Link>
            <div className="hidden md:flex items-center space-x-8">
              <a href="#features" className="text-gray-600 hover:text-gray-900 transition-colors">Fonctionnalités</a>
              <a href="#about" className="text-gray-600 hover:text-gray-900 transition-colors">À propos</a>
              <a href="#contact" className="text-gray-600 hover:text-gray-900 transition-colors">Contact</a>
            </div>
            <div className="flex items-center space-x-3">
              <Link to="/login" className="px-4 py-2 text-gray-700 hover:text-gray-900 font-medium transition-colors">
                Connexion
              </Link>
              <Link to="/register" className="px-5 py-2.5 bg-blue-600 text-white rounded-xl font-semibold hover:bg-blue-700 transition-all shadow-lg shadow-blue-600/20">
                Commencer
              </Link>
            </div>
          </div>
        </div>
      </nav>

      {/* Hero Section */}
      <section className="pt-32 pb-20 px-6">
        <div className="max-w-7xl mx-auto">
          <div className="grid lg:grid-cols-2 gap-12 items-center">
            <div className="space-y-8">
              <div className="inline-flex items-center space-x-2 bg-blue-50 text-blue-600 px-4 py-2 rounded-full text-sm font-medium">
                <Zap size={16} />
                <span>Simple, rapide, efficace</span>
              </div>
              <h1 className="text-5xl lg:text-6xl font-bold text-gray-900 leading-tight">
                Vos réunions en ligne,{' '}
                <span className="text-transparent bg-clip-text bg-gradient-to-r from-blue-600 to-purple-600">
                  simplifiées
                </span>
              </h1>
              <p className="text-xl text-gray-600 max-w-lg">
                Connectez-vous, partagez et collaborez en temps réel. La visioconférence n'a jamais été aussi simple.
              </p>
              <div className="flex flex-col sm:flex-row gap-4">
                <Link
                  to="/register"
                  className="px-8 py-4 bg-blue-600 text-white rounded-2xl font-semibold hover:bg-blue-700 transition-all shadow-xl shadow-blue-600/30 flex items-center justify-center space-x-2 group"
                >
                  <span>Créer un compte gratuit</span>
                  <ArrowRight size={20} className="group-hover:translate-x-1 transition-transform" />
                </Link>
                <Link
                  to="/login"
                  className="px-8 py-4 bg-white text-gray-900 rounded-2xl font-semibold hover:bg-gray-50 transition-all border border-gray-200 flex items-center justify-center"
                >
                  Se connecter
                </Link>
              </div>
            </div>

            {/* Hero Visual */}
            <div className="relative">
              <div className="bg-gradient-to-br from-blue-600 to-purple-600 rounded-3xl p-8 shadow-2xl">
                <div className="bg-gray-900 rounded-2xl p-4 space-y-4">
                  {/* Mock Video Grid */}
                  <div className="grid grid-cols-2 gap-3">
                    {['bg-gradient-to-br from-pink-400 to-rose-500', 'bg-gradient-to-br from-cyan-400 to-blue-500', 'bg-gradient-to-br from-green-400 to-emerald-500', 'bg-gradient-to-br from-purple-400 to-indigo-500'].map((gradient, i) => (
                      <div key={i} className={`${gradient} rounded-xl aspect-video flex items-center justify-center`}>
                        <div className="w-12 h-12 bg-white/20 rounded-full flex items-center justify-center text-white text-xl font-bold">
                          {String.fromCharCode(65 + i)}
                        </div>
                      </div>
                    ))}
                  </div>
                  {/* Mock Controls */}
                  <div className="flex justify-center space-x-3 pt-2">
                    <div className="w-10 h-10 bg-gray-700 rounded-full"></div>
                    <div className="w-10 h-10 bg-blue-600 rounded-full"></div>
                    <div className="w-10 h-10 bg-gray-700 rounded-full"></div>
                    <div className="w-10 h-10 bg-red-500 rounded-full"></div>
                  </div>
                </div>
              </div>
              {/* Floating Elements */}
              <div className="absolute -top-4 -right-4 bg-white rounded-2xl shadow-xl p-4 flex items-center space-x-3">
                <div className="w-10 h-10 bg-green-100 rounded-full flex items-center justify-center">
                  <CheckCircle size={20} className="text-green-600" />
                </div>
                <div>
                  <p className="font-semibold text-gray-900">HD Quality</p>
                  <p className="text-sm text-gray-500">1080p Video</p>
                </div>
              </div>
              <div className="absolute -bottom-4 -left-4 bg-white rounded-2xl shadow-xl p-4">
                <div className="flex -space-x-2">
                  {['bg-blue-400', 'bg-pink-400', 'bg-purple-400'].map((color, i) => (
                    <div key={i} className={`w-8 h-8 ${color} rounded-full border-2 border-white`}></div>
                  ))}
                </div>
                <p className="text-sm text-gray-600 mt-2">+1000 utilisateurs</p>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Features Section */}
      <section id="features" className="py-20 px-6 bg-white">
        <div className="max-w-7xl mx-auto">
          <div className="text-center mb-16">
            <h2 className="text-4xl font-bold text-gray-900 mb-4">Tout ce dont vous avez besoin</h2>
            <p className="text-xl text-gray-600 max-w-2xl mx-auto">
              Des fonctionnalités puissantes pour des réunions productives
            </p>
          </div>
          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-8">
            {features.map((feature, index) => {
              const Icon = feature.icon;
              return (
                <div key={index} className="group bg-gray-50 hover:bg-white rounded-3xl p-8 transition-all duration-300 hover:shadow-xl border border-transparent hover:border-gray-100">
                  <div className="w-14 h-14 bg-blue-100 group-hover:bg-blue-600 rounded-2xl flex items-center justify-center mb-6 transition-colors">
                    <Icon size={24} className="text-blue-600 group-hover:text-white transition-colors" />
                  </div>
                  <h3 className="text-xl font-bold text-gray-900 mb-3">{feature.title}</h3>
                  <p className="text-gray-600">{feature.description}</p>
                </div>
              );
            })}
          </div>
        </div>
      </section>

      {/* About Section */}
      <section id="about" className="py-20 px-6">
        <div className="max-w-4xl mx-auto">
          <div className="bg-gradient-to-br from-blue-600 to-purple-600 rounded-3xl p-12 text-center text-white">
            <h2 className="text-4xl font-bold mb-6">À propos de MiniMeet</h2>
            <p className="text-xl text-blue-100 mb-8 max-w-2xl mx-auto">
              MiniMeet est une solution de visioconférence open-source, simple et respectueuse de votre vie privée. 
              Nous croyons que la communication devrait être accessible à tous.
            </p>
            <div className="flex flex-wrap justify-center gap-8">
              <div className="text-center">
                <p className="text-4xl font-bold">100%</p>
                <p className="text-blue-200">Gratuit</p>
              </div>
              <div className="text-center">
                <p className="text-4xl font-bold">P2P</p>
                <p className="text-blue-200">Connexion directe</p>
              </div>
              <div className="text-center">
                <p className="text-4xl font-bold">∞</p>
                <p className="text-blue-200">Réunions illimitées</p>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Contact Section */}
      <section id="contact" className="py-20 px-6 bg-white">
        <div className="max-w-4xl mx-auto text-center">
          <h2 className="text-4xl font-bold text-gray-900 mb-6">Contactez-nous</h2>
          <p className="text-xl text-gray-600 mb-8">
            Une question ? N'hésitez pas à nous contacter.
          </p>
          <div className="flex flex-col sm:flex-row justify-center gap-6">
            <a
              href="mailto:marcaureladj@gmail.com"
              className="px-8 py-4 bg-gray-900 text-white rounded-2xl font-semibold hover:bg-gray-800 transition-all flex items-center justify-center space-x-2"
            >
              <span>marcaureladj@gmail.com</span>
            </a>
            <a
              href="tel:+2290195413447"
              className="px-8 py-4 bg-gray-100 text-gray-900 rounded-2xl font-semibold hover:bg-gray-200 transition-all"
            >
              +229 01 95 41 34
            </a>
          </div>
        </div>
      </section>

      {/* CTA Section */}
      <section className="py-20 px-6">
        <div className="max-w-4xl mx-auto">
          <div className="bg-gray-900 rounded-3xl p-12 text-center">
            <h2 className="text-4xl font-bold text-white mb-4">Prêt à commencer ?</h2>
            <p className="text-xl text-gray-400 mb-8">
              Créez votre première réunion en quelques secondes
            </p>
            <Link
              to="/register"
              className="inline-flex items-center space-x-2 px-8 py-4 bg-blue-600 text-white rounded-2xl font-semibold hover:bg-blue-700 transition-all shadow-xl shadow-blue-600/30 group"
            >
              <span>Commencer gratuitement</span>
              <ArrowRight size={20} className="group-hover:translate-x-1 transition-transform" />
            </Link>
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="py-8 px-6 border-t border-gray-200">
        <div className="max-w-7xl mx-auto flex flex-col md:flex-row justify-between items-center">
          <div className="flex items-center space-x-3 mb-4 md:mb-0">
            <div className="w-8 h-8 bg-blue-600 rounded-lg flex items-center justify-center">
              <Video size={16} className="text-white" />
            </div>
            <span className="font-bold text-gray-900">MiniMeet</span>
          </div>
          <p className="text-gray-500 text-sm">
            © {new Date().getFullYear()} MiniMeet. Tous droits réservés.
          </p>
        </div>
      </footer>
    </div>
  );
};

export default NewLandingPage;
