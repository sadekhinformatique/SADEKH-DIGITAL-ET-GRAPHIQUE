import React, { createContext, useContext, useState, useEffect } from 'react';
import { BrowserRouter as Router, Routes, Route, Link, useNavigate, useLocation } from 'react-router-dom';
import { onAuthStateChanged, signInWithPopup, GoogleAuthProvider, signOut, User, getMultiFactorResolver, TotpMultiFactorGenerator } from 'firebase/auth';
import { doc, getDoc, setDoc, collection, onSnapshot, query, orderBy, limit, addDoc, updateDoc, deleteDoc, serverTimestamp, writeBatch, getDocsFromServer } from 'firebase/firestore';
import { auth, db } from './firebase';
import { CartItem, Service, ShopSettings, Category, Order, OrderItem } from './types';
import { ShoppingCart, Menu, X, Phone, Mail, MapPin, Facebook, Instagram, Youtube, Trash2, Plus, Minus, Send, ShieldCheck, FileText, Info, LayoutDashboard, LogIn, LogOut, ChevronRight, Star, CheckCircle2 } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';

// --- Utils ---
enum OperationType {
  CREATE = 'create',
  UPDATE = 'update',
  DELETE = 'delete',
  LIST = 'list',
  GET = 'get',
  WRITE = 'write',
}

interface FirestoreErrorInfo {
  error: string;
  operationType: OperationType;
  path: string | null;
  authInfo: {
    userId: string | undefined;
    email: string | null | undefined;
    emailVerified: boolean | undefined;
    isAnonymous: boolean | undefined;
    tenantId: string | null | undefined;
    providerInfo: {
      providerId: string;
      displayName: string | null;
      email: string | null;
      photoUrl: string | null;
    }[];
  }
}

function handleFirestoreError(error: unknown, operationType: OperationType, path: string | null) {
  const errInfo: FirestoreErrorInfo = {
    error: error instanceof Error ? error.message : String(error),
    authInfo: {
      userId: auth.currentUser?.uid,
      email: auth.currentUser?.email,
      emailVerified: auth.currentUser?.emailVerified,
      isAnonymous: auth.currentUser?.isAnonymous,
      tenantId: auth.currentUser?.tenantId,
      providerInfo: auth.currentUser?.providerData.map(provider => ({
        providerId: provider.providerId,
        displayName: provider.displayName,
        email: provider.email,
        photoUrl: provider.photoURL
      })) || []
    },
    operationType,
    path
  }
  console.error('Firestore Error: ', JSON.stringify(errInfo));
  throw new Error(JSON.stringify(errInfo));
}

function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

const formatPrice = (price: number) => {
  return new Intl.NumberFormat('fr-FR', { style: 'currency', currency: 'XOF' }).format(price);
};

// --- Contexts ---
interface CartContextType {
  cart: CartItem[];
  addToCart: (service: Service) => void;
  removeFromCart: (serviceId: string) => void;
  updateQuantity: (serviceId: string, quantity: number) => void;
  clearCart: () => void;
  total: number;
}

const CartContext = createContext<CartContextType | undefined>(undefined);

const useCart = () => {
  const context = useContext(CartContext);
  if (!context) throw new Error('useCart must be used within a CartProvider');
  return context;
};

interface AppContextType {
  settings: ShopSettings | null;
  categories: Category[];
  services: Service[];
  orders: Order[];
  user: User | null;
  isAdmin: boolean;
  loading: boolean;
}

const AppContext = createContext<AppContextType | undefined>(undefined);

const useAppContext = () => {
  const context = useContext(AppContext);
  if (!context) throw new Error('useAppContext must be used within an AppProvider');
  return context;
};

