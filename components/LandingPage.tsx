import React, { useState, useRef, useEffect } from 'react';
import { AppTab } from '../types';
import AuthModal from './AuthModal';
import SupportRequestModal from './SupportRequestModal';
import SoftwareApplicationSchema from './SoftwareApplicationSchema';
import Logo from './Logo';
import { useAuth } from '../contexts/AuthContext';
import { useMobile } from '../utils/useMobile';
import { supabase } from '../lib/supabase';
import { Plane, FileText, CloudUpload, Clock, Menu, X, ChevronRight, Shield, CheckCircle2, Grid3x3, MessageSquare, Star, HelpCircle } from 'lucide-react';
import { motion } from 'framer-motion';

interface Review {
  id: string;
  reviewer_name: string;
  rating: number;
  review_text: string;
  pilot_ratings?: string | null;
  created_at: string;
}

interface LandingPageProps {
  onStart: (tab?: AppTab) => void;
}

const LandingPage: React.FC<LandingPageProps> = ({ onStart }) => {
  const { user } = useAuth();
  const isMobile = useMobile();
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const [showAuthModal, setShowAuthModal] = useState(false);
  const [showPrivacyModal, setShowPrivacyModal] = useState(false);
  const [showTermsModal, setShowTermsModal] = useState(false);
  const [showSupportModal, setShowSupportModal] = useState(false);
  const [featuredReviews, setFeaturedReviews] = useState<Review[]>([]);
  const [loadingReviews, setLoadingReviews] = useState(true);
  const menuRef = useRef<HTMLDivElement>(null);

  // Load featured reviews (top 3 highest rated, most recent)
  useEffect(() => {
    const loadFeaturedReviews = async () => {
      try {
        setLoadingReviews(true);
        let { data, error } = await supabase
          .from('reviews')
          .select('id, reviewer_name, rating, review_text, pilot_ratings, created_at')
          .eq('approved', true)
          .eq('featured', true)
          .order('created_at', { ascending: false })
          .limit(3);

        if (error && (error.message?.includes('featured') || error.code === '42703')) {
          const fallback = await supabase
            .from('reviews')
            .select('id, reviewer_name, rating, review_text, pilot_ratings, created_at')
            .eq('approved', true)
            .order('rating', { ascending: false })
            .order('created_at', { ascending: false })
            .limit(3);
          if (fallback.error) throw fallback.error;
          setFeaturedReviews(fallback.data || []);
        } else {
          if (error) throw error;
          setFeaturedReviews(data || []);
        }
      } catch (error) {
        console.error('Error loading featured reviews:', error);
      } finally {
        setLoadingReviews(false);
      }
    };

    loadFeaturedReviews();
  }, []);

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
    { id: 'tutorial', label: 'App Tutorial', icon: FileText, desc: 'Learn how to use LogExtract' },
    { id: 'reviews', label: 'Reviews', icon: MessageSquare, desc: 'See what pilots are saying' },
  ];
  // On mobile only: hide Permanent Log and Aircraft Profiles from nav
  const navItems = isMobile ? menuItems.filter((i) => i.id !== 'permanent-log' && i.id !== 'aircraft') : menuItems;

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
    <div className="min-h-screen flex flex-col bg-[#F4F7FA] overflow-x-hidden">
      <SoftwareApplicationSchema />
      {/* Background decoration - subtle blue gradient */}
      <div className="absolute top-0 left-1/2 -translate-x-1/2 w-full h-[600px] bg-gradient-to-b from-[#007BFF]/10 to-transparent blur-[120px] pointer-events-none rounded-full"></div>
      
      {/* Mobile Notice Banner - Only visible on mobile */}
      <div className="relative z-50 bg-[#007BFF]/10 border-b border-[#007BFF]/20 px-4 py-2 text-center md:hidden">
        <p className="text-xs text-[#003366]/80 font-medium">
          💻 Best on desktop
        </p>
      </div>
      
      {/* Navigation Bar with Glassmorphism */}
      <nav className="relative z-50 px-4 sm:px-6 py-6 md:px-12 backdrop-blur-md bg-white/70 border-b border-[#E2E8F0] shadow-sm">
        <div className="max-w-7xl mx-auto flex justify-between items-center">
          <motion.div 
            className="flex items-center gap-3 cursor-pointer group"
            onClick={() => window.scrollTo({ top: 0, behavior: 'smooth' })}
            whileHover={{ scale: 1.02 }}
            transition={{ type: "spring", stiffness: 400, damping: 17 }}
            role="button"
            aria-label="Go to top of page"
            tabIndex={0}
            onKeyDown={(e) => {
              if (e.key === 'Enter' || e.key === ' ') {
                window.scrollTo({ top: 0, behavior: 'smooth' });
              }
            }}
          >
            <Logo size={32} />
            <span className="text-2xl font-black text-[#003366] tracking-tight">LogExtract</span>
          </motion.div>

          <div className="flex items-center gap-4">
            {/* My Log only on desktop (Permanent Log not on mobile); Sign In on both */}
            {isMobile ? (
              !user && (
                <button
                  onClick={() => setShowAuthModal(true)}
                  className="flex items-center gap-2 px-5 py-2.5 bg-[#007BFF]/10 hover:bg-[#007BFF]/20 border border-[#007BFF]/30 text-[#007BFF] rounded-xl font-semibold transition-all text-sm min-h-[48px] min-w-[48px]"
                  aria-label="Sign in to your account"
                >
                  Sign In
                </button>
              )
            ) : user ? (
              <button
                onClick={() => onStart('permanent-log')}
                className="flex items-center gap-2 px-5 py-2.5 bg-[#007BFF]/10 hover:bg-[#007BFF]/20 border border-[#007BFF]/30 text-[#007BFF] rounded-xl font-semibold transition-all text-sm min-h-[48px] min-w-[48px]"
                aria-label="View permanent log"
              >
                <FileText className="w-4 h-4" aria-hidden="true" />
                My Log
              </button>
            ) : (
              <button
                onClick={() => setShowAuthModal(true)}
                className="flex items-center gap-2 px-5 py-2.5 bg-[#007BFF]/10 hover:bg-[#007BFF]/20 border border-[#007BFF]/30 text-[#007BFF] rounded-xl font-semibold transition-all text-sm min-h-[48px] min-w-[48px]"
                aria-label="Sign in to your account"
              >
                Sign In
              </button>
            )}
            
            <div className="relative" ref={menuRef}>
              <button 
                onClick={() => setIsMenuOpen(!isMenuOpen)}
                className="flex items-center gap-2 px-5 py-2.5 bg-white/80 hover:bg-white border border-[#E2E8F0] text-[#003366] rounded-xl font-semibold transition-all text-sm shadow-sm min-h-[48px] min-w-[48px]"
                aria-label="Open navigation menu"
                aria-expanded={isMenuOpen}
                aria-haspopup="true"
              >
                <Menu className="w-4 h-4" aria-hidden="true" />
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
                      className="w-full flex items-center gap-3 px-3 py-3 rounded-xl hover:bg-[#F4F7FA] transition-colors text-left group min-h-[48px]"
                      aria-label="Go to home page"
                    >
                      <div className="w-10 h-10 bg-[#F4F7FA] rounded-xl flex items-center justify-center text-[#003366]/60 group-hover:bg-[#007BFF] group-hover:text-white transition-all min-w-[48px] min-h-[48px]">
                        <Plane className="w-5 h-5" aria-hidden="true" />
                      </div>
                      <div>
                        <div className="text-sm font-semibold text-[#003366]">Home Page</div>
                        <div className="text-[10px] text-[#003366]/60">Back to overview</div>
                      </div>
                    </button>
                    
                    {navItems.map((item) => {
                      const ItemIcon = item.icon;
                      return (
                        <motion.button
                          key={item.id}
                          onClick={() => { setIsMenuOpen(false); onStart(item.id as AppTab); }}
                          className="w-full flex items-center gap-3 px-3 py-3 rounded-xl hover:bg-[#F4F7FA] transition-colors text-left group min-h-[48px]"
                          whileHover={{ x: 4 }}
                          transition={{ type: "spring", stiffness: 400, damping: 17 }}
                          aria-label={`Navigate to ${item.label}`}
                        >
                          <div className="w-10 h-10 bg-[#F4F7FA] rounded-xl flex items-center justify-center text-[#003366]/60 group-hover:bg-[#007BFF] group-hover:text-white transition-all min-w-[48px] min-h-[48px]">
                            <ItemIcon className="w-5 h-5" aria-hidden="true" />
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
              className="hidden sm:block px-6 py-2.5 bg-[#003366] hover:bg-[#003366]/90 text-white rounded-xl font-semibold transition-all text-sm shadow-lg shadow-[#003366]/20 shiny-button min-h-[48px] min-w-[48px]"
              whileHover={{ scale: 1.05 }}
              whileTap={{ scale: 0.95 }}
              aria-label="Start scanning logbook pages"
            >
              Start Scanning
            </motion.button>
          </div>
        </div>
      </nav>

      {/* Hero Section */}
      <main className="relative z-10 flex-1 flex flex-col items-center justify-center text-center px-4 sm:px-6 max-w-5xl mx-auto py-20">
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
          The most advanced pilot paper logbook converter. Scan your handwritten pages and export perfectly formatted CSVs for ForeFlight, Logbook Pro, and more.
        </motion.p>

        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.7, delay: 0.3 }}
          className="flex flex-col sm:flex-row gap-4 items-center justify-center"
        >
          {!user ? (
            <>
              <motion.button
                onClick={() => setShowAuthModal(true)}
                className="px-10 py-5 bg-[#003366] hover:bg-[#003366]/90 text-white rounded-2xl font-black text-lg transition-all shadow-2xl shadow-[#003366]/30 flex items-center gap-3 group shiny-button min-h-[48px]"
                whileHover={{ scale: 1.05 }}
                whileTap={{ scale: 0.95 }}
                aria-label="Create a free account"
              >
                Create Account - Start Free
                <ChevronRight className="w-5 h-5 group-hover:translate-x-1 transition-transform" aria-hidden="true" />
              </motion.button>
              <motion.button
                onClick={() => onStart('tutorial')}
                className="px-10 py-5 bg-white border-2 border-[#E2E8F0] text-[#003366] hover:border-[#007BFF] rounded-2xl font-semibold text-lg transition-all shadow-sm flex items-center gap-3 min-h-[48px]"
                whileHover={{ scale: 1.05 }}
                whileTap={{ scale: 0.95 }}
                aria-label="View app tutorial"
              >
                <FileText className="w-5 h-5" aria-hidden="true" />
                View App Tutorial
              </motion.button>
            </>
          ) : (
            <>
              <motion.button
                onClick={() => onStart('dashboard')}
                className="px-10 py-5 bg-[#003366] hover:bg-[#003366]/90 text-white rounded-2xl font-black text-lg transition-all shadow-2xl shadow-[#003366]/30 flex items-center gap-3 group shiny-button min-h-[48px]"
                whileHover={{ scale: 1.05 }}
                whileTap={{ scale: 0.95 }}
                aria-label="Start digitizing your logbook"
              >
                Start Digitizing Now
                <ChevronRight className="w-5 h-5 group-hover:translate-x-1 transition-transform" aria-hidden="true" />
              </motion.button>
              <motion.button
                onClick={() => onStart('tutorial')}
                className="px-10 py-5 bg-white border-2 border-[#E2E8F0] text-[#003366] hover:border-[#007BFF] rounded-2xl font-semibold text-lg transition-all shadow-sm flex items-center gap-3 min-h-[48px]"
                whileHover={{ scale: 1.05 }}
                whileTap={{ scale: 0.95 }}
                aria-label="View app tutorial"
              >
                <FileText className="w-5 h-5" aria-hidden="true" />
                View App Tutorial
              </motion.button>
            </>
          )}
        </motion.div>
        
        {!user && (
          <motion.p
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ duration: 0.7, delay: 0.5 }}
            className="text-[#003366]/60 text-sm mt-4"
          >
            No credit card required • 3 free credits to start
          </motion.p>
        )}

        {/* Feature Grid */}
        <motion.div
          variants={containerVariants}
          initial="hidden"
          animate="visible"
          className="grid grid-cols-1 md:grid-cols-3 gap-6 w-full mt-32 text-left px-4 sm:px-0"
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
              Built on our software, LogExtract understands messy handwriting, ink smears, and pilot shorthand with superhuman accuracy.
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
          <Plane className="w-[600px] h-[600px]" aria-hidden="true" />
        </div>
      </main>

      {/* CTA Section */}
      {!user && (
        <section className="relative z-10 py-16 md:py-20 px-4 sm:px-6 bg-gradient-to-br from-[#003366] to-[#007BFF]">
          <div className="max-w-4xl mx-auto text-center">
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ duration: 0.6 }}
            >
              <h2 className="text-3xl md:text-4xl font-black text-white mb-4 tracking-tight">
                Ready to Digitize Your Logbook?
              </h2>
              <p className="text-white/90 text-lg md:text-xl mb-8 max-w-2xl mx-auto">
                Join pilots who are saving hours of manual data entry. Create your free account and get started in seconds.
              </p>
              <div className="flex flex-col sm:flex-row gap-4 justify-center items-center">
                <motion.button
                  onClick={() => setShowAuthModal(true)}
                  className="px-10 py-5 bg-white hover:bg-white/90 text-[#003366] rounded-2xl font-black text-lg transition-all shadow-2xl shadow-black/20 flex items-center gap-3 group min-h-[48px]"
                  whileHover={{ scale: 1.05 }}
                  whileTap={{ scale: 0.95 }}
                  aria-label="Create a free account"
                >
                  Create Account - Start Free
                  <ChevronRight className="w-5 h-5 group-hover:translate-x-1 transition-transform" aria-hidden="true" />
                </motion.button>
                <motion.button
                  onClick={() => onStart('tutorial')}
                  className="px-10 py-5 bg-transparent border-2 border-white/30 text-white hover:border-white rounded-2xl font-semibold text-lg transition-all flex items-center gap-3 min-h-[48px]"
                  whileHover={{ scale: 1.05 }}
                  whileTap={{ scale: 0.95 }}
                  aria-label="Learn more about the app"
                >
                  <FileText className="w-5 h-5" aria-hidden="true" />
                  Learn How It Works
                </motion.button>
              </div>
              <p className="text-white/70 text-sm mt-6">
                No credit card required • 3 free credits included • Cancel anytime
              </p>
            </motion.div>
          </div>
        </section>
      )}

      {/* Featured Reviews Section */}
      {!loadingReviews && featuredReviews.length > 0 && (
        <section className="relative z-10 py-12 md:py-16 px-4 sm:px-6 bg-white border-t border-[#E2E8F0]">
          <div className="max-w-6xl mx-auto">
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ duration: 0.6 }}
              className="text-center mb-8"
            >
              <h2 className="text-2xl md:text-3xl font-black text-[#003366] mb-2 tracking-tight">
                What Pilots Say
              </h2>
              <p className="text-[#003366]/70 text-sm md:text-base">
                Real feedback from pilots using LogExtract
              </p>
            </motion.div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 md:gap-6">
              {featuredReviews.map((review, index) => (
                <motion.div
                  key={review.id}
                  initial={{ opacity: 0, y: 20 }}
                  whileInView={{ opacity: 1, y: 0 }}
                  viewport={{ once: true }}
                  transition={{ duration: 0.6, delay: index * 0.1 }}
                  className="bg-white/80 backdrop-blur-sm border border-[#E2E8F0] rounded-xl p-5 shadow-sm hover:shadow-md transition-all"
                >
                  <div className="flex items-center gap-2 mb-3">
                    <div className="flex gap-0.5">
                      {Array.from({ length: 5 }, (_, i) => (
                        <Star
                          key={i}
                          className={`w-4 h-4 ${
                            i < review.rating
                              ? 'text-amber-400 fill-amber-400'
                              : 'text-gray-300'
                          }`}
                        />
                      ))}
                    </div>
                  </div>
                  <p className="text-sm font-semibold text-[#003366] mb-2">
                    {review.reviewer_name}
                    {review.pilot_ratings && (
                      <span className="text-[#003366]/60 font-normal">
                        {' • '}{review.pilot_ratings}
                      </span>
                    )}
                  </p>
                  <p className="text-xs text-[#003366]/70 leading-relaxed line-clamp-4">
                    {review.review_text}
                  </p>
                </motion.div>
              ))}
            </div>

            <motion.div
              initial={{ opacity: 0 }}
              whileInView={{ opacity: 1 }}
              viewport={{ once: true }}
              transition={{ duration: 0.6, delay: 0.4 }}
              className="text-center mt-8"
            >
              <button
                onClick={() => onStart('reviews')}
                className="inline-flex items-center gap-2 px-6 py-2.5 bg-[#003366] hover:bg-[#003366]/90 text-white rounded-xl font-semibold transition-all shadow-lg shadow-[#003366]/20 text-sm min-h-[48px]"
                aria-label="View all reviews"
              >
                <MessageSquare className="w-4 h-4" />
                View All Reviews
              </button>
            </motion.div>
          </div>
        </section>
      )}

      {/* Founder's Note Section */}
      <section className="relative z-10 py-20 px-4 sm:px-6 bg-white/80 backdrop-blur-sm border-t border-[#E2E8F0]">
        <div className="max-w-4xl mx-auto">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.6 }}
            className="text-center mb-12"
          >
            <h2 className="text-3xl md:text-4xl font-black text-[#003366] mb-4 tracking-tight">
              Founder's Note
            </h2>
            <p className="text-[#003366]/70 text-lg max-w-2xl mx-auto">
              From one pilot to another
            </p>
          </motion.div>

          <motion.div
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.6, delay: 0.2 }}
            className="bg-white/80 backdrop-blur-sm border border-[#E2E8F0] rounded-2xl shadow-sm p-8 md:p-12"
          >
            <div className="flex flex-col md:flex-row items-start gap-6 mb-8 pb-8 border-b border-[#E2E8F0]">
              <div className="flex-shrink-0">
                <Logo size={120} />
              </div>
              <div className="flex-1">
                <h3 className="text-2xl font-bold text-[#003366] mb-2">Marcus</h3>
                <p className="text-[#003366]/70 font-semibold mb-4">Instrument Rated Pilot</p>
                <p className="text-[#003366]/70 text-sm leading-relaxed">
                  As an Instrument Rated Pilot, I understand the stakes of accurate record-keeping. Your logbook isn't just paperwork,it's your professional record, your proof of currency, and your ticket to advancement. I've sat across from examiners, submitted entries to insurance companies, and felt that weight of responsibility that comes with PIC authority.
                </p>
              </div>
            </div>

            <div className="space-y-6 text-[#003366]/80 leading-relaxed">
              <p className="text-base">
                LogExtract uses <strong className="text-[#003366] font-semibold">AI-Assisted Digitization</strong> to eliminate the manual data-entry fatigue that comes with converting paper logbooks. But make no mistake: <strong className="text-[#003366] font-semibold">you remain the Pilot-in-Command of your data</strong>. The AI extracts the information; you verify, validate, and maintain logbook integrity.
              </p>

              <p className="text-base">
                This tool is designed for checkride-ready accuracy. Every entry you review and approve maintains your PIC authority over your records. We provide <strong className="text-[#003366] font-semibold">high-precision extraction</strong>, but the final authority—the signature, the verification, the responsibility—remains yours.
              </p>

              <p className="text-base">
                I built LogExtract because I spent hours converting my own logbook, wrestling with messy handwriting and the constant worry about transcription errors. This software is designed to <strong className="text-[#003366] font-semibold">reduce data-entry fatigue</strong> while keeping you in control. Your logbook integrity matters. Your checkride readiness matters. Your PIC authority matters.
              </p>

              <p className="text-base font-semibold text-[#003366] pt-4 border-t border-[#E2E8F0]">
                Fly safe. Verify your data. Maintain your standards.
              </p>
            </div>
          </motion.div>
        </div>
      </section>

      <footer className="relative z-10 p-6 sm:p-12 text-center text-[#003366]/60 text-xs border-t border-[#E2E8F0] bg-white/50 backdrop-blur-sm">
        <div className="max-w-7xl mx-auto flex flex-col md:flex-row justify-between items-center gap-6 px-4 sm:px-0">
          <div className="flex items-center gap-2">
            <Logo size={20} />
            <span className="font-bold text-[#003366]">LOGEXTRACT</span>
          </div>
          <div className="flex gap-8 flex-wrap justify-center">
            <button 
              onClick={() => onStart('reviews')} 
              className="hover:text-[#007BFF] transition-colors min-h-[48px] min-w-[48px] px-2 font-semibold"
              aria-label="View reviews"
            >
              Reviews
            </button>
            <button 
              onClick={() => setShowPrivacyModal(true)} 
              className="hover:text-[#007BFF] transition-colors min-h-[48px] min-w-[48px] px-2"
              aria-label="View privacy policy"
            >
              Privacy Policy
            </button>
            <button 
              onClick={() => setShowTermsModal(true)} 
              className="hover:text-[#007BFF] transition-colors min-h-[48px] min-w-[48px] px-2"
              aria-label="View terms of service"
            >
              Terms of Service
            </button>
            <button 
              onClick={() => setShowSupportModal(true)} 
              className="hover:text-[#007BFF] transition-colors min-h-[48px] min-w-[48px] px-2 flex items-center gap-1.5"
              aria-label="Contact support"
            >
              <HelpCircle className="w-4 h-4" />
              Support
            </button>
          </div>
          <p>© {new Date().getFullYear()} LogExtract Technologies. All rights reserved.</p>
        </div>
      </footer>

      {/* Auth Modal */}
      <AuthModal isOpen={showAuthModal} onClose={() => setShowAuthModal(false)} />

      {/* Support Request Modal */}
      <SupportRequestModal isOpen={showSupportModal} onClose={() => setShowSupportModal(false)} />

      {/* Privacy Policy Modal */}
      {showPrivacyModal && (
        <div 
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-md"
          onClick={() => setShowPrivacyModal(false)}
        >
          <div 
            className="bg-white/90 backdrop-blur-md border border-[#E2E8F0] rounded-2xl p-8 w-full max-w-3xl max-h-[90vh] overflow-y-auto shadow-2xl"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between mb-6">
              <h2 className="text-2xl font-black text-[#003366]">Privacy Policy</h2>
              <button
                onClick={() => setShowPrivacyModal(false)}
                className="text-[#003366]/60 hover:text-[#003366] transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
            <div className="prose prose-sm max-w-none text-[#003366]">
              <p className="text-sm text-[#003366]/70 mb-4"><strong>Effective Date: January 23, 2026</strong></p>
              
              <h3 className="text-lg font-bold text-[#003366] mt-6 mb-3">Overview</h3>
              <p className="text-[#003366]/70 mb-6">
                This policy explains how LogExtract ("we," "us") handles your flight data when you use our digital logbook converter. We are committed to protecting the integrity of your professional record.
              </p>

              <h3 className="text-lg font-bold text-[#003366] mt-6 mb-3">Information We Collect</h3>
              <ul className="list-disc list-inside space-y-2 text-[#003366]/70 mb-6">
                <li><strong>Account Data</strong>: Name, email, and FAA/License certificate numbers (if provided).</li>
                <li><strong>Logbook Images</strong>: Photos or PDFs of your paper logbooks that you upload for digitization.</li>
                <li><strong>Extracted Flight Data</strong>: The structured data (Hours, PIC time, Aircraft Type, etc.) generated by our system.</li>
                <li><strong>Usage Data</strong>: Technical logs, IP addresses, and how you interact with our conversion tool.</li>
              </ul>

              <h3 className="text-lg font-bold text-[#003366] mt-6 mb-3">How We Use Your Data</h3>
              <ul className="list-disc list-inside space-y-2 text-[#003366]/70 mb-6">
                <li><strong>AI Processing</strong>: We use AI technology to interpret and extract data from your logbook images.</li>
                <li><strong>Service Delivery</strong>: To provide you with a structured digital file (CSV/Excel) compatible with major digital logbooks.</li>
                <li><strong>Payment</strong>: We use Stripe to process payments. We do not store your credit card details on our servers.</li>
              </ul>

              <h3 className="text-lg font-bold text-[#003366] mt-6 mb-3">Data Sharing & AI Disclosure</h3>
              <p className="text-[#003366]/70 mb-3">
                We do not sell your flight data. However, images are processed via AI technology.
              </p>
              <p className="text-[#003366]/70 mb-6">
                <strong>Note</strong>: Your data is used only for the purpose of extraction and is not used to train global AI models without your explicit consent.
              </p>

              <h3 className="text-lg font-bold text-[#003366] mt-6 mb-3">Your Rights</h3>
              <p className="text-[#003366]/70 mb-6">
                You may request the deletion of your uploaded images and extracted data at any time. Once deleted, this data cannot be recovered.
              </p>

              <h3 className="text-lg font-bold text-[#003366] mt-6 mb-3">Contact Us</h3>
              <p className="text-[#003366]/70">
                If you have questions about this Privacy Policy, please contact us through our support channels.
              </p>
            </div>
          </div>
        </div>
      )}

      {/* Terms of Service Modal */}
      {showTermsModal && (
        <div 
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-md"
          onClick={() => setShowTermsModal(false)}
        >
          <div 
            className="bg-white/90 backdrop-blur-md border border-[#E2E8F0] rounded-2xl p-8 w-full max-w-3xl max-h-[90vh] overflow-y-auto shadow-2xl"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between mb-6">
              <h2 className="text-2xl font-black text-[#003366]">Terms of Service</h2>
              <button
                onClick={() => setShowTermsModal(false)}
                className="text-[#003366]/60 hover:text-[#003366] transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
            <div className="prose prose-sm max-w-none text-[#003366]">
              <p className="text-sm text-[#003366]/70 mb-4"><strong>Last Updated: January 23, 2026</strong></p>
              
              <h3 className="text-lg font-bold text-[#003366] mt-6 mb-3">1. Acceptance of Terms</h3>
              <p className="text-[#003366]/70 mb-6">
                By uploading a logbook, you agree to these terms. You must be at least 18 years old and hold a valid pilot certificate or be a student pilot.
              </p>

              <h3 className="text-lg font-bold text-[#003366] mt-6 mb-3">2. The "PIC" Responsibility (Crucial)</h3>
              <p className="text-[#003366]/70 mb-3">
                LogExtract provides an AI-powered conversion tool. The Pilot in Command (PIC) remains the sole authority for the accuracy of their logbook under 14 CFR § 61.51.
              </p>
              <p className="text-[#003366]/70 mb-3">
                <strong>Our service is a digitization aid, not a certified record-keeping system.</strong>
              </p>
              <p className="text-[#003366]/70 mb-6">
                You must verify every entry generated by our AI against your original paper records before signing or submitting them for official FAA use (checkrides, insurance, etc.).
              </p>

              <h3 className="text-lg font-bold text-[#003366] mt-6 mb-3">3. Limitation of Liability</h3>
              <p className="text-[#003366]/70 mb-3">We are not liable for:</p>
              <ul className="list-disc list-inside space-y-2 text-[#003366]/70 mb-6">
                <li>Fines, license suspensions, or "709 rides" resulting from inaccurate digital entries.</li>
                <li>Denied insurance claims or job applications due to logbook discrepancies.</li>
                <li>Loss of data due to technical failure. Always keep your original paper logs.</li>
              </ul>

              <h3 className="text-lg font-bold text-[#003366] mt-6 mb-3">4. Billing & Credits</h3>
              <ul className="list-disc list-inside space-y-2 text-[#003366]/70 mb-6">
                <li><strong>Credit System</strong>: Conversions are charged per page or per entry as specified at the time of purchase.</li>
                <li><strong>Refunds</strong>: Credits are deducted only when you approve extraction results. If results are poor, discard and try again—no credit charged.</li>
              </ul>

              <h3 className="text-lg font-bold text-[#003366] mt-6 mb-3">5. Termination</h3>
              <p className="text-[#003366]/70 mb-6">
                We reserve the right to suspend accounts that attempt to "stress test" or reverse-engineer our AI extraction prompts or infrastructure.
              </p>

              <h3 className="text-lg font-bold text-[#003366] mt-6 mb-3">Contact Us</h3>
              <p className="text-[#003366]/70">
                If you have questions about these Terms of Service, please contact us through our support channels.
              </p>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default LandingPage;
