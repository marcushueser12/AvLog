import React, { useEffect, useRef, useImperativeHandle, forwardRef, useState } from 'react';

interface ImageViewerProps {
  images: string[]; // Array of base64 images (1 for single mode, 2 for pair mode)
  scrollLeft?: number; // Horizontal scroll position for sync
  rotations?: number[]; // Rotation in degrees for each image (defaults to [0, 0])
  onRotationChange?: (imageIndex: number, newRotation: number) => void; // Callback when rotation changes
}

export interface ImageViewerHandle {
  scrollTo: (scrollLeft: number) => void;
}

const ImageViewer = forwardRef<ImageViewerHandle, ImageViewerProps>(({ 
  images, 
  scrollLeft = 0, 
  rotations = [0, 0],
  onRotationChange 
}, ref) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const [stitchedImage, setStitchedImage] = useState<string | null>(null);
  const isScrollingRef = useRef(false);
  
  // Get rotation for each image (default to 0 if not provided)
  const rotation1 = rotations[0] || 0;
  const rotation2 = rotations[1] || 0;

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

          // Rotate each image based on rotation value
          const rotateImage = (img: HTMLImageElement, rotationDegrees: number): Promise<string> => {
            return new Promise((resolve, reject) => {
              try {
                const canvas = document.createElement('canvas');
                const ctx = canvas.getContext('2d');
                
                if (!ctx) {
                  reject(new Error('Could not get canvas context'));
                  return;
                }

                // Normalize rotation to 0-360 range
                const normalizedRotation = ((rotationDegrees % 360) + 360) % 360;
                const rotationRad = (normalizedRotation * Math.PI) / 180;

                // Calculate canvas dimensions based on rotation
                // For 90/270 degree rotations, swap width and height
                let canvasWidth: number;
                let canvasHeight: number;
                
                if (normalizedRotation === 90 || normalizedRotation === 270) {
                  canvasWidth = img.height;
                  canvasHeight = img.width;
                } else {
                  canvasWidth = img.width;
                  canvasHeight = img.height;
                }

                canvas.width = canvasWidth;
                canvas.height = canvasHeight;

                // Standard rotation: translate to center, rotate, translate back, draw
                ctx.translate(canvas.width / 2, canvas.height / 2);
                ctx.rotate(rotationRad);
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

          // Rotate both images with their respective rotations
          const [rotatedDataUrl1, rotatedDataUrl2] = await Promise.all([
            rotateImage(img1, rotation1),
            rotateImage(img2, rotation2)
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
    } else if (images.length === 1) {
      // Handle single image with rotation
      const rotateSingleImage = async () => {
        try {
          const img = new Image();
          await new Promise<void>((resolve, reject) => {
            img.onload = () => resolve();
            img.onerror = () => reject(new Error('Failed to load image'));
            img.src = images[0];
          });

          const rotation = rotations[0] || 0;
          const normalizedRotation = ((rotation % 360) + 360) % 360;
          const rotationRad = (normalizedRotation * Math.PI) / 180;

          const canvas = document.createElement('canvas');
          const ctx = canvas.getContext('2d');
          if (!ctx) return;

          let canvasWidth: number;
          let canvasHeight: number;
          
          if (normalizedRotation === 90 || normalizedRotation === 270) {
            canvasWidth = img.height;
            canvasHeight = img.width;
          } else {
            canvasWidth = img.width;
            canvasHeight = img.height;
          }

          canvas.width = canvasWidth;
          canvas.height = canvasHeight;

          ctx.translate(canvas.width / 2, canvas.height / 2);
          ctx.rotate(rotationRad);
          ctx.translate(-img.width / 2, -img.height / 2);
          ctx.drawImage(img, 0, 0);

          let dataUrl: string;
          try {
            dataUrl = canvas.toDataURL('image/jpeg', 0.92);
          } catch (e) {
            dataUrl = canvas.toDataURL('image/png');
          }

          setStitchedImage(dataUrl);
        } catch (error) {
          console.error('Error rotating single image:', error);
          setStitchedImage(null);
        }
      };

      rotateSingleImage();
    } else {
      setStitchedImage(null);
    }
  }, [images, rotation1, rotation2, rotations]);

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

  const handleRotate = (imageIndex: number, direction: 'left' | 'right') => {
    if (!onRotationChange) return;
    const currentRotation = rotations[imageIndex] || 0;
    const rotationChange = direction === 'left' ? -90 : 90;
    const newRotation = ((currentRotation + rotationChange) % 360 + 360) % 360;
    onRotationChange(imageIndex, newRotation);
  };

  return (
    <div className="w-full">
      {/* Rotation controls */}
      {onRotationChange && images.length > 0 && (
        <div className="flex items-center justify-between px-4 py-2 bg-slate-900 border-b border-slate-800">
          <div className="flex items-center gap-2">
            <span className="text-xs text-slate-400 font-medium">Image Orientation:</span>
            {images.map((_, index) => (
              <div key={index} className="flex items-center gap-1">
                {images.length === 2 && (
                  <span className="text-xs text-slate-500 mr-1">Page {index + 1}:</span>
                )}
                <button
                  onClick={() => handleRotate(index, 'left')}
                  className="p-1.5 hover:bg-slate-800 rounded border border-slate-700 hover:border-slate-600 transition-colors"
                  title="Rotate 90° counterclockwise"
                >
                  <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-slate-400">
                    <path d="M21.5 2v6h-6M2.5 22v-6h6M2 11.5a10 10 0 0 1 18.8-4.3M22 12.5a10 10 0 0 1-18.8 4.2"/>
                  </svg>
                </button>
                <button
                  onClick={() => handleRotate(index, 'right')}
                  className="p-1.5 hover:bg-slate-800 rounded border border-slate-700 hover:border-slate-600 transition-colors"
                  title="Rotate 90° clockwise"
                >
                  <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-slate-400">
                    <path d="M21.5 2v6h-6M2.5 22v-6h6M22 11.5a10 10 0 0 1-18.8 4.3M2 12.5a10 10 0 0 1 18.8-4.2"/>
                  </svg>
                </button>
                <span className="text-xs text-slate-500 ml-1 min-w-[3rem]">
                  {rotations[index] || 0}°
                </span>
              </div>
            ))}
          </div>
        </div>
      )}
      
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
                transform: 'none', // Rotation is applied in canvas
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
    </div>
  );
});

ImageViewer.displayName = 'ImageViewer';

export default ImageViewer;
