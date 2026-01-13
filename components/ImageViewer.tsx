import React, { useEffect, useRef, useImperativeHandle, forwardRef, useState } from 'react';

interface ImageViewerProps {
  images: string[]; // Array of base64 images (1 for single mode, 2 for pair mode)
  scrollLeft?: number; // Horizontal scroll position for sync
}

export interface ImageViewerHandle {
  scrollTo: (scrollLeft: number) => void;
}

const ImageViewer = forwardRef<ImageViewerHandle, ImageViewerProps>(({ images, scrollLeft = 0 }, ref) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const [stitchedImage, setStitchedImage] = useState<string | null>(null);
  const isScrollingRef = useRef(false);

  // Stitch images together horizontally when there are 2 images
  useEffect(() => {
    if (images.length === 2) {
      const stitchImages = async () => {
        const img1 = new Image();
        const img2 = new Image();
        
        await Promise.all([
          new Promise<void>((resolve) => {
            img1.onload = () => resolve();
            img1.src = images[0];
          }),
          new Promise<void>((resolve) => {
            img2.onload = () => resolve();
            img2.src = images[1];
          })
        ]);

        const canvas = document.createElement('canvas');
        const ctx = canvas.getContext('2d');
        if (!ctx) return;

        // Calculate dimensions - use the maximum height and sum of widths
        const maxHeight = Math.max(img1.height, img2.height);
        canvas.width = img1.width + img2.width;
        canvas.height = maxHeight;

        // Draw both images side by side
        ctx.drawImage(img1, 0, 0);
        ctx.drawImage(img2, img1.width, 0);

        // Convert to base64
        const stitchedDataUrl = canvas.toDataURL('image/jpeg', 0.95);
        setStitchedImage(stitchedDataUrl);
      };

      stitchImages();
    } else if (images.length === 1) {
      setStitchedImage(null); // Use original image for single mode
    }
  }, [images]);

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
      <div className="w-full bg-slate-950 rounded-xl border border-slate-800 flex items-center justify-center" style={{ minHeight: '600px' }}>
        <div className="text-center text-slate-500">
          <svg xmlns="http://www.w3.org/2000/svg" className="h-12 w-12 mx-auto mb-2 opacity-20" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
          </svg>
          <p className="text-xs">No images loaded</p>
        </div>
      </div>
    );
  }

  const displayImage = images.length === 2 ? stitchedImage : images[0];

  if (!displayImage || (images.length === 2 && !stitchedImage)) {
    return (
      <div className="w-full bg-slate-950 rounded-xl border border-slate-800 flex items-center justify-center" style={{ minHeight: '600px' }}>
        <div className="text-center text-slate-500">
          <svg xmlns="http://www.w3.org/2000/svg" className="h-12 w-12 mx-auto mb-2 opacity-20" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
          </svg>
          <p className="text-xs">{images.length === 2 ? 'Stitching images...' : 'Loading images...'}</p>
        </div>
      </div>
    );
  }

  return (
    <div
      ref={containerRef}
      onScroll={handleScroll}
      className="w-full bg-slate-950 rounded-xl border border-slate-800 overflow-x-auto overflow-y-hidden custom-scrollbar"
      style={{ height: '600px' }}
    >
      <div className="flex items-center justify-start h-full" style={{ padding: '16px' }}>
        <div className="flex items-center justify-center">
          <img
            src={displayImage}
            alt={images.length === 2 ? 'Stitched logbook pages' : 'Logbook page'}
            style={{
              transform: 'rotate(-90deg)',
              transformOrigin: 'center center',
              maxHeight: '568px',
              width: 'auto',
              height: 'auto',
              display: 'block'
            }}
          />
        </div>
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
