
import React from 'react';
import { ICONS } from '../constants';

const TutorialTab: React.FC = () => {
  return (
    <div className="flex-1 overflow-y-auto p-8">
      <div className="max-w-5xl mx-auto space-y-12 pb-20 animate-in fade-in slide-in-from-bottom-4 duration-500">
      {/* Header */}
      <header className="space-y-4">
        <div className="inline-flex items-center gap-2 px-3 py-1 bg-blue-500/10 rounded-full border border-blue-500/20 text-[#007BFF] text-[10px] font-bold tracking-widest uppercase">
          Onboarding Guide
        </div>
        <h1 className="text-4xl font-black text-[#003366] tracking-tight">Mastering LogExtract Logbook</h1>
        <p className="text-[#003366]/70 text-lg leading-relaxed max-w-2xl">
          LogExtract uses forensic-grade AI to interpret your handwriting. Follow this guide to ensure 100% accuracy and seamless imports into ForeFlight, Logbook Pro, My Flightbook, and more.
        </p>
      </header>

      {/* App Tabs Overview */}
      <section className="space-y-6">
        <h2 className="text-xl font-bold text-[#003366] flex items-center gap-3">
          <span className="flex items-center justify-center w-8 h-8 rounded-lg bg-[#003366] text-white text-sm">1</span>
          App Tabs
        </h2>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-4">
          {[
            { title: "Dashboard", desc: "Scan and verify logbook pages. Upload single pages or spread pairs, run extraction, then approve results.", icon: <ICONS.Camera /> },
            { title: "Permanent Log", desc: "Your verified entries saved to your account. Edit, add rows, or delete. Stored permanently.", icon: <ICONS.Check /> },
            { title: "Aircraft", desc: "Manage aircraft profiles. Auto-created from entries. Add make, model, gear type for ForeFlight export.", icon: <ICONS.Upload /> },
            { title: "Export", desc: "Download CSV for ForeFlight V2 import. Select which pages to include. Includes aircraft table and approach details.", icon: <ICONS.Download /> },
            { title: "Reviews", desc: "Read pilot reviews and submit your own. Contact support for help.", icon: <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"/></svg> }
          ].map((step, i) => (
            <div key={i} className="p-6 bg-white/80 backdrop-blur-sm/50 border border-[#E2E8F0] rounded-2xl space-y-3">
              <div className="text-blue-500">{step.icon}</div>
              <h3 className="font-bold text-[#003366]">{step.title}</h3>
              <p className="text-xs text-[#003366]/70 leading-relaxed">{step.desc}</p>
            </div>
          ))}
        </div>
      </section>

      {/* The Workflow */}
      <section className="space-y-6">
        <h2 className="text-xl font-bold text-[#003366] flex items-center gap-3">
          <span className="flex items-center justify-center w-8 h-8 rounded-lg bg-[#003366] text-white text-sm">2</span>
          The Standard Workflow
        </h2>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          {[
            { title: "Capture", desc: "Upload single pages or spread pairs. Use landscape orientation. Spread pairs are stitched into single entries using row numbers.", icon: <ICONS.Camera /> },
            { title: "Stage", desc: "Set expected row count if known—helps AI find faint rows. Verify clarity scores (70%+ is best).", icon: <ICONS.Upload /> },
            { title: "Verify", desc: "Run extraction. Review the queue. AI flags ambiguous rows in amber. Approve to save (1 credit per page).", icon: <ICONS.Check /> },
            { title: "Export", desc: "Go to Export, select pages, download CSV. Pre-validated for ForeFlight V2 import.", icon: <ICONS.Download /> }
          ].map((step, i) => (
            <div key={i} className="p-6 bg-white/80 backdrop-blur-sm/50 border border-[#E2E8F0] rounded-2xl space-y-3">
              <div className="text-blue-500">{step.icon}</div>
              <h3 className="font-bold text-[#003366]">{step.title}</h3>
              <p className="text-xs text-[#003366]/70 leading-relaxed">{step.desc}</p>
            </div>
          ))}
        </div>
      </section>

      {/* Feature Deep Dives */}
      <section className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        <div className="space-y-6">
          <h2 className="text-xl font-bold text-[#003366]">Core Features</h2>
          
          <div className="space-y-4">
            <div className="p-6 bg-white/80 backdrop-blur-sm/30 border border-[#E2E8F0] rounded-2xl group hover:border-emerald-500/30 transition-all">
              <h3 className="text-emerald-400 font-bold mb-2">Forensic IFR Cross-check</h3>
              <p className="text-sm text-[#003366]/70 leading-relaxed">
                LogExtract reads your <strong>Remarks</strong> and cross-references them with IFR columns. If you mention "ILS", "IMC", or "Approaches" in comments, the AI uses that to validate or augment column values.
                <br /><br />
                <span className="text-[10px] font-bold text-[#003366]/70 uppercase">RULE:</span> Logic is <strong>additive only</strong>. AI will never reduce your column values based on remarks.
              </p>
            </div>

            <div className="p-6 bg-white/80 backdrop-blur-sm/30 border border-[#E2E8F0] rounded-2xl group hover:border-blue-500/30 transition-all">
              <h3 className="text-[#007BFF] font-bold mb-2">Spread Pair Stitching</h3>
              <p className="text-sm text-[#003366]/70 leading-relaxed">
                Use "New Spread Pair" for two-page logbook layouts. LogExtract uses <strong>Row Anchors</strong> (printed numbers 1–30) to align left-side dates with right-side flight times. Entries stay in correct numeric order.
              </p>
            </div>

            <div className="p-6 bg-white/80 backdrop-blur-sm/30 border border-[#E2E8F0] rounded-2xl group hover:border-purple-500/30 transition-all">
              <h3 className="text-purple-400 font-bold mb-2">Aircraft Profiles</h3>
              <p className="text-sm text-[#003366]/70 leading-relaxed">
                Aircraft profiles are auto-created when you verify entries. Type code and model are pulled from the logbook when present. Make (e.g. Cessna, Piper) is inferred from type code (C172, PA28). Edit profiles in the Aircraft tab for ForeFlight export.
              </p>
            </div>

            <div className="p-6 bg-white/80 backdrop-blur-sm/30 border border-[#E2E8F0] rounded-2xl group hover:border-amber-500/30 transition-all">
              <h3 className="text-amber-400 font-bold mb-2">Auto-Reconciliation</h3>
              <p className="text-sm text-[#003366]/70 leading-relaxed">
                When you edit a row, LogExtract maintains the math:
                <ul className="list-disc list-inside mt-2 space-y-1 text-xs">
                  <li>Day Time = Total Time − Night Time</li>
                  <li>Total Time checksums validated per page</li>
                </ul>
              </p>
            </div>

            <div className="p-6 bg-white/80 backdrop-blur-sm/30 border border-[#E2E8F0] rounded-2xl group hover:border-cyan-500/30 transition-all">
              <h3 className="text-cyan-500 font-bold mb-2">Approach Details</h3>
              <p className="text-sm text-[#003366]/70 leading-relaxed">
                Add up to 6 approach details per entry (ILS, RNAV, VOR, etc.) with runway and airport. These export to ForeFlight's Approach1–6 columns for accurate IFR logging.
              </p>
            </div>
          </div>
        </div>

        <div className="space-y-6">
          <h2 className="text-xl font-bold text-[#003366]">Pro Tips for Better OCR</h2>
          <div className="bg-white/80 backdrop-blur-sm border border-[#E2E8F0] rounded-3xl p-8 space-y-8">
            <div className="flex gap-4">
              <div className="shrink-0 w-10 h-10 rounded-full bg-white/80 backdrop-blur-sm flex items-center justify-center text-[#007BFF]">
                <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M15 14c.2-1 .7-1.7 1.5-2.5 1-.8 1.5-2.2 1.5-3.5A6 6 0 0 0 6 8c0 1 .5 2.2 1.5 3.5.7.7 1.3 1.5 1.5 2.5"/><path d="M9 18h6"/><path d="M10 22h4"/></svg>
              </div>
              <div className="space-y-1">
                <h4 className="font-bold text-[#003366]">Lighting is Key</h4>
                <p className="text-xs text-[#003366]/70 leading-relaxed">Avoid harsh direct sunlight which causes paper glare. Soft, indirect natural light or a bright office lamp is best. Avoid casting shadows with your phone.</p>
              </div>
            </div>

            <div className="flex gap-4">
              <div className="shrink-0 w-10 h-10 rounded-full bg-white/80 backdrop-blur-sm flex items-center justify-center text-emerald-400">
                <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="3" width="18" height="18" rx="2" ry="2"/><line x1="9" y1="3" x2="9" y2="21"/><line x1="15" y1="3" x2="15" y2="21"/><line x1="3" y1="9" x2="21" y2="9"/><line x1="3" y1="15" x2="21" y2="15"/></svg>
              </div>
              <div className="space-y-1">
                <h4 className="font-bold text-[#003366]">Flat & Level</h4>
                <p className="text-xs text-[#003366]/70 leading-relaxed">Keep the logbook as flat as possible. If the spine is curved, use your hands at the edges to flatten the page. Align the camera parallel to the page.</p>
              </div>
            </div>

            <div className="flex gap-4">
              <div className="shrink-0 w-10 h-10 rounded-full bg-white/80 backdrop-blur-sm flex items-center justify-center text-purple-400">
                <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="5" width="18" height="14" rx="2" ry="2"/><line x1="3" y1="10" x2="21" y2="10"/></svg>
              </div>
              <div className="space-y-1">
                <h4 className="font-bold text-[#003366]">Landscape Orientation</h4>
                <p className="text-xs text-[#003366]/70 leading-relaxed">Use landscape (horizontal) orientation when capturing logbook pages. This provides better coverage of the page width and improves OCR accuracy.</p>
              </div>
            </div>

            <div className="flex gap-4">
              <div className="shrink-0 w-10 h-10 rounded-full bg-white/80 backdrop-blur-sm flex items-center justify-center text-amber-400">
                <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/></svg>
              </div>
              <div className="space-y-1">
                <h4 className="font-bold text-[#003366]">Wipe Your Lens</h4>
                <p className="text-xs text-[#003366]/70 leading-relaxed">Logbooks have fine lines. A fingerprint on your camera lens can blur columns like "Actual Inst" and "PIC", leading to extraction errors.</p>
              </div>
            </div>

            <div className="flex gap-4">
              <div className="shrink-0 w-10 h-10 rounded-full bg-white/80 backdrop-blur-sm flex items-center justify-center text-cyan-500">
                <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M12 20h9"/><path d="M16.5 3.5a2.121 2.121 0 0 1 3 3L7 19l-3 3 3-3 16.5-16.5a2.121 2.121 0 0 1 3 3z"/></svg>
              </div>
              <div className="space-y-1">
                <h4 className="font-bold text-[#003366]">Expected Row Count</h4>
                <p className="text-xs text-[#003366]/70 leading-relaxed">If you know how many entries are on a page, enter the count before extraction. This helps the AI find faint or partially visible rows.</p>
              </div>
            </div>
          </div>
        </div>
      </section>

      <footer className="pt-10 border-t border-[#E2E8F0] text-center">
        <p className="text-[#003366]/70 text-sm italic">"A logbook is more than a record; it's the story of your life in the air."</p>
      </footer>
      </div>
    </div>
  );
};

export default TutorialTab;
