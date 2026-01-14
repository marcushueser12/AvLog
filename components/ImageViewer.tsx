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

  // Rotate images first, then stitch them together horizontally when there are 2 images
  useEffect(() => {
    if (images.length === 2) {
      const stitchImages = async () => {
        const img1 = new Image();
        const img2 = new Image();
        
        // Load both images with error handling
        await Promise.all([
          new Promise<void>((resolve, reject) => {
            img1.onload = () => resolve();
            img1.onerror = () => reject(new Error('Failed to load image 1'));
            img1.src = images[0];
          }),
          new Promise<void>((resolve, reject) => {
            img2.onload = () => resolve();
            img2.onerror = () => reject(new Error('Failed to load image 2'));
            img2.src = images[1];
          })
        ]);

        // Verify images loaded correctly
        if (!img1.complete || !img2.complete || img1.width === 0 || img2.width === 0) {
          console.error('Images failed to load properly');
          return;
        }

        // First, rotate each image -90deg to landscape
        const rotateImage = (img: HTMLImageElement): Promise<HTMLImageElement> => {
          return new Promise((resolve, reject) => {
            try {
              // Ensure image is fully loaded (Safari requirement)
              if (!img.complete || img.naturalWidth === 0 || img.naturalHeight === 0) {
                reject(new Error('Image not fully loaded'));
                return;
              }

              const canvas = document.createElement('canvas');
              // Set dimensions first (Safari requirement)
              canvas.width = img.height;
              canvas.height = img.width;
              
              const ctx = canvas.getContext('2d', { 
                willReadFrequently: false,
                alpha: true 
              });
              if (!ctx) {
                resolve(img);
                return;
              }

              // Safari: Enable image smoothing for better quality
              ctx.imageSmoothingEnabled = true;
              ctx.imageSmoothingQuality = 'high';

              ctx.save();
              ctx.translate(canvas.width / 2, canvas.height / 2);
              ctx.rotate(-90 * Math.PI / 180);
              ctx.translate(-img.width / 2, -img.height / 2);
              ctx.drawImage(img, 0, 0, img.width, img.height);
              ctx.restore();

              // Safari: Use PNG which is more reliable
              const dataUrl = canvas.toDataURL('image/png');
              
              if (!dataUrl || dataUrl === 'data:,') {
                reject(new Error('Failed to generate rotated image data'));
                return;
              }

              const rotatedImg = new Image();
              rotatedImg.onload = () => resolve(rotatedImg);
              rotatedImg.onerror = () => reject(new Error('Failed to load rotated image'));
              rotatedImg.src = dataUrl;
            } catch (error) {
              reject(error);
            }
          });
        };

        // Rotate both images first
        const rotated1 = await rotateImage(img1);
        const rotated2 = await rotateImage(img2);

        // Now stitch the rotated (landscape) images horizontally
        const stitchCanvas = document.createElement('canvas');
        
        // Calculate dimensions - use the maximum height and sum of widths
        const maxHeight = Math.max(rotated1.height, rotated2.height);
        stitchCanvas.width = rotated1.width + rotated2.width;
        stitchCanvas.height = maxHeight;
        
        const stitchCtx = stitchCanvas.getContext('2d', {
          willReadFrequently: false,
          alpha: true
        });
        if (!stitchCtx) return;

        // Safari: Enable image smoothing
        stitchCtx.imageSmoothingEnabled = true;
        stitchCtx.imageSmoothingQuality = 'high';

        // Draw both rotated images side by side horizontally
        stitchCtx.drawImage(rotated1, 0, 0);
        stitchCtx.drawImage(rotated2, rotated1.width, 0);

        // Safari: Use PNG which is more reliable
        const stitchedDataUrl = stitchCanvas.toDataURL('image/png');
        setStitchedImage(stitchedDataUrl);
      };

      stitchImages();
    } else {
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
              transform: images.length === 2 ? 'none' : 'rotate(-90deg)',
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
