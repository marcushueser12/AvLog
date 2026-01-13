import React, { useEffect, useRef, useImperativeHandle, forwardRef } from 'react';

interface ImageViewerProps {
  images: string[]; // Array of base64 images (1 for single mode, 2 for pair mode)
  scrollLeft?: number; // Horizontal scroll position for sync
}

export interface ImageViewerHandle {
  scrollTo: (scrollLeft: number) => void;
}

const ImageViewer = forwardRef<ImageViewerHandle, ImageViewerProps>(({ images, scrollLeft = 0 }, ref) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const imageRefs = useRef<(HTMLImageElement | null)[]>([]);
  const isScrollingRef = useRef(false);

  // Expose scroll method to parent
  useImperativeHandle(ref, () => ({
    scrollTo: (scrollLeft: number) => {
      if (containerRef.current && !isScrollingRef.current) {
        isScrollingRef.current = true;
        containerRef.current.scrollLeft = scrollLeft;
        setTimeout(() => {
          isScrollingRef.current = false;
        }, 100);
      }
    }
  }), []);

  // Sync scroll from parent
  useEffect(() => {
    if (containerRef.current && scrollLeft !== undefined && !isScrollingRef.current) {
      isScrollingRef.current = true;
      containerRef.current.scrollLeft = scrollLeft;
      setTimeout(() => {
        isScrollingRef.current = false;
      }, 100);
    }
  }, [scrollLeft]);

  const handleScroll = () => {
    // Don't sync back to parent on manual scroll to avoid loops
    // Parent will sync to us, not the other way around
  };

  if (images.length === 0) {
    return (
      <div className="w-full bg-slate-950 rounded-xl border border-slate-800 flex items-center justify-center" style={{ height: '200px' }}>
        <div className="text-center text-slate-500">
          <svg xmlns="http://www.w3.org/2000/svg" className="h-12 w-12 mx-auto mb-2 opacity-20" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
          </svg>
          <p className="text-xs">No images loaded</p>
        </div>
      </div>
    );
  }

  return (
    <div
      ref={containerRef}
      onScroll={handleScroll}
      className="w-full bg-slate-950 rounded-xl border border-slate-800 overflow-x-auto custom-scrollbar"
      style={{ height: '180px' }}
    >
      <div className="flex h-full min-w-max">
        {images.map((img, index) => (
          <div
            key={index}
            className={`relative flex-shrink-0 ${images.length === 2 ? 'w-1/2' : 'w-full'} bg-slate-900 overflow-hidden`}
            style={{ 
              height: '100%',
              aspectRatio: '16/9',
              borderRight: images.length === 2 && index === 0 ? '1px solid #334155' : 'none' 
            }}
          >
            <img
              ref={(el) => { imageRefs.current[index] = el; }}
              src={img}
              alt={`Logbook page ${index + 1}`}
              className="w-full h-full object-cover"
              style={{
                objectPosition: 'center center'
              }}
            />
            {images.length === 2 && (
              <div className="absolute top-2 left-2 bg-slate-900/80 text-slate-400 text-xs px-2 py-1 rounded font-mono">
                Page {index === 0 ? '1' : '2'}
              </div>
            )}
          </div>
        ))}
      </div>
      <style>{`
        .custom-scrollbar::-webkit-scrollbar { height: 8px; }
        .custom-scrollbar::-webkit-scrollbar-track { background: #0f172a; }
        .custom-scrollbar::-webkit-scrollbar-thumb { background: #334155; border-radius: 4px; }
        .custom-scrollbar::-webkit-scrollbar-thumb:hover { background: #475569; }
      `}</style>
    </div>
  );
});

ImageViewer.displayName = 'ImageViewer';

export default ImageViewer;