// --- Components ---
const Navbar = () => {
  const { cart, total } = useCart();
  const { settings, isAdmin, user } = useAppContext();
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const location = useLocation();

  const navLinks = [
    { name: 'Accueil', path: '/' },
    { name: 'Services', path: '/services' },
    { name: 'À Propos', path: '/about' },
    { name: 'Contact', path: '/contact' },
  ];

  return (
    <nav className="sticky top-0 z-50 bg-white shadow-md border-b border-gray-100">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex justify-between h-20">
          <div className="flex items-center">
            <Link to="/" className="flex-shrink-0 flex items-center gap-3">
              {settings?.logo ? (
                <img src={settings.logo} alt={settings.shop_name} className="h-12 w-auto" />
              ) : (
                <div className="h-12 w-12 bg-blue-600 rounded-lg flex items-center justify-center text-white font-bold text-2xl">S</div>
              )}
              <span className="text-xl font-bold text-gray-900 hidden sm:block">SADEKH DIGITAL</span>
            </Link>
          </div>

          {/* Desktop Nav */}
          <div className="hidden md:flex items-center space-x-8">
            {navLinks.map((link) => (
              <Link
                key={link.path}
                to={link.path}
                className={cn(
                  "text-sm font-medium transition-colors hover:text-orange-500",
                  location.pathname === link.path ? "text-orange-500" : "text-gray-600"
                )}
              >
                {link.name}
              </Link>
            ))}
            {isAdmin && (
              <Link to="/admin-dashboard" className="text-sm font-medium text-blue-600 hover:text-blue-700 flex items-center gap-1">
                <LayoutDashboard size={16} /> Admin
              </Link>
            )}
            <Link to="/cart" className="relative p-2 text-gray-600 hover:text-orange-500 transition-colors">
              <ShoppingCart size={24} />
              {cart.length > 0 && (
                <span className="absolute top-0 right-0 bg-orange-500 text-white text-[10px] font-bold rounded-full h-5 w-5 flex items-center justify-center border-2 border-white">
                  {cart.reduce((acc, item) => acc + item.quantity, 0)}
                </span>
              )}
            </Link>
          </div>

          {/* Mobile menu button */}
          <div className="md:hidden flex items-center gap-4">
            <Link to="/cart" className="relative p-2 text-gray-600">
              <ShoppingCart size={24} />
              {cart.length > 0 && (
                <span className="absolute top-0 right-0 bg-orange-500 text-white text-[10px] font-bold rounded-full h-5 w-5 flex items-center justify-center border-2 border-white">
                  {cart.reduce((acc, item) => acc + item.quantity, 0)}
                </span>
              )}
            </Link>
            <button
              onClick={() => setIsMenuOpen(!isMenuOpen)}
              className="p-2 rounded-md text-gray-600 hover:text-gray-900 hover:bg-gray-100 focus:outline-none"
            >
              {isMenuOpen ? <X size={24} /> : <Menu size={24} />}
            </button>
          </div>
        </div>
      </div>

      {/* Mobile menu */}
      <AnimatePresence>
        {isMenuOpen && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            exit={{ opacity: 0, height: 0 }}
            className="md:hidden bg-white border-t border-gray-100 overflow-hidden"
          >
            <div className="px-2 pt-2 pb-3 space-y-1 sm:px-3">
              {navLinks.map((link) => (
                <Link
                  key={link.path}
                  to={link.path}
                  onClick={() => setIsMenuOpen(false)}
                  className={cn(
                    "block px-3 py-2 rounded-md text-base font-medium",
                    location.pathname === link.path ? "bg-blue-50 text-blue-600" : "text-gray-600 hover:bg-gray-50 hover:text-gray-900"
                  )}
                >
                  {link.name}
                </Link>
              ))}
              {isAdmin && (
                <Link
                  to="/admin-dashboard"
                  onClick={() => setIsMenuOpen(false)}
                  className="block px-3 py-2 rounded-md text-base font-medium text-blue-600 hover:bg-blue-50"
                >
                  Dashboard Admin
                </Link>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </nav>
  );
};

const Footer = () => {
  const { settings } = useAppContext();
  const year = new Date().getFullYear();

  return (
    <footer className="bg-gray-900 text-white pt-16 pb-8">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="grid grid-cols-1 md:grid-cols-4 gap-12 mb-12">
          <div className="col-span-1 md:col-span-1">
            <Link to="/" className="flex items-center gap-3 mb-6">
              {settings?.logo ? (
                <img src={settings.logo} alt={settings.shop_name} className="h-10 w-auto" />
              ) : (
                <div className="h-10 w-10 bg-blue-600 rounded-lg flex items-center justify-center text-white font-bold text-xl">S</div>
              )}
              <span className="text-xl font-bold tracking-tight">SADEKH DIGITAL</span>
            </Link>
            <p className="text-gray-400 text-sm leading-relaxed mb-6">
              {settings?.description || "L'expertise créative au service de votre réussite commerciale. Nous accompagnons votre transformation digitale."}
            </p>
            <div className="flex gap-4">
              {settings?.facebook && <a href={settings.facebook} target="_blank" rel="noreferrer" className="text-gray-400 hover:text-white transition-colors"><Facebook size={20} /></a>}
              {settings?.instagram && <a href={settings.instagram} target="_blank" rel="noreferrer" className="text-gray-400 hover:text-white transition-colors"><Instagram size={20} /></a>}
              {settings?.youtube && <a href={settings.youtube} target="_blank" rel="noreferrer" className="text-gray-400 hover:text-white transition-colors"><Youtube size={20} /></a>}
            </div>
          </div>

          <div>
            <h3 className="text-lg font-semibold mb-6">Liens Rapides</h3>
            <ul className="space-y-4 text-sm text-gray-400">
              <li><Link to="/" className="hover:text-white transition-colors">Accueil</Link></li>
              <li><Link to="/services" className="hover:text-white transition-colors">Nos Services</Link></li>
              <li><Link to="/about" className="hover:text-white transition-colors">À Propos</Link></li>
              <li><Link to="/contact" className="hover:text-white transition-colors">Contact</Link></li>
            </ul>
          </div>

          <div>
            <h3 className="text-lg font-semibold mb-6">Légal</h3>
            <ul className="space-y-4 text-sm text-gray-400">
              <li><Link to="/policies" className="hover:text-white transition-colors">Politique de Confidentialité</Link></li>
              <li><Link to="/policies" className="hover:text-white transition-colors">CGV</Link></li>
              <li><Link to="/policies" className="hover:text-white transition-colors">Propriété Intellectuelle</Link></li>
            </ul>
          </div>

          <div>
            <h3 className="text-lg font-semibold mb-6">Contact</h3>
            <ul className="space-y-4 text-sm text-gray-400">
              <li className="flex items-start gap-3">
                <MapPin size={18} className="text-orange-500 shrink-0" />
                <span>{settings?.address || "Dakar, Sénégal"}</span>
              </li>
              <li className="flex items-center gap-3">
                <Phone size={18} className="text-orange-500 shrink-0" />
                <span>{settings?.phone_number || "+221 77 000 00 00"}</span>
              </li>
              <li className="flex items-center gap-3">
                <Mail size={18} className="text-orange-500 shrink-0" />
                <span>{settings?.email || "contact@sadekh.com"}</span>
              </li>
            </ul>
          </div>
        </div>
        
        <div className="pt-8 border-t border-gray-800 text-center text-sm text-gray-500">
          <p>© {year} {settings?.shop_name || "SADEKH DIGITAL ET GRAPHIQUE"}. Tous droits réservés.</p>
        </div>
      </div>
    </footer>
  );
};

// --- Pages ---

const Home = () => {
  const { services, settings } = useAppContext();
  const navigate = useNavigate();

  const featuredServices = services.slice(0, 3);

  return (
    <div className="flex flex-col">
      {/* Hero Section */}
      <section className="relative h-[80vh] flex items-center justify-center overflow-hidden bg-gray-900">
        <div className="absolute inset-0 z-0">
          <img 
            src="https://images.unsplash.com/photo-1551434678-e076c223a692?ixlib=rb-1.2.1&auto=format&fit=crop&w=2850&q=80" 
            alt="Hero background" 
            className="w-full h-full object-cover opacity-40"
            referrerPolicy="no-referrer"
          />
          <div className="absolute inset-0 bg-gradient-to-r from-blue-900/80 to-transparent"></div>
        </div>
        
        <div className="relative z-10 max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 text-center sm:text-left">
          <motion.div
            initial={{ opacity: 0, y: 30 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.8 }}
          >
            <h1 className="text-4xl sm:text-6xl font-extrabold text-white mb-6 leading-tight">
              L'expertise créative au service de votre <span className="text-orange-500">réussite commerciale</span>
            </h1>
            <p className="text-xl text-gray-300 mb-10 max-w-2xl">
              SADEKH DIGITAL ET GRAPHIQUE accompagne les entrepreneurs dans leur transformation digitale avec des solutions sur mesure.
            </p>
            <div className="flex flex-col sm:flex-row gap-4">
              <button 
                onClick={() => navigate('/services')}
                className="px-8 py-4 bg-orange-500 hover:bg-orange-600 text-white font-bold rounded-lg transition-all transform hover:scale-105 shadow-lg flex items-center justify-center gap-2"
              >
                Commander maintenant <ChevronRight size={20} />
              </button>
              <button 
                onClick={() => navigate('/about')}
                className="px-8 py-4 bg-white/10 hover:bg-white/20 text-white font-bold rounded-lg backdrop-blur-sm transition-all border border-white/30"
              >
                En savoir plus
              </button>
            </div>
          </motion.div>
        </div>
      </section>

      {/* Presentation */}
      <section className="py-24 bg-white">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-16 items-center">
            <motion.div
              initial={{ opacity: 0, x: -50 }}
              whileInView={{ opacity: 1, x: 0 }}
              viewport={{ once: true }}
            >
              <span className="text-orange-500 font-bold tracking-widest uppercase text-sm mb-4 block">Qui sommes-nous ?</span>
              <h2 className="text-3xl sm:text-4xl font-bold text-gray-900 mb-6">Votre partenaire digital de confiance</h2>
              <p className="text-gray-600 text-lg leading-relaxed mb-8">
                SADEKH DIGITAL ET GRAPHIQUE est une agence spécialisée dans l'identité visuelle, les solutions digitales et la stratégie de vente. Notre mission est de fournir des services de haute qualité accessibles à tous les entrepreneurs.
              </p>
              <div className="space-y-4">
                {[
                  "Identité visuelle et graphisme percutant",
                  "Solutions e-commerce performantes",
                  "Stratégies de vente optimisées"
                ].map((item, i) => (
                  <div key={i} className="flex items-center gap-3">
                    <CheckCircle2 className="text-blue-600" size={24} />
                    <span className="font-medium text-gray-800">{item}</span>
                  </div>
                ))}
              </div>
            </motion.div>
            <motion.div
              initial={{ opacity: 0, scale: 0.9 }}
              whileInView={{ opacity: 1, scale: 1 }}
              viewport={{ once: true }}
              className="relative"
            >
              <img 
                src="https://images.unsplash.com/photo-1522202176988-66273c2fd55f?ixlib=rb-1.2.1&auto=format&fit=crop&w=1351&q=80" 
                alt="Team working" 
                className="rounded-2xl shadow-2xl"
                referrerPolicy="no-referrer"
              />
              <div className="absolute -bottom-6 -right-6 bg-blue-600 p-8 rounded-2xl shadow-xl text-white hidden sm:block">
                <span className="text-4xl font-bold block mb-1">100+</span>
                <span className="text-sm font-medium opacity-80">Projets réussis</span>
              </div>
            </motion.div>
          </div>
        </div>
      </section>

      {/* Services Preview */}
      <section className="py-24 bg-gray-50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-16">
            <h2 className="text-3xl sm:text-4xl font-bold text-gray-900 mb-4">Nos Services Principaux</h2>
            <p className="text-gray-600 max-w-2xl mx-auto">Découvrez nos solutions conçues pour propulser votre business vers de nouveaux sommets.</p>
          </div>
          
          <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
            {featuredServices.map((service, idx) => (
              <motion.div
                key={service.id}
                initial={{ opacity: 0, y: 20 }}
                whileInView={{ opacity: 1, y: 0 }}
                transition={{ delay: idx * 0.1 }}
                viewport={{ once: true }}
                className="bg-white rounded-xl overflow-hidden shadow-lg hover:shadow-xl transition-shadow border border-gray-100"
              >
                <div className="h-48 bg-gray-200 overflow-hidden">
                  <img 
                    src={service.image || `https://picsum.photos/seed/${service.id}/600/400`} 
                    alt={service.name} 
                    className="w-full h-full object-cover"
                    referrerPolicy="no-referrer"
                  />
                </div>
                <div className="p-6">
                  <h3 className="text-xl font-bold text-gray-900 mb-2">{service.name}</h3>
                  <p className="text-gray-600 text-sm mb-4 line-clamp-2">{service.description}</p>
                  <div className="flex justify-between items-center">
                    <span className="text-blue-600 font-bold">{formatPrice(service.price)}</span>
                    <Link to="/services" className="text-orange-500 font-semibold text-sm flex items-center gap-1 hover:underline">
                      Détails <ChevronRight size={16} />
                    </Link>
                  </div>
                </div>
              </motion.div>
            ))}
          </div>
          
          <div className="text-center mt-12">
            <button 
              onClick={() => navigate('/services')}
              className="px-8 py-3 bg-blue-600 hover:bg-blue-700 text-white font-bold rounded-lg transition-colors"
            >
              Voir tous les services
            </button>
          </div>
        </div>
      </section>

      {/* Testimonials */}
      <section className="py-24 bg-white">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-16">
            <h2 className="text-3xl sm:text-4xl font-bold text-gray-900 mb-4">Ce que disent nos clients</h2>
          </div>
          
          <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
            {[
              { name: "Amadou Diop", role: "Entrepreneur", text: "Un travail exceptionnel sur mon logo. L'équipe a su capturer l'essence de ma marque dès le premier essai." },
              { name: "Fatou Sow", role: "Gérante Boutique", text: "Ma boutique en ligne est magnifique et très facile à utiliser. Mes ventes ont augmenté de 40% en deux mois." },
              { name: "Moussa Ndiaye", role: "Consultant", text: "La stratégie de marketing digital proposée par SADEKH a totalement changé ma visibilité sur les réseaux sociaux." }
            ].map((t, i) => (
              <div key={i} className="bg-gray-50 p-8 rounded-2xl border border-gray-100">
                <div className="flex gap-1 mb-4 text-orange-400">
                  {[...Array(5)].map((_, i) => <Star key={i} size={16} fill="currentColor" />)}
                </div>
                <p className="text-gray-600 italic mb-6">"{t.text}"</p>
                <div>
                  <p className="font-bold text-gray-900">{t.name}</p>
                  <p className="text-sm text-gray-500">{t.role}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>
    </div>
  );
};

const Services = () => {
  const { services, categories } = useAppContext();
  const { addToCart } = useCart();
  const [activeCategory, setActiveCategory] = useState<string>('all');

  const filteredServices = activeCategory === 'all' 
    ? services 
    : services.filter(s => s.category === activeCategory);

  return (
    <div className="py-16 bg-gray-50 min-h-screen">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="text-center mb-12">
          <h1 className="text-4xl font-bold text-gray-900 mb-4">Nos Services Digitaux</h1>
          <p className="text-gray-600 max-w-2xl mx-auto">Choisissez l'excellence pour votre projet. Des tarifs transparents et une qualité premium.</p>
        </div>

        {/* Categories Filter */}
        <div className="flex flex-wrap justify-center gap-4 mb-12">
          <button
            onClick={() => setActiveCategory('all')}
            className={cn(
              "px-6 py-2 rounded-full font-medium transition-all",
              activeCategory === 'all' ? "bg-blue-600 text-white shadow-md" : "bg-white text-gray-600 hover:bg-gray-100"
            )}
          >
            Tous
          </button>
          {categories.map(cat => (
            <button
              key={cat.id}
              onClick={() => setActiveCategory(cat.id)}
              className={cn(
                "px-6 py-2 rounded-full font-medium transition-all",
                activeCategory === cat.id ? "bg-blue-600 text-white shadow-md" : "bg-white text-gray-600 hover:bg-gray-100"
              )}
            >
              {cat.name}
            </button>
          ))}
        </div>

        {/* Services Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
          {filteredServices.map(service => (
            <motion.div
              layout
              key={service.id}
              initial={{ opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1 }}
              className="bg-white rounded-2xl overflow-hidden shadow-sm hover:shadow-xl transition-all border border-gray-100 flex flex-col"
            >
              <div className="h-56 bg-gray-200 relative overflow-hidden">
                <img 
                  src={service.image || `https://picsum.photos/seed/${service.id}/600/400`} 
                  alt={service.name} 
                  className="w-full h-full object-cover transition-transform hover:scale-110 duration-500"
                  referrerPolicy="no-referrer"
                />
                <div className="absolute top-4 right-4 bg-white/90 backdrop-blur-sm px-3 py-1 rounded-full text-xs font-bold text-blue-600 shadow-sm">
                  {categories.find(c => c.id === service.category)?.name}
                </div>
              </div>
              <div className="p-6 flex-grow flex flex-col">
                <h3 className="text-xl font-bold text-gray-900 mb-2">{service.name}</h3>
                <p className="text-gray-600 text-sm mb-6 line-clamp-3 flex-grow">{service.description}</p>
                <div className="flex items-center justify-between mt-auto">
                  <span className="text-2xl font-bold text-blue-600">{formatPrice(service.price)}</span>
                  <button
                    onClick={() => addToCart(service)}
                    className="p-3 bg-orange-500 hover:bg-orange-600 text-white rounded-xl shadow-lg shadow-orange-500/20 transition-all active:scale-95"
                    title="Ajouter au panier"
                  >
                    <Plus size={20} />
                  </button>
                </div>
              </div>
            </motion.div>
          ))}
        </div>
        
        {filteredServices.length === 0 && (
          <div className="text-center py-20">
            <p className="text-gray-500 text-lg">Aucun service trouvé dans cette catégorie.</p>
          </div>
        )}
      </div>
    </div>
  );
};

const Cart = () => {
  const { cart, removeFromCart, updateQuantity, total, clearCart } = useCart();
  const { settings } = useAppContext();
  const [customerInfo, setCustomerInfo] = useState({ name: '', phone: '', email: '' });
  const navigate = useNavigate();

  const handleWhatsAppOrder = async () => {
    if (!customerInfo.name || !customerInfo.phone) {
      alert("Veuillez remplir votre nom et téléphone.");
      return;
    }

    try {
      // 1. Save order to Firestore
      const batch = writeBatch(db);
      const orderRef = doc(collection(db, 'orders'));
      const orderData = {
        customer_name: customerInfo.name,
        customer_phone: customerInfo.phone,
        customer_email: customerInfo.email || '',
        total: total,
        status: 'En attente',
        created_at: serverTimestamp()
      };
      batch.set(orderRef, orderData);

      cart.forEach(item => {
        const itemRef = doc(collection(db, 'order_items'));
        batch.set(itemRef, {
          order: orderRef.id,
          service: item.service.id,
          service_name: item.service.name,
          quantity: item.quantity,
          price: item.service.price
        });
      });

      await batch.commit();

      // 2. Redirect to WhatsApp
      const cartDetails = cart.map(item => 
        `Service : ${item.service.name}\nPrix : ${formatPrice(item.service.price)}${item.quantity > 1 ? ` (x${item.quantity})` : ''}`
      ).join('\n\n');

      const message = `Bonjour,\n\nJe souhaite commander les services suivants :\n\n${cartDetails}\n\nTotal : ${formatPrice(total)}\n\nNom : ${customerInfo.name}\nTéléphone : ${customerInfo.phone}\nEmail : ${customerInfo.email || 'Non renseigné'}`;
      
      const whatsappNumber = settings?.whatsapp_number || "221770000000";
      const encodedMessage = encodeURIComponent(message);
      const whatsappUrl = `https://wa.me/${whatsappNumber}?text=${encodedMessage}`;
      
      window.open(whatsappUrl, '_blank');
      clearCart();
      alert("Votre commande a été enregistrée ! Vous allez être redirigé vers WhatsApp.");
    } catch (err) {
      handleFirestoreError(err, OperationType.WRITE, 'orders');
    }
  };

  if (cart.length === 0) {
    return (
      <div className="py-24 bg-gray-50 min-h-screen flex items-center justify-center">
        <div className="text-center bg-white p-12 rounded-3xl shadow-sm border border-gray-100 max-w-md mx-4">
          <div className="bg-gray-100 w-20 h-20 rounded-full flex items-center justify-center mx-auto mb-6">
            <ShoppingCart size={40} className="text-gray-400" />
          </div>
          <h2 className="text-2xl font-bold text-gray-900 mb-4">Votre panier est vide</h2>
          <p className="text-gray-600 mb-8">Il semble que vous n'ayez pas encore ajouté de services à votre panier.</p>
          <button 
            onClick={() => navigate('/services')}
            className="w-full py-4 bg-blue-600 hover:bg-blue-700 text-white font-bold rounded-xl transition-colors"
          >
            Découvrir nos services
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="py-16 bg-gray-50 min-h-screen">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <h1 className="text-3xl font-bold text-gray-900 mb-12">Votre Panier</h1>
        
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-12">
          {/* Cart Items */}
          <div className="lg:col-span-2 space-y-6">
            {cart.map(item => (
              <div key={item.service.id} className="bg-white p-6 rounded-2xl shadow-sm border border-gray-100 flex flex-col sm:flex-row gap-6 items-center">
                <div className="w-24 h-24 rounded-xl overflow-hidden bg-gray-100 shrink-0">
                  <img src={item.service.image || `https://picsum.photos/seed/${item.service.id}/200/200`} alt={item.service.name} className="w-full h-full object-cover" referrerPolicy="no-referrer" />
                </div>
                <div className="flex-grow text-center sm:text-left">
                  <h3 className="text-lg font-bold text-gray-900">{item.service.name}</h3>
                  <p className="text-blue-600 font-bold">{formatPrice(item.service.price)}</p>
                </div>
                <div className="flex items-center gap-4">
                  <div className="flex items-center bg-gray-100 rounded-lg p-1">
                    <button 
                      onClick={() => updateQuantity(item.service.id, item.quantity - 1)}
                      className="p-1 hover:bg-white rounded-md transition-colors"
                    >
                      <Minus size={16} />
                    </button>
                    <span className="w-10 text-center font-bold">{item.quantity}</span>
                    <button 
                      onClick={() => updateQuantity(item.service.id, item.quantity + 1)}
                      className="p-1 hover:bg-white rounded-md transition-colors"
                    >
                      <Plus size={16} />
                    </button>
                  </div>
                  <button 
                    onClick={() => removeFromCart(item.service.id)}
                    className="p-2 text-red-500 hover:bg-red-50 rounded-lg transition-colors"
                  >
                    <Trash2 size={20} />
                  </button>
                </div>
              </div>
            ))}
            
            <button 
              onClick={clearCart}
              className="text-gray-500 hover:text-red-500 text-sm font-medium flex items-center gap-2 transition-colors"
            >
              <Trash2 size={16} /> Vider le panier
            </button>
          </div>

          {/* Order Summary */}
          <div className="lg:col-span-1">
            <div className="bg-white p-8 rounded-3xl shadow-lg border border-gray-100 sticky top-24">
              <h2 className="text-xl font-bold text-gray-900 mb-6">Récapitulatif</h2>
              
              <div className="space-y-4 mb-8">
                <div className="flex justify-between text-gray-600">
                  <span>Sous-total</span>
                  <span>{formatPrice(total)}</span>
                </div>
                <div className="flex justify-between text-gray-600">
                  <span>Frais de service</span>
                  <span>Gratuit</span>
                </div>
                <div className="pt-4 border-t border-gray-100 flex justify-between items-center">
                  <span className="text-lg font-bold text-gray-900">Total</span>
                  <span className="text-2xl font-extrabold text-blue-600">{formatPrice(total)}</span>
                </div>
              </div>

              <div className="space-y-4 mb-8">
                <h3 className="font-bold text-gray-900 text-sm uppercase tracking-wider">Vos Informations</h3>
                <input 
                  type="text" 
                  placeholder="Nom complet *" 
                  required
                  value={customerInfo.name}
                  onChange={e => setCustomerInfo({...customerInfo, name: e.target.value})}
                  className="w-full px-4 py-3 rounded-xl border border-gray-200 focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none transition-all"
                />
                <input 
                  type="tel" 
                  placeholder="Téléphone *" 
                  required
                  value={customerInfo.phone}
                  onChange={e => setCustomerInfo({...customerInfo, phone: e.target.value})}
                  className="w-full px-4 py-3 rounded-xl border border-gray-200 focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none transition-all"
                />
                <input 
                  type="email" 
                  placeholder="Email (optionnel)" 
                  value={customerInfo.email}
                  onChange={e => setCustomerInfo({...customerInfo, email: e.target.value})}
                  className="w-full px-4 py-3 rounded-xl border border-gray-200 focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none transition-all"
                />
              </div>

              <button 
                onClick={handleWhatsAppOrder}
                className="w-full py-4 bg-green-500 hover:bg-green-600 text-white font-bold rounded-xl shadow-lg shadow-green-500/20 transition-all flex items-center justify-center gap-3"
              >
                <Send size={20} /> Commander via WhatsApp
              </button>
              <p className="mt-4 text-[10px] text-gray-400 text-center">
                En cliquant sur commander, vous serez redirigé vers WhatsApp pour finaliser votre commande avec un conseiller.
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

const Contact = () => {
  const { settings } = useAppContext();
  
  return (
    <div className="py-16 bg-white min-h-screen">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="text-center mb-16">
          <h1 className="text-4xl font-bold text-gray-900 mb-4">Contactez-nous</h1>
          <p className="text-gray-600 max-w-2xl mx-auto">Une question ? Un projet ? Notre équipe est à votre écoute pour vous accompagner.</p>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-16">
          {/* Contact Info */}
          <div>
            <h2 className="text-2xl font-bold text-gray-900 mb-8">Informations de l'agence</h2>
            <div className="space-y-8">
              <div className="flex items-start gap-6">
                <div className="bg-blue-50 p-4 rounded-2xl text-blue-600">
                  <MapPin size={24} />
                </div>
                <div>
                  <h3 className="font-bold text-gray-900 mb-1">Adresse</h3>
                  <p className="text-gray-600">{settings?.address || "Dakar, Sénégal"}</p>
                </div>
              </div>
              <div className="flex items-start gap-6">
                <div className="bg-orange-50 p-4 rounded-2xl text-orange-600">
                  <Phone size={24} />
                </div>
                <div>
                  <h3 className="font-bold text-gray-900 mb-1">Téléphone / WhatsApp</h3>
                  <p className="text-gray-600">{settings?.phone_number || "+221 77 000 00 00"}</p>
                </div>
              </div>
              <div className="flex items-start gap-6">
                <div className="bg-green-50 p-4 rounded-2xl text-green-600">
                  <Mail size={24} />
                </div>
                <div>
                  <h3 className="font-bold text-gray-900 mb-1">Email</h3>
                  <p className="text-gray-600">{settings?.email || "contact@sadekh.com"}</p>
                </div>
              </div>
            </div>

            <div className="mt-12 p-8 bg-gray-50 rounded-3xl border border-gray-100">
              <h3 className="font-bold text-gray-900 mb-4">Suivez-nous</h3>
              <div className="flex gap-4">
                <a href="#" className="p-3 bg-white rounded-xl shadow-sm hover:shadow-md transition-all text-blue-600"><Facebook /></a>
                <a href="#" className="p-3 bg-white rounded-xl shadow-sm hover:shadow-md transition-all text-pink-600"><Instagram /></a>
                <a href="#" className="p-3 bg-white rounded-xl shadow-sm hover:shadow-md transition-all text-red-600"><Youtube /></a>
              </div>
            </div>
          </div>

          {/* Contact Form */}
          <div className="bg-white p-8 sm:p-12 rounded-3xl shadow-2xl shadow-blue-900/5 border border-gray-100">
            <h2 className="text-2xl font-bold text-gray-900 mb-8">Envoyez un message</h2>
            <form className="space-y-6" onSubmit={(e) => { e.preventDefault(); alert("Message envoyé ! Nous vous répondrons bientôt."); }}>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
                <div className="space-y-2">
                  <label className="text-sm font-bold text-gray-700">Nom complet</label>
                  <input type="text" required className="w-full px-4 py-3 rounded-xl border border-gray-200 focus:ring-2 focus:ring-blue-500 outline-none transition-all" />
                </div>
                <div className="space-y-2">
                  <label className="text-sm font-bold text-gray-700">Email</label>
                  <input type="email" required className="w-full px-4 py-3 rounded-xl border border-gray-200 focus:ring-2 focus:ring-blue-500 outline-none transition-all" />
                </div>
              </div>
              <div className="space-y-2">
                <label className="text-sm font-bold text-gray-700">Sujet</label>
                <input type="text" required className="w-full px-4 py-3 rounded-xl border border-gray-200 focus:ring-2 focus:ring-blue-500 outline-none transition-all" />
              </div>
              <div className="space-y-2">
                <label className="text-sm font-bold text-gray-700">Message</label>
                <textarea rows={5} required className="w-full px-4 py-3 rounded-xl border border-gray-200 focus:ring-2 focus:ring-blue-500 outline-none transition-all resize-none"></textarea>
              </div>
              <button type="submit" className="w-full py-4 bg-blue-600 hover:bg-blue-700 text-white font-bold rounded-xl shadow-lg transition-all">
                Envoyer le message
              </button>
            </form>
          </div>
        </div>
      </div>
    </div>
  );
};

const About = () => {
  return (
    <div className="py-16 bg-white min-h-screen">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="max-w-3xl mx-auto text-center mb-16">
          <h1 className="text-4xl font-bold text-gray-900 mb-8">À Propos de SADEKH DIGITAL</h1>
          <p className="text-xl text-gray-600 leading-relaxed">
            Nous accompagnons les entrepreneurs et entreprises dans leur transformation digitale à travers trois pôles d'excellence.
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-12 mb-24">
          {[
            { title: "Identité Visuelle & Graphisme", icon: <ShieldCheck size={32} />, desc: "Création de logos, chartes graphiques, affiches publicitaires et bannières pour une image de marque forte." },
            { title: "Solutions Digitales & E-commerce", icon: <LayoutDashboard size={32} />, desc: "Création de sites web, design UI/UX et optimisation de boutiques en ligne pour une présence digitale efficace." },
            { title: "Stratégie de Vente & Conseil", icon: <Star size={32} />, desc: "Tunnels de vente, marketing digital et conseil business pour maximiser votre réussite commerciale." }
          ].map((item, i) => (
            <div key={i} className="bg-gray-50 p-10 rounded-3xl border border-gray-100 text-center hover:bg-white hover:shadow-xl transition-all group">
              <div className="bg-blue-600 text-white w-16 h-16 rounded-2xl flex items-center justify-center mx-auto mb-6 group-hover:scale-110 transition-transform">
                {item.icon}
              </div>
              <h3 className="text-xl font-bold text-gray-900 mb-4">{item.title}</h3>
              <p className="text-gray-600 leading-relaxed">{item.desc}</p>
            </div>
          ))}
        </div>

        <div className="bg-blue-900 rounded-[3rem] p-12 sm:p-20 text-white relative overflow-hidden">
          <div className="relative z-10 max-w-2xl">
            <h2 className="text-3xl font-bold mb-6">Notre Mission</h2>
            <p className="text-blue-100 text-lg leading-relaxed mb-8">
              Fournir des services digitaux de haute qualité accessibles aux entrepreneurs et entreprises, afin de démocratiser l'accès à l'excellence créative et technologique.
            </p>
            <Link to="/contact" className="inline-flex items-center gap-2 bg-orange-500 hover:bg-orange-600 text-white font-bold px-8 py-4 rounded-xl transition-all">
              Travaillons ensemble <ChevronRight size={20} />
            </Link>
          </div>
          <div className="absolute top-0 right-0 w-1/2 h-full opacity-10 hidden lg:block">
            <img src="https://images.unsplash.com/photo-1552664730-d307ca884978?ixlib=rb-1.2.1&auto=format&fit=crop&w=1350&q=80" alt="Mission" className="w-full h-full object-cover" referrerPolicy="no-referrer" />
          </div>
        </div>
      </div>
    </div>
  );
};

const Policies = () => {
  return (
    <div className="py-16 bg-gray-50 min-h-screen">
      <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="bg-white p-12 rounded-3xl shadow-sm border border-gray-100 space-y-12">
          <section>
            <h1 className="text-3xl font-bold text-gray-900 mb-8 flex items-center gap-3">
              <ShieldCheck className="text-blue-600" /> Politique de Confidentialité
            </h1>
            <div className="prose prose-blue max-w-none text-gray-600 space-y-4">
              <p>Chez SADEKH DIGITAL ET GRAPHIQUE, nous accordons une importance capitale à la protection de vos données personnelles.</p>
              <p>Nous collectons uniquement les informations nécessaires au traitement de vos commandes (nom, téléphone, email). Ces données ne sont jamais partagées avec des tiers sans votre consentement explicite.</p>
              <p>Conformément aux lois en vigueur, vous disposez d'un droit d'accès, de rectification et de suppression de vos données.</p>
            </div>
          </section>

          <section>
            <h2 className="text-2xl font-bold text-gray-900 mb-6 flex items-center gap-3">
              <FileText className="text-blue-600" /> Conditions Générales de Vente
            </h2>
            <div className="prose prose-blue max-w-none text-gray-600 space-y-4">
              <p>Toute commande passée sur notre plateforme implique l'acceptation sans réserve des présentes CGV.</p>
              <ul className="list-disc pl-6 space-y-2">
                <li>Les prix sont indiqués en FCFA.</li>
                <li>Le paiement s'effectue selon les modalités convenues lors de la confirmation via WhatsApp.</li>
                <li>Les délais de livraison varient selon la complexité du service commandé.</li>
                <li>Aucun remboursement n'est possible une fois le travail commencé.</li>
              </ul>
            </div>
          </section>

          <section>
            <h2 className="text-2xl font-bold text-gray-900 mb-6 flex items-center gap-3">
              <Info className="text-blue-600" /> Propriété Intellectuelle
            </h2>
            <div className="prose prose-blue max-w-none text-gray-600 space-y-4">
              <p>Tous les éléments créés par SADEKH DIGITAL ET GRAPHIQUE (logos, designs, sites web) restent notre propriété intellectuelle jusqu'au paiement intégral de la prestation.</p>
              <p>Une fois le paiement effectué, les droits d'utilisation sont transférés au client pour l'usage convenu.</p>
            </div>
          </section>
        </div>
      </div>
    </div>
  );
};

const AdminDashboard = () => {
  const { isAdmin, services, categories, settings, orders } = useAppContext();
  const navigate = useNavigate();
  const [activeTab, setActiveTab] = useState<'services' | 'orders' | 'settings'>('services');
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingService, setEditingService] = useState<Service | null>(null);
  const [formData, setFormData] = useState({ name: '', description: '', price: 0, category: '', image: '' });
  const [testStatus, setTestStatus] = useState<'idle' | 'testing' | 'success' | 'error'>('idle');

  if (!isAdmin) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="text-center">
          <h1 className="text-2xl font-bold text-gray-900 mb-4">Accès Refusé</h1>
          <p className="text-gray-600 mb-8">Vous devez être administrateur pour accéder à cette page.</p>
          <button onClick={() => navigate('/')} className="px-6 py-2 bg-blue-600 text-white rounded-lg">Retour à l'accueil</button>
        </div>
      </div>
    );
  }

  const handleTestConnection = async () => {
    setTestStatus('testing');
    try {
      await getDocsFromServer(query(collection(db, 'settings'), limit(1)));
      setTestStatus('success');
      setTimeout(() => setTestStatus('idle'), 3000);
    } catch (err) {
      setTestStatus('error');
      console.error("Manual test failed:", err);
    }
  };

  const handleUpdateOrderStatus = async (orderId: string, newStatus: string) => {
    try {
      await updateDoc(doc(db, 'orders', orderId), { status: newStatus });
    } catch (err) {
      handleFirestoreError(err, OperationType.UPDATE, `orders/${orderId}`);
    }
  };

  const handleSaveService = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      if (editingService) {
        await updateDoc(doc(db, 'services', editingService.id), formData);
      } else {
        await addDoc(collection(db, 'services'), {
          ...formData,
          created_at: new Date().toISOString()
        });
      }
      setIsModalOpen(false);
      setEditingService(null);
      setFormData({ name: '', description: '', price: 0, category: '', image: '' });
    } catch (err) {
      handleFirestoreError(err, editingService ? OperationType.UPDATE : OperationType.CREATE, 'services');
    }
  };

  const handleDeleteService = async (id: string) => {
    if (window.confirm("Supprimer ce service ?")) {
      try {
        await deleteDoc(doc(db, 'services', id));
      } catch (err) {
        handleFirestoreError(err, OperationType.DELETE, `services/${id}`);
      }
    }
  };

  const handleUpdateSettings = async (e: React.FormEvent) => {
    e.preventDefault();
    const form = e.target as HTMLFormElement;
    const data = {
      shop_name: (form.elements.namedItem('shop_name') as HTMLInputElement).value,
      whatsapp_number: (form.elements.namedItem('whatsapp_number') as HTMLInputElement).value,
      email: (form.elements.namedItem('email') as HTMLInputElement).value,
      description: (form.elements.namedItem('description') as HTMLTextAreaElement).value,
      address: (form.elements.namedItem('address') as HTMLInputElement).value,
    };
    try {
      await updateDoc(doc(db, 'settings', 'global'), data);
      alert("Paramètres mis à jour !");
    } catch (err) {
      handleFirestoreError(err, OperationType.UPDATE, 'settings/global');
    }
  };

  return (
    <div className="min-h-screen bg-gray-50 flex">
      {/* Sidebar */}
      <div className="w-64 bg-white border-r border-gray-200 hidden lg:block">
        <div className="p-6 border-b border-gray-200">
          <h2 className="text-lg font-bold text-gray-900">Admin Panel</h2>
        </div>
        <nav className="p-4 space-y-2">
          <button 
            onClick={() => setActiveTab('services')}
            className={cn("w-full flex items-center gap-3 px-4 py-3 rounded-xl text-sm font-medium transition-all", activeTab === 'services' ? "bg-blue-50 text-blue-600" : "text-gray-600 hover:bg-gray-50")}
          >
            <LayoutDashboard size={18} /> Services
          </button>
          <button 
            onClick={() => setActiveTab('orders')}
            className={cn("w-full flex items-center gap-3 px-4 py-3 rounded-xl text-sm font-medium transition-all", activeTab === 'orders' ? "bg-blue-50 text-blue-600" : "text-gray-600 hover:bg-gray-50")}
          >
            <ShoppingCart size={18} /> Commandes
          </button>
          <button 
            onClick={() => setActiveTab('settings')}
            className={cn("w-full flex items-center gap-3 px-4 py-3 rounded-xl text-sm font-medium transition-all", activeTab === 'settings' ? "bg-blue-50 text-blue-600" : "text-gray-600 hover:bg-gray-50")}
          >
            <ShieldCheck size={18} /> Paramètres
          </button>
          <div className="pt-8">
            <button 
              onClick={() => signOut(auth)}
              className="w-full flex items-center gap-3 px-4 py-3 rounded-xl text-sm font-medium text-red-600 hover:bg-red-50 transition-all"
            >
              <LogOut size={18} /> Déconnexion
            </button>
          </div>
        </nav>
      </div>

      {/* Content */}
      <div className="flex-grow p-8">
        <div className="max-w-6xl mx-auto">
          <div className="flex justify-between items-center mb-8">
            <div className="flex items-center gap-4">
              <h1 className="text-2xl font-bold text-gray-900">
                {activeTab === 'services' && "Gestion des Services"}
                {activeTab === 'orders' && "Suivi des Commandes"}
                {activeTab === 'settings' && "Paramètres de la Boutique"}
              </h1>
              <button 
                onClick={handleTestConnection}
                className={cn(
                  "text-xs px-3 py-1 rounded-full border transition-all flex items-center gap-2",
                  testStatus === 'idle' && "border-gray-200 text-gray-500 hover:bg-gray-50",
                  testStatus === 'testing' && "border-blue-200 text-blue-500 bg-blue-50 animate-pulse",
                  testStatus === 'success' && "border-green-200 text-green-600 bg-green-50",
                  testStatus === 'error' && "border-red-200 text-red-600 bg-red-50"
                )}
              >
                <ShieldCheck size={12} />
                {testStatus === 'idle' && "Tester Firebase"}
                {testStatus === 'testing' && "Test en cours..."}
                {testStatus === 'success' && "Connexion OK"}
                {testStatus === 'error' && "Erreur Connexion"}
              </button>
            </div>
            {activeTab === 'services' && (
              <button 
                onClick={() => { setEditingService(null); setFormData({ name: '', description: '', price: 0, category: categories[0]?.id || '', image: '' }); setIsModalOpen(true); }}
                className="px-4 py-2 bg-blue-600 text-white rounded-lg flex items-center gap-2 hover:bg-blue-700 transition-all"
              >
                <Plus size={18} /> Ajouter un service
              </button>
            )}
          </div>

          {activeTab === 'services' && (
            <div className="bg-white rounded-2xl shadow-sm border border-gray-200 overflow-hidden">
              <table className="w-full text-left">
                <thead className="bg-gray-50 border-b border-gray-200">
                  <tr>
                    <th className="px-6 py-4 text-xs font-bold text-gray-500 uppercase tracking-wider">Service</th>
                    <th className="px-6 py-4 text-xs font-bold text-gray-500 uppercase tracking-wider">Catégorie</th>
                    <th className="px-6 py-4 text-xs font-bold text-gray-500 uppercase tracking-wider">Prix</th>
                    <th className="px-6 py-4 text-xs font-bold text-gray-500 uppercase tracking-wider text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-200">
                  {services.map(service => (
                    <tr key={service.id} className="hover:bg-gray-50 transition-colors">
                      <td className="px-6 py-4">
                        <div className="flex items-center gap-3">
                          <div className="w-10 h-10 rounded bg-gray-100 overflow-hidden">
                            <img src={service.image || `https://picsum.photos/seed/${service.id}/100/100`} alt="" className="w-full h-full object-cover" />
                          </div>
                          <span className="font-medium text-gray-900">{service.name}</span>
                        </div>
                      </td>
                      <td className="px-6 py-4 text-sm text-gray-600">
                        {categories.find(c => c.id === service.category)?.name}
                      </td>
                      <td className="px-6 py-4 text-sm font-bold text-blue-600">
                        {formatPrice(service.price)}
                      </td>
                      <td className="px-6 py-4 text-right">
                        <button 
                          onClick={() => { setEditingService(service); setFormData({ name: service.name, description: service.description, price: service.price, category: service.category, image: service.image || '' }); setIsModalOpen(true); }}
                          className="text-blue-600 hover:underline mr-4"
                        >
                          Modifier
                        </button>
                        <button 
                          onClick={() => handleDeleteService(service.id)}
                          className="text-red-600 hover:underline"
                        >
                          Supprimer
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          {activeTab === 'orders' && (
            <div className="bg-white rounded-2xl shadow-sm border border-gray-200 overflow-hidden">
              {orders.length === 0 ? (
                <div className="text-center py-20">
                  <ShoppingCart size={48} className="text-gray-300 mx-auto mb-4" />
                  <p className="text-gray-500">Aucune commande enregistrée pour le moment.</p>
                </div>
              ) : (
                <table className="w-full text-left">
                  <thead className="bg-gray-50 border-b border-gray-200">
                    <tr>
                      <th className="px-6 py-4 text-xs font-bold text-gray-500 uppercase tracking-wider">Client</th>
                      <th className="px-6 py-4 text-xs font-bold text-gray-500 uppercase tracking-wider">Date</th>
                      <th className="px-6 py-4 text-xs font-bold text-gray-500 uppercase tracking-wider">Total</th>
                      <th className="px-6 py-4 text-xs font-bold text-gray-500 uppercase tracking-wider">Statut</th>
                      <th className="px-6 py-4 text-xs font-bold text-gray-500 uppercase tracking-wider text-right">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-200">
                    {orders.map(order => (
                      <tr key={order.id} className="hover:bg-gray-50 transition-colors">
                        <td className="px-6 py-4">
                          <div className="flex flex-col">
                            <span className="font-medium text-gray-900">{order.customer_name}</span>
                            <span className="text-xs text-gray-500">{order.customer_phone}</span>
                          </div>
                        </td>
                        <td className="px-6 py-4 text-sm text-gray-600">
                          {order.created_at?.toDate ? order.created_at.toDate().toLocaleDateString('fr-FR') : 'N/A'}
                        </td>
                        <td className="px-6 py-4 text-sm font-bold text-blue-600">
                          {formatPrice(order.total)}
                        </td>
                        <td className="px-6 py-4">
                          <span className={cn(
                            "px-2 py-1 rounded-full text-[10px] font-bold uppercase",
                            order.status === 'En attente' && "bg-orange-100 text-orange-600",
                            order.status === 'Confirmée' && "bg-blue-100 text-blue-600",
                            order.status === 'Terminée' && "bg-green-100 text-green-600",
                            order.status === 'Livrée' && "bg-gray-100 text-gray-600"
                          )}>
                            {order.status}
                          </span>
                        </td>
                        <td className="px-6 py-4 text-right">
                          <select 
                            value={order.status}
                            onChange={(e) => handleUpdateOrderStatus(order.id, e.target.value)}
                            className="text-xs border border-gray-200 rounded-lg px-2 py-1 outline-none focus:ring-2 focus:ring-blue-500"
                          >
                            <option value="En attente">En attente</option>
                            <option value="Confirmée">Confirmée</option>
                            <option value="Terminée">Terminée</option>
                            <option value="Livrée">Livrée</option>
                          </select>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </div>
          )}

          {activeTab === 'settings' && (
            <div className="bg-white p-8 rounded-2xl shadow-sm border border-gray-200 max-w-2xl">
              <form className="space-y-6" onSubmit={handleUpdateSettings}>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
                  <div className="space-y-2">
                    <label className="text-sm font-bold text-gray-700">Nom de la boutique</label>
                    <input name="shop_name" type="text" defaultValue={settings?.shop_name} className="w-full px-4 py-2 rounded-lg border border-gray-200 focus:ring-2 focus:ring-blue-500 outline-none" />
                  </div>
                  <div className="space-y-2">
                    <label className="text-sm font-bold text-gray-700">Numéro WhatsApp</label>
                    <input name="whatsapp_number" type="text" defaultValue={settings?.whatsapp_number} className="w-full px-4 py-2 rounded-lg border border-gray-200 focus:ring-2 focus:ring-blue-500 outline-none" />
                  </div>
                </div>
                <div className="space-y-2">
                  <label className="text-sm font-bold text-gray-700">Email de contact</label>
                  <input name="email" type="email" defaultValue={settings?.email} className="w-full px-4 py-2 rounded-lg border border-gray-200 focus:ring-2 focus:ring-blue-500 outline-none" />
                </div>
                <div className="space-y-2">
                  <label className="text-sm font-bold text-gray-700">Adresse</label>
                  <input name="address" type="text" defaultValue={settings?.address} className="w-full px-4 py-2 rounded-lg border border-gray-200 focus:ring-2 focus:ring-blue-500 outline-none" />
                </div>
                <div className="space-y-2">
                  <label className="text-sm font-bold text-gray-700">Description</label>
                  <textarea name="description" rows={3} defaultValue={settings?.description} className="w-full px-4 py-2 rounded-lg border border-gray-200 focus:ring-2 focus:ring-blue-500 outline-none resize-none"></textarea>
                </div>
                <button type="submit" className="px-8 py-3 bg-blue-600 text-white font-bold rounded-lg hover:bg-blue-700 transition-all">
                  Enregistrer les modifications
                </button>
              </form>
            </div>
          )}
        </div>
      </div>

      {/* Service Modal */}
      <AnimatePresence>
        {isModalOpen && (
          <div className="fixed inset-0 z-[60] flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
            <motion.div 
              initial={{ opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.9 }}
              className="bg-white rounded-3xl p-8 w-full max-w-lg shadow-2xl"
            >
              <h2 className="text-2xl font-bold mb-6">{editingService ? "Modifier le service" : "Nouveau service"}</h2>
              <form onSubmit={handleSaveService} className="space-y-4">
                <div className="space-y-1">
                  <label className="text-xs font-bold text-gray-500 uppercase">Nom</label>
                  <input 
                    type="text" required value={formData.name} 
                    onChange={e => setFormData({...formData, name: e.target.value})}
                    className="w-full px-4 py-2 rounded-xl border border-gray-200 focus:ring-2 focus:ring-blue-500 outline-none" 
                  />
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-1">
                    <label className="text-xs font-bold text-gray-500 uppercase">Prix (FCFA)</label>
                    <input 
                      type="number" required value={formData.price} 
                      onChange={e => setFormData({...formData, price: Number(e.target.value)})}
                      className="w-full px-4 py-2 rounded-xl border border-gray-200 focus:ring-2 focus:ring-blue-500 outline-none" 
                    />
                  </div>
                  <div className="space-y-1">
                    <label className="text-xs font-bold text-gray-500 uppercase">Catégorie</label>
                    <select 
                      required value={formData.category} 
                      onChange={e => setFormData({...formData, category: e.target.value})}
                      className="w-full px-4 py-2 rounded-xl border border-gray-200 focus:ring-2 focus:ring-blue-500 outline-none"
                    >
                      {categories.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                    </select>
                  </div>
                </div>
                <div className="space-y-1">
                  <label className="text-xs font-bold text-gray-500 uppercase">Description</label>
                  <textarea 
                    rows={3} required value={formData.description} 
                    onChange={e => setFormData({...formData, description: e.target.value})}
                    className="w-full px-4 py-2 rounded-xl border border-gray-200 focus:ring-2 focus:ring-blue-500 outline-none resize-none"
                  ></textarea>
                </div>
                <div className="space-y-1">
                  <label className="text-xs font-bold text-gray-500 uppercase">Image URL (optionnel)</label>
                  <input 
                    type="text" value={formData.image} 
                    onChange={e => setFormData({...formData, image: e.target.value})}
                    className="w-full px-4 py-2 rounded-xl border border-gray-200 focus:ring-2 focus:ring-blue-500 outline-none" 
                  />
                </div>
                <div className="flex gap-4 pt-4">
                  <button type="button" onClick={() => setIsModalOpen(false)} className="flex-1 py-3 bg-gray-100 text-gray-600 font-bold rounded-xl">Annuler</button>
                  <button type="submit" className="flex-1 py-3 bg-blue-600 text-white font-bold rounded-xl">Enregistrer</button>
                </div>
              </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
};

const Login = () => {
  const navigate = useNavigate();
  const { user, isAdmin } = useAppContext();
  const [error, setError] = useState("");
  const [mfaRequired, setMfaRequired] = useState(false);
  const [resolver, setResolver] = useState<any>(null);
  const [verificationCode, setVerificationCode] = useState("");
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (user && isAdmin) navigate('/admin-dashboard');
  }, [user, isAdmin, navigate]);

  const handleLogin = async () => {
    setLoading(true);
    setError("");
    try {
      const provider = new GoogleAuthProvider();
      await signInWithPopup(auth, provider);
    } catch (err: any) {
      if (err.code === 'auth/multi-factor-auth-required') {
        const mfaResolver = getMultiFactorResolver(auth, err);
        setResolver(mfaResolver);
        setMfaRequired(true);
      } else if (err.code === 'auth/unauthorized-domain') {
        setError("Ce domaine n'est pas autorisé dans la console Firebase. Veuillez ajouter votre URL Vercel dans 'Authentication > Settings > Authorized domains'.");
      } else {
        console.error("Login error:", err);
        setError(err.message);
      }
    } finally {
      setLoading(false);
    }
  };

  const handleMfaSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError("");
    try {
      const assertion = TotpMultiFactorGenerator.assertionForSignIn(resolver, verificationCode);
      await resolver.resolveSignIn(assertion);
    } catch (err: any) {
      console.error("MFA Error:", err);
      setError("Code invalide ou erreur MFA.");
    } finally {
      setLoading(false);
    }
  };

  if (mfaRequired) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50 px-4">
        <div className="max-w-md w-full bg-white p-10 rounded-3xl shadow-xl border border-gray-100 text-center">
          <div className="w-20 h-20 bg-blue-600 rounded-2xl flex items-center justify-center mx-auto mb-8 text-white shadow-lg">
            <ShieldCheck size={40} />
          </div>
          <h1 className="text-2xl font-bold text-gray-900 mb-2">Double Authentification</h1>
          <p className="text-gray-500 mb-8">Veuillez entrer le code de sécurité généré par votre application d'authentification.</p>
          <form onSubmit={handleMfaSubmit} className="space-y-4">
            <input 
              type="text" 
              placeholder="Code de sécurité" 
              value={verificationCode}
              onChange={(e) => setVerificationCode(e.target.value)}
              className="w-full px-4 py-4 rounded-xl border border-gray-200 focus:ring-2 focus:ring-blue-500 outline-none text-center text-2xl tracking-widest font-mono"
              maxLength={6}
              required
            />
            {error && <p className="text-red-500 text-sm">{error}</p>}
            <button 
              type="submit"
              disabled={loading}
              className="w-full py-4 bg-blue-600 text-white font-bold rounded-xl hover:bg-blue-700 transition-all shadow-lg disabled:opacity-50"
            >
              {loading ? "Vérification..." : "Vérifier"}
            </button>
            <button 
              type="button"
              onClick={() => setMfaRequired(false)}
              className="text-sm text-gray-400 hover:text-blue-600 transition-colors"
            >
              Annuler
            </button>
          </form>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50 px-4">
      <div className="max-w-md w-full bg-white p-10 rounded-3xl shadow-xl border border-gray-100 text-center">
        <div className="w-20 h-20 bg-blue-600 rounded-2xl flex items-center justify-center mx-auto mb-8 text-white shadow-lg">
          <ShieldCheck size={40} />
        </div>
        <h1 className="text-2xl font-bold text-gray-900 mb-2">Accès Administrateur</h1>
        <p className="text-gray-500 mb-8">Connectez-vous pour gérer votre boutique SADEKH DIGITAL.</p>
        <button 
          onClick={handleLogin}
          disabled={loading}
          className="w-full py-4 bg-white border border-gray-200 hover:bg-gray-50 text-gray-700 font-bold rounded-xl transition-all flex items-center justify-center gap-3 shadow-sm disabled:opacity-50"
        >
          <img src="https://www.gstatic.com/firebasejs/ui/2.0.0/images/auth/google.svg" alt="Google" className="w-6 h-6" />
          {loading ? "Connexion..." : "Se connecter avec Google"}
        </button>
        {error && <p className="text-red-500 text-sm mt-4">{error}</p>}
        <Link to="/" className="block mt-8 text-sm text-gray-400 hover:text-blue-600 transition-colors">Retour au site</Link>
      </div>
    </div>
  );
};

// --- Providers ---

const AppProvider = ({ children }: { children: React.ReactNode }) => {
  const [settings, setSettings] = useState<ShopSettings | null>(null);
  const [categories, setCategories] = useState<Category[]>([]);
  const [services, setServices] = useState<Service[]>([]);
  const [orders, setOrders] = useState<Order[]>([]);
  const [orderItems, setOrderItems] = useState<OrderItem[]>([]);
  const [user, setUser] = useState<User | null>(null);
  const [isAdmin, setIsAdmin] = useState(false);
  const [loading, setLoading] = useState(true);

  // Connection test
  useEffect(() => {
    const testConnection = async () => {
      try {
        await getDocsFromServer(query(collection(db, 'settings'), limit(1)));
        console.log("Firestore connection verified.");
      } catch (error) {
        if (error instanceof Error && error.message.includes('the client is offline')) {
          console.error("Please check your Firebase configuration. The client appears to be offline.");
        }
      }
    };
    testConnection();
  }, []);

  useEffect(() => {
    // Auth
    const unsubAuth = onAuthStateChanged(auth, async (u) => {
      setUser(u);
      if (u) {
        // Check admin role
        let isAdminRole = false;
        try {
          const userDoc = await getDoc(doc(db, 'users', u.uid));
          isAdminRole = userDoc.data()?.role === 'admin';
        } catch (e) {
          console.warn("Could not fetch user role (likely rules not deployed):", e);
        }
        const isDefaultAdmin = u.email === "djahfarsadekh2015@gmail.com";
        setIsAdmin(isDefaultAdmin || isAdminRole);
      } else {
        setIsAdmin(false);
      }
      setLoading(false);
    });

    // Bootstrap data if empty
    const bootstrap = async () => {
      if (loading) return;
      
      try {
        const settingsDoc = await getDoc(doc(db, 'settings', 'global'));
        
        // Only attempt to seed if data is missing AND user is admin
        if (!settingsDoc.exists() && isAdmin) {
          try {
            await setDoc(doc(db, 'settings', 'global'), {
              shop_name: 'SADEKH DIGITAL ET GRAPHIQUE',
              whatsapp_number: '221770000000',
              description: "L'expertise créative au service de votre réussite commerciale.",
              email: "contact@sadekh.com",
              address: "Dakar, Sénégal"
            });

            const cats = [
              { id: 'cat1', name: 'Identité Visuelle & Graphisme' },
              { id: 'cat2', name: 'Solutions Digitales & E-commerce' },
              { id: 'cat3', name: 'Stratégie de Vente & Conseil' }
            ];
            for (const cat of cats) {
              await setDoc(doc(db, 'categories', cat.id), { name: cat.name });
            }

            const initialServices = [
              { name: 'Création Logo Professionnel', price: 25000, category: 'cat1', description: 'Un logo unique qui reflète l\'identité de votre marque.' },
              { name: 'Création Site Web Vitrine', price: 150000, category: 'cat2', description: 'Un site web moderne et responsive pour présenter votre activité.' },
              { name: 'Optimisation Boutique Shopify', price: 75000, category: 'cat2', description: 'Améliorez vos conversions avec une boutique optimisée.' },
              { name: 'Tunnel de Vente Complet', price: 100000, category: 'cat3', description: 'Un système automatisé pour transformer vos prospects en clients.' }
            ];
            for (const s of initialServices) {
              await addDoc(collection(db, 'services'), {
                ...s,
                created_at: new Date().toISOString()
              });
            }
            console.log("Bootstrap successful");
          } catch (err) {
            handleFirestoreError(err, OperationType.WRITE, 'bootstrap');
          }
        }
      } catch (e) {
        // Only log if it's not a permission error for non-admins
        if (isAdmin) {
          console.error("Bootstrap error:", e);
        }
      }
    };
    
    if (!loading) {
      bootstrap();
    }

    // Settings
    const unsubSettings = onSnapshot(doc(db, 'settings', 'global'), (doc) => {
      if (doc.exists()) {
        setSettings({ id: doc.id, ...doc.data() } as ShopSettings);
      } else {
        // Default settings if none exist
        setSettings({
          id: 'global',
          shop_name: 'SADEKH DIGITAL ET GRAPHIQUE',
          whatsapp_number: '221770000000',
          description: "L'expertise créative au service de votre réussite commerciale."
        });
      }
    }, (err) => handleFirestoreError(err, OperationType.GET, 'settings/global'));

    // Categories
    const unsubCategories = onSnapshot(collection(db, 'categories'), (snap) => {
      setCategories(snap.docs.map(d => ({ id: d.id, ...d.data() } as Category)));
    }, (err) => handleFirestoreError(err, OperationType.LIST, 'categories'));

    // Services
    const unsubServices = onSnapshot(query(collection(db, 'services'), orderBy('created_at', 'desc')), (snap) => {
      setServices(snap.docs.map(d => ({ id: d.id, ...d.data() } as Service)));
    }, (err) => handleFirestoreError(err, OperationType.LIST, 'services'));

    // Orders (Admin only)
    let unsubOrders = () => {};
    if (isAdmin) {
      unsubOrders = onSnapshot(query(collection(db, 'orders'), orderBy('created_at', 'desc')), (snap) => {
        setOrders(snap.docs.map(d => ({ id: d.id, ...d.data() } as Order)));
      }, (err) => handleFirestoreError(err, OperationType.LIST, 'orders'));
    }

    return () => {
      unsubAuth();
      unsubSettings();
      unsubCategories();
      unsubServices();
      unsubOrders();
    };
  }, [isAdmin]);

  return (
    <AppContext.Provider value={{ settings, categories, services, orders, user, isAdmin, loading }}>
      {children}
    </AppContext.Provider>
  );
};

const CartProvider = ({ children }: { children: React.ReactNode }) => {
  const [cart, setCart] = useState<CartItem[]>([]);

  const addToCart = (service: Service) => {
    setCart(prev => {
      const existing = prev.find(item => item.service.id === service.id);
      if (existing) {
        return prev.map(item => item.service.id === service.id ? { ...item, quantity: item.quantity + 1 } : item);
      }
      return [...prev, { service, quantity: 1 }];
    });
  };

  const removeFromCart = (serviceId: string) => {
    setCart(prev => prev.filter(item => item.service.id !== serviceId));
  };

  const updateQuantity = (serviceId: string, quantity: number) => {
    if (quantity < 1) return;
    setCart(prev => prev.map(item => item.service.id === serviceId ? { ...item, quantity } : item));
  };

  const clearCart = () => setCart([]);

  const total = cart.reduce((acc, item) => acc + (item.service.price * item.quantity), 0);

  return (
    <CartContext.Provider value={{ cart, addToCart, removeFromCart, updateQuantity, clearCart, total }}>
      {children}
    </CartContext.Provider>
  );
};

// --- Main App ---

export default function App() {
  return (
    <AppProvider>
      <CartProvider>
        <Router>
          <div className="min-h-screen flex flex-col font-sans text-gray-900">
            <Navbar />
            <main className="flex-grow">
              <Routes>
                <Route path="/" element={<Home />} />
                <Route path="/services" element={<Services />} />
                <Route path="/cart" element={<Cart />} />
                <Route path="/contact" element={<Contact />} />
                <Route path="/about" element={<About />} />
                <Route path="/policies" element={<Policies />} />
                <Route path="/admin-dashboard" element={<AdminDashboard />} />
                <Route path="/login" element={<Login />} />
              </Routes>
            </main>
            <Footer />
          </div>
        </Router>
      </CartProvider>
    </AppProvider>
  );
}
