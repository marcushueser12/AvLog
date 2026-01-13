
import React from 'react';
import { ICONS } from '../constants';

const TutorialTab: React.FC = () => {
  return (
    <div className="max-w-5xl mx-auto space-y-12 pb-20 animate-in fade-in slide-in-from-bottom-4 duration-500">
      {/* Header */}
      <header className="space-y-4">
        <div className="inline-flex items-center gap-2 px-3 py-1 bg-blue-500/10 rounded-full border border-blue-500/20 text-blue-400 text-[10px] font-bold tracking-widest uppercase">
          Onboarding Guide
        </div>
        <h1 className="text-4xl font-black text-white tracking-tight">Mastering SkyScan Logbook</h1>
        <p className="text-slate-400 text-lg leading-relaxed max-w-2xl">
          SkyScan uses forensic-grade AI to interpret your handwriting. Follow this guide to ensure 100% accuracy and seamless imports into ForeFlight.
        </p>
      </header>

      {/* The Workflow */}
      <section className="space-y-6">
        <h2 className="text-xl font-bold text-white flex items-center gap-3">
          <span className="flex items-center justify-center w-8 h-8 rounded-lg bg-blue-600 text-white text-sm">1</span>
          The Standard Workflow
        </h2>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          {[
            { title: "Capture", desc: "Upload single pages or spread pairs. Spread pairs are stitched into single entries.", icon: <ICONS.Camera /> },
            { title: "Stage", desc: "Verify clarity scores. High contrast (70%+) ensures the best OCR results.", icon: <ICONS.Upload /> },
            { title: "Verify", desc: "Review the queue. AI flags ambiguous rows in amber for your manual check.", icon: <ICONS.Check /> },
            { title: "Export", desc: "Download the CSV. It is pre-validated for ForeFlight's V2 import engine.", icon: <ICONS.Download /> }
          ].map((step, i) => (
            <div key={i} className="p-6 bg-slate-900/50 border border-slate-800 rounded-2xl space-y-3">
              <div className="text-blue-500">{step.icon}</div>
              <h3 className="font-bold text-white">{step.title}</h3>
              <p className="text-xs text-slate-500 leading-relaxed">{step.desc}</p>
            </div>
          ))}
        </div>
      </section>

      {/* Feature Deep Dives */}
      <section className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        <div className="space-y-6">
          <h2 className="text-xl font-bold text-white">Core Features</h2>
          
          <div className="space-y-4">
            <div className="p-6 bg-slate-800/30 border border-slate-800 rounded-2xl group hover:border-emerald-500/30 transition-all">
              <h3 className="text-emerald-400 font-bold mb-2">Forensic IFR Cross-check</h3>
              <p className="text-sm text-slate-400 leading-relaxed">
                SkyScan doesn't just read columns; it reads your <strong>Remarks</strong>. If you mention "ILS", "IMC", or "Approaches" in your comments, the AI cross-references this with your IFR columns.
                <br /><br />
                <span className="text-[10px] font-bold text-slate-500 uppercase">RULE:</span> This logic is <strong>additive only</strong>. AI will never reduce your column values based on remarks.
              </p>
            </div>

            <div className="p-6 bg-slate-800/30 border border-slate-800 rounded-2xl group hover:border-blue-500/30 transition-all">
              <h3 className="text-blue-400 font-bold mb-2">Spread Stacking (Stitch Mode)</h3>
              <p className="text-sm text-slate-400 leading-relaxed">
                Modern logbooks span two pages. Use "New Spread Pair" to upload both. SkyScan uses the <strong>Row Anchors</strong> (the printed numbers 1-30) to perfectly align left-side dates with right-side flight times.
              </p>
            </div>

            <div className="p-6 bg-slate-800/30 border border-slate-800 rounded-2xl group hover:border-amber-500/30 transition-all">
              <h3 className="text-amber-400 font-bold mb-2">Auto-Reconciliation</h3>
              <p className="text-sm text-slate-400 leading-relaxed">
                When you edit a row, SkyScan automatically maintains the math:
                <ul className="list-disc list-inside mt-2 space-y-1 text-xs">
                  <li>Day Time = Total Time - Night Time</li>
                  <li>Total Time Checksums are validated per-page.</li>
                </ul>
              </p>
            </div>
          </div>
        </div>

        <div className="space-y-6">
          <h2 className="text-xl font-bold text-white">Pro Tips for Better OCR</h2>
          <div className="bg-slate-900 border border-slate-800 rounded-3xl p-8 space-y-8">
            <div className="flex gap-4">
              <div className="shrink-0 w-10 h-10 rounded-full bg-slate-800 flex items-center justify-center text-blue-400">
                <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M15 14c.2-1 .7-1.7 1.5-2.5 1-.8 1.5-2.2 1.5-3.5A6 6 0 0 0 6 8c0 1 .5 2.2 1.5 3.5.7.7 1.3 1.5 1.5 2.5"/><path d="M9 18h6"/><path d="M10 22h4"/></svg>
              </div>
              <div className="space-y-1">
                <h4 className="font-bold text-white">Lighting is Key</h4>
                <p className="text-xs text-slate-500 leading-relaxed">Avoid harsh direct sunlight which causes paper glare. Soft, indirect natural light or a bright office lamp is best. Avoid casting shadows with your phone.</p>
              </div>
            </div>

            <div className="flex gap-4">
              <div className="shrink-0 w-10 h-10 rounded-full bg-slate-800 flex items-center justify-center text-emerald-400">
                <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="3" width="18" height="18" rx="2" ry="2"/><line x1="9" y1="3" x2="9" y2="21"/><line x1="15" y1="3" x2="15" y2="21"/><line x1="3" y1="9" x2="21" y2="9"/><line x1="3" y1="15" x2="21" y2="15"/></svg>
              </div>
              <div className="space-y-1">
                <h4 className="font-bold text-white">Flat & Level</h4>
                <p className="text-xs text-slate-500 leading-relaxed">Try to keep the logbook as flat as possible. If the spine is curved, use your hands at the very edges (away from data) to flatten the page. Align the camera parallel to the page.</p>
              </div>
            </div>

            <div className="flex gap-4">
              <div className="shrink-0 w-10 h-10 rounded-full bg-slate-800 flex items-center justify-center text-purple-400">
                <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="5" width="18" height="14" rx="2" ry="2"/><line x1="3" y1="10" x2="21" y2="10"/></svg>
              </div>
              <div className="space-y-1">
                <h4 className="font-bold text-white">Landscape Orientation</h4>
                <p className="text-xs text-slate-500 leading-relaxed">Use landscape (horizontal) orientation when capturing logbook pages. This orientation provides better coverage of the page width and improves OCR accuracy for column extraction.</p>
              </div>
            </div>

            <div className="flex gap-4">
              <div className="shrink-0 w-10 h-10 rounded-full bg-slate-800 flex items-center justify-center text-amber-400">
                <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/></svg>
              </div>
              <div className="space-y-1">
                <h4 className="font-bold text-white">Wipe Your Lens</h4>
                <p className="text-xs text-slate-500 leading-relaxed">Logbooks have fine lines. A fingerprint on your camera lens can blur columns like "Actual Inst" and "PIC", leading to extraction errors.</p>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Visual Examples Placeholder */}
      <section className="space-y-6">
          <h2 className="text-xl font-bold text-white">Visual Examples</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="aspect-video bg-slate-900 border border-slate-800 rounded-3xl flex flex-col items-center justify-center text-slate-700 border-dashed">
                <ICONS.Camera />
                <span className="text-xs font-bold mt-2 uppercase tracking-widest">Good Capture Example</span>
                <span className="text-[10px] text-slate-800 mt-1">(Future Reference Photo)</span>
            </div>
            <div className="aspect-video bg-slate-900 border border-slate-800 rounded-3xl flex flex-col items-center justify-center text-slate-700 border-dashed">
                <ICONS.Check />
                <span className="text-xs font-bold mt-2 uppercase tracking-widest">Correct Spread Alignment</span>
                <span className="text-[10px] text-slate-800 mt-1">(Future Reference Photo)</span>
            </div>
          </div>
      </section>

      <footer className="pt-10 border-t border-slate-800 text-center">
        <p className="text-slate-500 text-sm italic">"A logbook is more than a record; it's the story of your life in the air."</p>
      </footer>
    </div>
  );
};

export default TutorialTab;
