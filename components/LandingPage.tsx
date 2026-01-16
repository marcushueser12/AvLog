
import React, { useState, useRef, useEffect } from 'react';
import { ICONS } from '../constants';
import { AppTab } from '../types';

interface LandingPageProps {
  onStart: (tab?: AppTab) => void;
}

const LandingPage: React.FC<LandingPageProps> = ({ onStart }) => {
  const [isMenuOpen, setIsMenuOpen] = useState(false);
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
    { id: 'dashboard', label: 'Scanner Dashboard', icon: () => <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="3" width="7" height="7"/><rect x="14" y="3" width="7" height="7"/><rect x="14" y="14" width="7" height="7"/><rect x="3" y="14" width="7" height="7"/></svg>, desc: 'Main logbook digitization tool' },
    { id: 'aircraft', label: 'Aircraft Profiles', icon: ICONS.Aircraft, desc: 'Manage your fleet details' },
    { id: 'stats', label: 'Currency & Stats', icon: ICONS.Stats, desc: 'Track hours and proficiency' },
    { id: 'tutorial', label: 'App Tutorial', icon: () => <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20"/><path d="M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2z"/></svg>, desc: 'Learn how to use LogExtract' },
  ];

  return (
    <div className="min-h-screen flex flex-col bg-[#0f172a]">
      {/* Background decoration */}
      <div className="absolute top-0 left-1/2 -translate-x-1/2 w-full h-[600px] bg-blue-600/5 blur-[120px] pointer-events-none rounded-full"></div>
      
      {/* Nav (Reverted to original relative positioning and padding) */}
      <nav className="relative z-50 px-6 py-8 md:px-12 flex justify-between items-center max-w-7xl mx-auto w-full">
        <div 
          className="flex items-center gap-3 cursor-pointer group"
          onClick={() => window.scrollTo({ top: 0, behavior: 'smooth' })}
        >
          <div className="bg-blue-600 p-2 rounded-xl shadow-lg shadow-blue-500/20 group-hover:scale-110 transition-transform">
            <ICONS.Plane />
          </div>
          <span className="text-2xl font-black text-white tracking-tighter">LogExtract</span>
        </div>

        <div className="flex items-center gap-4">
            <div className="relative" ref={menuRef}>
                <button 
                    onClick={() => setIsMenuOpen(!isMenuOpen)}
                    className="flex items-center gap-2 px-5 py-2.5 bg-white/5 hover:bg-white/10 border border-white/10 text-white rounded-xl font-bold transition-all text-sm group"
                >
                    Navigation
                    <div className={`transition-transform duration-300 ${isMenuOpen ? 'rotate-180' : ''}`}>
                        <ICONS.ChevronDown />
                    </div>
                </button>

                {isMenuOpen && (
                    <div className="absolute right-0 mt-3 w-72 bg-slate-900 border border-slate-800 rounded-3xl shadow-2xl overflow-hidden animate-in fade-in zoom-in-95 slide-in-from-top-2 duration-200 z-[100]">
                        <div className="p-3 bg-slate-950/50 border-b border-slate-800">
                             <span className="text-[10px] font-black uppercase tracking-widest text-slate-500 px-3">Quick Access</span>
                        </div>
                        <div className="p-2 space-y-1">
                            <button 
                                onClick={() => { setIsMenuOpen(false); window.scrollTo({ top: 0, behavior: 'smooth' }); }}
                                className="w-full flex items-center gap-3 px-3 py-3 rounded-2xl hover:bg-slate-800 transition-colors text-left group"
                            >
                                <div className="w-10 h-10 bg-slate-800 rounded-xl flex items-center justify-center text-slate-400 group-hover:bg-blue-600 group-hover:text-white transition-all">
                                    <ICONS.Home />
                                </div>
                                <div>
                                    <div className="text-sm font-bold text-white">Home Page</div>
                                    <div className="text-[10px] text-slate-500">Back to overview</div>
                                </div>
                            </button>
                            
                            {menuItems.map((item) => {
                                const ItemIcon = item.icon;
                                return (
                                  <button 
                                      key={item.id}
                                      onClick={() => { setIsMenuOpen(false); onStart(item.id as AppTab); }}
                                      className="w-full flex items-center gap-3 px-3 py-3 rounded-2xl hover:bg-slate-800 transition-colors text-left group"
                                  >
                                      <div className="w-10 h-10 bg-slate-800 rounded-xl flex items-center justify-center text-slate-400 group-hover:bg-blue-600 group-hover:text-white transition-all">
                                          <ItemIcon />
                                      </div>
                                      <div>
                                          <div className="text-sm font-bold text-white">{item.label}</div>
                                          <div className="text-[10px] text-slate-500">{item.desc}</div>
                                      </div>
                                  </button>
                                );
                            })}
                        </div>
                    </div>
                )}
            </div>

            <button 
                onClick={() => onStart('dashboard')}
                className="hidden sm:block px-6 py-2.5 bg-blue-600 hover:bg-blue-500 text-white rounded-xl font-bold transition-all text-sm shadow-lg shadow-blue-600/20"
            >
                Start Scanning
            </button>
        </div>
      </nav>

      {/* Hero Section */}
      <main className="relative z-10 flex-1 flex flex-col items-center justify-center text-center px-6 max-w-5xl mx-auto py-20">
        <h1 className="text-5xl md:text-7xl font-black text-white tracking-tight mb-8 leading-[1.1] animate-in fade-in slide-in-from-bottom-8 duration-700 delay-100">
          Your Physical Logbook, <br />
          <span className="bg-gradient-to-r from-blue-400 to-emerald-400 bg-clip-text text-transparent">Digitized in Seconds.</span>
        </h1>
        
        <p className="text-slate-400 text-lg md:text-xl max-w-2xl mb-12 leading-relaxed animate-in fade-in slide-in-from-bottom-4 duration-700 delay-200">
          The most advanced AI pilot logbook converter. Scan your handwritten pages and export perfectly formatted CSVs for ForeFlight, Logbook Pro, and more.
        </p>

        <div className="flex flex-col sm:flex-row gap-4 animate-in fade-in zoom-in-95 duration-700 delay-300">
            <button 
                onClick={() => onStart('dashboard')}
                className="px-10 py-5 bg-blue-600 hover:bg-blue-500 text-white rounded-2xl font-black text-lg transition-all shadow-2xl shadow-blue-600/40 flex items-center gap-3 group"
            >
                Start Digitizing Now
                <div className="group-hover:translate-x-1 transition-transform">
                    <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"><line x1="5" y1="12" x2="19" y2="12"/><polyline points="12 5 19 12 12 19"/></svg>
                </div>
            </button>
            <button 
                onClick={() => onStart('tutorial')}
                className="px-10 py-5 bg-slate-900 border border-slate-800 text-slate-300 hover:text-white rounded-2xl font-bold text-lg transition-all flex items-center gap-3"
            >
                <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20"/><path d="M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2z"/></svg>
                View App Tutorial
            </button>
        </div>

        {/* Feature Grid */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 w-full mt-32 text-left animate-in fade-in slide-in-from-bottom-12 duration-1000 delay-500">
            <div className="p-8 bg-slate-900/50 border border-slate-800 rounded-3xl hover:bg-slate-900/80 transition-all hover:border-blue-500/30 group">
                <div className="w-12 h-12 bg-blue-600/10 text-blue-400 rounded-2xl flex items-center justify-center mb-6 group-hover:scale-110 transition-transform">
                    <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/></svg>
                </div>
                <h3 className="text-xl font-bold text-white mb-3 tracking-tight">AI Handwriting Engine</h3>
                <p className="text-slate-500 text-sm leading-relaxed">
                    Built on Gemini 3 Pro, LogExtract understands messy handwriting, ink smears, and pilot shorthand with superhuman accuracy.
                </p>
            </div>

            <div className="p-8 bg-slate-900/50 border border-slate-800 rounded-3xl hover:bg-slate-900/80 transition-all hover:border-emerald-500/30 group">
                <div className="w-12 h-12 bg-emerald-600/10 text-emerald-400 rounded-2xl flex items-center justify-center mb-6 group-hover:scale-110 transition-transform">
                    <ICONS.Check />
                </div>
                <h3 className="text-xl font-bold text-white mb-3 tracking-tight">ForeFlight Validated</h3>
                <p className="text-slate-500 text-sm leading-relaxed">
                    Our export engine produces structured CSVs that match the ForeFlight Import V2 standard exactly. No manual cleanup needed.
                </p>
            </div>

            <div className="p-8 bg-slate-900/50 border border-slate-800 rounded-3xl hover:bg-slate-900/80 transition-all hover:border-amber-500/30 group">
                <div className="w-12 h-12 bg-amber-600/10 text-amber-400 rounded-2xl flex items-center justify-center mb-6 group-hover:scale-110 transition-transform">
                    <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="3" width="18" height="18" rx="2" ry="2"/><line x1="3" y1="10" x2="21" y2="10"/><line x1="9" y1="21" x2="9" y2="10"/><line x1="15" y1="21" x2="15" y2="10"/></svg>
                </div>
                <h3 className="text-xl font-bold text-white mb-3 tracking-tight">Spread Support</h3>
                <p className="text-slate-500 text-sm leading-relaxed">
                    Upload left and right pages together. LogExtract correlates the columns across the spine to stitch entries into a single flight.
                </p>
            </div>
        </div>

        {/* Floating background airplane icon */}
        <div className="absolute -bottom-20 -right-20 text-blue-600/5 rotate-[-15deg] pointer-events-none hidden md:block">
            <svg width="600" height="600" viewBox="0 0 24 24" fill="currentColor"><path d="M17.8 19.2 16 11l3.5-3.5C21 6 21.5 4 21 3c-1-.5-3 0-4.5 1.5L13 8 4.8 6.2c-.5-.1-.9.1-1.1.5l-.3.5c-.2.5-.1 1 .3 1.3L9 12l-2 3H4l-1 1 3 2 2 3 1-1v-3l3-2 3.5 5.3c.3.4.8.5 1.3.3l.5-.2c.4-.3.6-.7.5-1.2z"/></svg>
        </div>
      </main>

      <footer className="relative z-10 p-12 text-center text-slate-700 text-xs border-t border-slate-900">
        <div className="max-w-7xl mx-auto flex flex-col md:flex-row justify-between items-center gap-6">
            <div className="flex items-center gap-2">
                <div className="bg-slate-800 p-1 rounded-md">
                    <ICONS.Plane />
                </div>
                <span className="font-bold text-slate-500">LOGEXTRACT</span>
            </div>
            <div className="flex gap-8">
                <a href="#" className="hover:text-slate-400">Privacy Policy</a>
                <a href="#" className="hover:text-slate-400">Terms of Service</a>
                <a href="#" className="hover:text-slate-400">API Documentation</a>
            </div>
            <p>© {new Date().getFullYear()} LogExtract Technologies. All rights reserved.</p>
        </div>
      </footer>
    </div>
  );
};

export default LandingPage;
