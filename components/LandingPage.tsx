import React, { useState, useRef, useEffect } from 'react';
import { AppTab } from '../types';
import AuthModal from './AuthModal';
import { useAuth } from '../contexts/AuthContext';
import { Plane, FileText, CloudUpload, Clock, Menu, X, ChevronRight, Shield, CheckCircle2, Grid3x3 } from 'lucide-react';
import { motion } from 'framer-motion';

interface LandingPageProps {
  onStart: (tab?: AppTab) => void;
}

const LandingPage: React.FC<LandingPageProps> = ({ onStart }) => {
  const { user } = useAuth();
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const [showAuthModal, setShowAuthModal] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

  // Close menu when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(event.target as Node)) {
        setIsMenuOpen(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const menuItems = [
    { id: 'dashboard', label: 'Scanner Dashboard', icon: Grid3x3, desc: 'Main logbook digitization tool' },
    { id: 'permanent-log', label: 'Permanent Log', icon: FileText, desc: 'View and export saved entries' },
    { id: 'aircraft', label: 'Aircraft Profiles', icon: Plane, desc: 'Manage your fleet details' },
    { id: 'stats', label: 'Currency & Stats', icon: Clock, desc: 'Track hours and proficiency' },
    { id: 'tutorial', label: 'App Tutorial', icon: FileText, desc: 'Learn how to use LogExtract' },
  ];

  const containerVariants = {
    hidden: { opacity: 0 },
    visible: {
      opacity: 1,
      transition: {
        staggerChildren: 0.1
      }
    }
  };

  const itemVariants = {
    hidden: { y: 20, opacity: 0 },
    visible: {
      y: 0,
      opacity: 1,
      transition: {
        duration: 0.5
      }
    }
  };

  return (
    <div className="min-h-screen flex flex-col bg-[#F4F7FA]">
      {/* Background decoration - subtle blue gradient */}
      <div className="absolute top-0 left-1/2 -translate-x-1/2 w-full h-[600px] bg-gradient-to-b from-[#007BFF]/10 to-transparent blur-[120px] pointer-events-none rounded-full"></div>
      
      {/* Navigation Bar with Glassmorphism */}
      <nav className="relative z-50 px-6 py-6 md:px-12 backdrop-blur-md bg-white/70 border-b border-[#E2E8F0] shadow-sm">
        <div className="max-w-7xl mx-auto flex justify-between items-center">
          <motion.div 
            className="flex items-center gap-3 cursor-pointer group"
            onClick={() => window.scrollTo({ top: 0, behavior: 'smooth' })}
            whileHover={{ scale: 1.02 }}
            transition={{ type: "spring", stiffness: 400, damping: 17 }}
          >
            <div className="bg-[#003366] p-2.5 rounded-xl shadow-lg shadow-[#003366]/20 group-hover:shadow-[#003366]/30 transition-all">
              <Plane className="w-5 h-5 text-white" />
            </div>
            <span className="text-2xl font-black text-[#003366] tracking-tight">LogExtract</span>
          </motion.div>

          <div className="flex items-center gap-4">
            {user ? (
              <button
                onClick={() => onStart('permanent-log')}
                className="hidden sm:flex items-center gap-2 px-5 py-2.5 bg-[#007BFF]/10 hover:bg-[#007BFF]/20 border border-[#007BFF]/30 text-[#007BFF] rounded-xl font-semibold transition-all text-sm"
              >
                <FileText className="w-4 h-4" />
                My Log
              </button>
            ) : (
              <button
                onClick={() => setShowAuthModal(true)}
                className="hidden sm:flex items-center gap-2 px-5 py-2.5 bg-[#007BFF]/10 hover:bg-[#007BFF]/20 border border-[#007BFF]/30 text-[#007BFF] rounded-xl font-semibold transition-all text-sm"
              >
                Sign In
              </button>
            )}
            
            <div className="relative" ref={menuRef}>
              <button 
                onClick={() => setIsMenuOpen(!isMenuOpen)}
                className="flex items-center gap-2 px-5 py-2.5 bg-white/80 hover:bg-white border border-[#E2E8F0] text-[#003366] rounded-xl font-semibold transition-all text-sm shadow-sm"
              >
                <Menu className="w-4 h-4" />
                Navigation
              </button>

              {isMenuOpen && (
                <motion.div
                  initial={{ opacity: 0, y: -10 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -10 }}
                  className="absolute right-0 mt-3 w-72 bg-white/90 backdrop-blur-md border border-[#E2E8F0] rounded-2xl shadow-xl overflow-hidden z-[100]"
                >
                  <div className="p-3 bg-[#F4F7FA] border-b border-[#E2E8F0]">
                    <span className="text-[10px] font-bold uppercase tracking-widest text-[#003366]/60 px-3">Quick Access</span>
                  </div>
                  <div className="p-2 space-y-1">
                    <button 
                      onClick={() => { setIsMenuOpen(false); window.scrollTo({ top: 0, behavior: 'smooth' }); }}
                      className="w-full flex items-center gap-3 px-3 py-3 rounded-xl hover:bg-[#F4F7FA] transition-colors text-left group"
                    >
                      <div className="w-10 h-10 bg-[#F4F7FA] rounded-xl flex items-center justify-center text-[#003366]/60 group-hover:bg-[#007BFF] group-hover:text-white transition-all">
                        <Plane className="w-5 h-5" />
                      </div>
                      <div>
                        <div className="text-sm font-semibold text-[#003366]">Home Page</div>
                        <div className="text-[10px] text-[#003366]/60">Back to overview</div>
                      </div>
                    </button>
                    
                    {menuItems.map((item) => {
                      const ItemIcon = item.icon;
                      return (
                        <motion.button
                          key={item.id}
                          onClick={() => { setIsMenuOpen(false); onStart(item.id as AppTab); }}
                          className="w-full flex items-center gap-3 px-3 py-3 rounded-xl hover:bg-[#F4F7FA] transition-colors text-left group"
                          whileHover={{ x: 4 }}
                          transition={{ type: "spring", stiffness: 400, damping: 17 }}
                        >
                          <div className="w-10 h-10 bg-[#F4F7FA] rounded-xl flex items-center justify-center text-[#003366]/60 group-hover:bg-[#007BFF] group-hover:text-white transition-all">
                            <ItemIcon className="w-5 h-5" />
                          </div>
                          <div>
                            <div className="text-sm font-semibold text-[#003366]">{item.label}</div>
                            <div className="text-[10px] text-[#003366]/60">{item.desc}</div>
                          </div>
                        </motion.button>
                      );
                    })}
                  </div>
                </motion.div>
              )}
            </div>

            <motion.button
              onClick={() => onStart('dashboard')}
              className="hidden sm:block px-6 py-2.5 bg-[#003366] hover:bg-[#003366]/90 text-white rounded-xl font-semibold transition-all text-sm shadow-lg shadow-[#003366]/20 shiny-button"
              whileHover={{ scale: 1.05 }}
              whileTap={{ scale: 0.95 }}
            >
              Start Scanning
            </motion.button>
          </div>
        </div>
      </nav>

      {/* Hero Section */}
      <main className="relative z-10 flex-1 flex flex-col items-center justify-center text-center px-6 max-w-5xl mx-auto py-20">
        <motion.h1
          initial={{ opacity: 0, y: 30 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.7, delay: 0.1 }}
          className="text-5xl md:text-7xl font-black text-[#003366] tracking-tight mb-8 leading-[1.1]"
        >
          Your Physical Logbook, <br />
          <span className="bg-gradient-to-r from-[#007BFF] to-[#003366] bg-clip-text text-transparent">
            Digitized in Seconds.
          </span>
        </motion.h1>
        
        <motion.p
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.7, delay: 0.2 }}
          className="text-[#003366]/70 text-lg md:text-xl max-w-2xl mb-12 leading-relaxed"
        >
          The most advanced AI pilot logbook converter. Scan your handwritten pages and export perfectly formatted CSVs for ForeFlight, Logbook Pro, and more.
        </motion.p>

        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.7, delay: 0.3 }}
          className="flex flex-col sm:flex-row gap-4"
        >
          <motion.button
            onClick={() => onStart('dashboard')}
            className="px-10 py-5 bg-[#003366] hover:bg-[#003366]/90 text-white rounded-2xl font-black text-lg transition-all shadow-2xl shadow-[#003366]/30 flex items-center gap-3 group shiny-button"
            whileHover={{ scale: 1.05 }}
            whileTap={{ scale: 0.95 }}
          >
            Start Digitizing Now
            <ChevronRight className="w-5 h-5 group-hover:translate-x-1 transition-transform" />
          </motion.button>
          <motion.button
            onClick={() => onStart('tutorial')}
            className="px-10 py-5 bg-white border-2 border-[#E2E8F0] text-[#003366] hover:border-[#007BFF] rounded-2xl font-semibold text-lg transition-all shadow-sm flex items-center gap-3"
            whileHover={{ scale: 1.05 }}
            whileTap={{ scale: 0.95 }}
          >
            <FileText className="w-5 h-5" />
            View App Tutorial
          </motion.button>
        </motion.div>

        {/* Feature Grid */}
        <motion.div
          variants={containerVariants}
          initial="hidden"
          animate="visible"
          className="grid grid-cols-1 md:grid-cols-3 gap-6 w-full mt-32 text-left"
        >
          <motion.div
            variants={itemVariants}
            className="p-8 bg-white/80 backdrop-blur-sm border border-[#E2E8F0] rounded-2xl hover:bg-white hover:shadow-lg transition-all group"
          >
            <div className="w-12 h-12 bg-[#007BFF]/10 text-[#007BFF] rounded-2xl flex items-center justify-center mb-6 group-hover:scale-110 transition-transform">
              <Shield className="w-6 h-6" />
            </div>
            <h3 className="text-xl font-bold text-[#003366] mb-3 tracking-tight">AI Handwriting Engine</h3>
            <p className="text-[#003366]/70 text-sm leading-relaxed">
              Built on Gemini 3 Pro, LogExtract understands messy handwriting, ink smears, and pilot shorthand with superhuman accuracy.
            </p>
          </motion.div>

          <motion.div
            variants={itemVariants}
            className="p-8 bg-white/80 backdrop-blur-sm border border-[#E2E8F0] rounded-2xl hover:bg-white hover:shadow-lg transition-all group"
          >
            <div className="w-12 h-12 bg-[#007BFF]/10 text-[#007BFF] rounded-2xl flex items-center justify-center mb-6 group-hover:scale-110 transition-transform">
              <CheckCircle2 className="w-6 h-6" />
            </div>
            <h3 className="text-xl font-bold text-[#003366] mb-3 tracking-tight">ForeFlight Validated</h3>
            <p className="text-[#003366]/70 text-sm leading-relaxed">
              Our export engine produces structured CSVs that match the ForeFlight Import V2 standard exactly. No manual cleanup needed.
            </p>
          </motion.div>

          <motion.div
            variants={itemVariants}
            className="p-8 bg-white/80 backdrop-blur-sm border border-[#E2E8F0] rounded-2xl hover:bg-white hover:shadow-lg transition-all group"
          >
            <div className="w-12 h-12 bg-[#007BFF]/10 text-[#007BFF] rounded-2xl flex items-center justify-center mb-6 group-hover:scale-110 transition-transform">
              <CloudUpload className="w-6 h-6" />
            </div>
            <h3 className="text-xl font-bold text-[#003366] mb-3 tracking-tight">Spread Support</h3>
            <p className="text-[#003366]/70 text-sm leading-relaxed">
              Upload left and right pages together. LogExtract correlates the columns across the spine to stitch entries into a single flight.
            </p>
          </motion.div>
        </motion.div>

        {/* Floating background airplane icon */}
        <div className="absolute -bottom-20 -right-20 text-[#007BFF]/5 rotate-[-15deg] pointer-events-none hidden md:block">
          <Plane className="w-[600px] h-[600px]" />
        </div>
      </main>

      <footer className="relative z-10 p-12 text-center text-[#003366]/60 text-xs border-t border-[#E2E8F0] bg-white/50 backdrop-blur-sm">
        <div className="max-w-7xl mx-auto flex flex-col md:flex-row justify-between items-center gap-6">
          <div className="flex items-center gap-2">
            <div className="bg-[#003366] p-1.5 rounded-md">
              <Plane className="w-4 h-4 text-white" />
            </div>
            <span className="font-bold text-[#003366]">LOGEXTRACT</span>
          </div>
          <div className="flex gap-8">
            <a href="/PRIVACY_POLICY.md" target="_blank" rel="noopener noreferrer" className="hover:text-[#007BFF] transition-colors">Privacy Policy</a>
            <a href="/TERMS_OF_SERVICE.md" target="_blank" rel="noopener noreferrer" className="hover:text-[#007BFF] transition-colors">Terms of Service</a>
          </div>
          <p>© {new Date().getFullYear()} LogExtract Technologies. All rights reserved.</p>
        </div>
      </footer>

      {/* Auth Modal */}
      <AuthModal isOpen={showAuthModal} onClose={() => setShowAuthModal(false)} />
    </div>
  );
};

export default LandingPage;
