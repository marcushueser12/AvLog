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
        try {
          // Load images with proper error handling
          const loadImage = (src: string): Promise<HTMLImageElement> => {
            return new Promise((resolve, reject) => {
              const img = new Image();
              img.onload = () => {
                // Verify image loaded correctly
                if (img.naturalWidth === 0 || img.naturalHeight === 0) {
                  reject(new Error('Image has zero dimensions'));
                  return;
                }
                resolve(img);
              };
              img.onerror = () => reject(new Error('Failed to load image'));
              img.src = src;
            });
          };

          const [img1, img2] = await Promise.all([
            loadImage(images[0]),
            loadImage(images[1])
          ]);

          // Rotate each image -90deg to landscape
          const rotateImage = (img: HTMLImageElement): Promise<string> => {
            return new Promise((resolve, reject) => {
              try {
                const canvas = document.createElement('canvas');
                const ctx = canvas.getContext('2d');
                
                if (!ctx) {
                  reject(new Error('Could not get canvas context'));
                  return;
                }

                // After -90deg rotation: width becomes height, height becomes width
                canvas.width = img.height;
                canvas.height = img.width;

                // Standard rotation: translate to center, rotate, translate back, draw
                ctx.translate(canvas.width / 2, canvas.height / 2);
                ctx.rotate(-Math.PI / 2);
                ctx.translate(-img.width / 2, -img.height / 2);
                ctx.drawImage(img, 0, 0);

                // Convert to data URL - try JPEG first, fallback to PNG
                let dataUrl: string;
                try {
                  dataUrl = canvas.toDataURL('image/jpeg', 0.92);
                } catch (e) {
                  dataUrl = canvas.toDataURL('image/png');
                }

                if (!dataUrl || dataUrl.length < 100) {
                  reject(new Error('Invalid canvas data'));
                  return;
                }

                resolve(dataUrl);
              } catch (error) {
                reject(error);
              }
            });
          };

          // Rotate both images
          const [rotatedDataUrl1, rotatedDataUrl2] = await Promise.all([
            rotateImage(img1),
            rotateImage(img2)
          ]);

          // Load rotated images to get dimensions for stitching
          const [rotatedImg1, rotatedImg2] = await Promise.all([
            loadImage(rotatedDataUrl1),
            loadImage(rotatedDataUrl2)
          ]);

          // Stitch the rotated images horizontally
          const stitchCanvas = document.createElement('canvas');
          const stitchCtx = stitchCanvas.getContext('2d');
          
          if (!stitchCtx) {
            console.error('Could not get stitch canvas context');
            return;
          }

          // Calculate dimensions
          const maxHeight = Math.max(rotatedImg1.height, rotatedImg2.height);
          stitchCanvas.width = rotatedImg1.width + rotatedImg2.width;
          stitchCanvas.height = maxHeight;

          // Draw both rotated images side by side
          stitchCtx.drawImage(rotatedImg1, 0, 0);
          stitchCtx.drawImage(rotatedImg2, rotatedImg1.width, 0);

          // Convert to data URL
          let stitchedDataUrl: string;
          try {
            stitchedDataUrl = stitchCanvas.toDataURL('image/jpeg', 0.92);
          } catch (e) {
            stitchedDataUrl = stitchCanvas.toDataURL('image/png');
          }

          setStitchedImage(stitchedDataUrl);
        } catch (error) {
          console.error('Error stitching images:', error);
          setStitchedImage(null);
        }
      };

      stitchImages();
    } else {
      setStitchedImage(null);
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
