import React, { useEffect, useRef, useState, useCallback } from 'react';
import { BoundingBox } from '../types';

interface ImageViewerProps {
  images: string[]; // Array of base64 images (1 for single mode, 2 for pair mode)
  activeBoundingBox?: BoundingBox | null;
  fieldName?: string;
}

const ImageViewer: React.FC<ImageViewerProps> = ({ images, activeBoundingBox, fieldName }) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const imageRefs = useRef<(HTMLImageElement | null)[]>([]);
  const [imageLoaded, setImageLoaded] = useState(false);
  const [zoom, setZoom] = useState(1);
  const [offset, setOffset] = useState({ x: 0, y: 0 });

  // Reset transform when active bounding box changes
  useEffect(() => {
    if (!activeBoundingBox || !imageLoaded || !containerRef.current || images.length === 0) {
      setZoom(1);
      setOffset({ x: 0, y: 0 });
      return;
    }

    const imageIndex = activeBoundingBox.imageIndex ?? 0;
    if (imageIndex >= images.length) return;

    const img = imageRefs.current[imageIndex];
    if (!img || !img.complete) return;

    const [ymin, xmin, ymax, xmax] = activeBoundingBox.coordinates;
    const centerX = (xmin + xmax) / 2;
    const centerY = (ymin + ymax) / 2;
    const width = xmax - xmin;
    const height = ymax - ymin;

    // Calculate zoom level to fit the bounding box (with padding)
    const padding = 0.3; // 30% padding around the box
    const targetWidth = width * (1 + padding * 2);
    const targetHeight = height * (1 + padding * 2);
    
    const containerWidth = containerRef.current.clientWidth;
    const containerHeight = containerRef.current.clientHeight;
    
    // For pair mode, each image takes half the width
    const imageDisplayWidth = images.length === 2 ? containerWidth / 2 : containerWidth;
    
    const zoomX = imageDisplayWidth / (img.naturalWidth * targetWidth);
    const zoomY = containerHeight / (img.naturalHeight * targetHeight);
    const newZoom = Math.min(zoomX, zoomY, 5); // Max zoom of 5x

    // Calculate offset to center the bounding box
    const imageCenterX = centerX * img.naturalWidth;
    const imageCenterY = centerY * img.naturalHeight;
    
    const newOffsetX = imageDisplayWidth / 2 - imageCenterX * newZoom;
    const newOffsetY = containerHeight / 2 - imageCenterY * newZoom;

    setZoom(newZoom);
    setOffset({ x: newOffsetX, y: newOffsetY });
  }, [activeBoundingBox, imageLoaded, images.length]);

  const handleImageLoad = useCallback(() => {
    setImageLoaded(true);
  }, []);

  const handleWheel = useCallback((e: React.WheelEvent) => {
    e.preventDefault();
    const delta = e.deltaY > 0 ? 0.9 : 1.1;
    setZoom(prev => Math.max(0.5, Math.min(5, prev * delta)));
  }, []);

  const renderImage = (imageSrc: string, index: number) => {
    const isActive = activeBoundingBox?.imageIndex === index || (activeBoundingBox && images.length === 1);
    const [ymin, xmin, ymax, xmax] = activeBoundingBox?.coordinates || [0, 0, 0, 0];

    return (
      <div
        key={index}
        className={`relative overflow-hidden ${images.length === 2 ? 'w-1/2' : 'w-full'} h-full bg-slate-950`}
        style={{ borderRight: images.length === 2 && index === 0 ? '1px solid #334155' : 'none' }}
      >
        <img
          ref={(el) => { imageRefs.current[index] = el; }}
          src={imageSrc}
          alt={`Logbook page ${index + 1}`}
          className="absolute transition-transform duration-500 ease-out"
          style={{
            transform: isActive
              ? `translate(${offset.x}px, ${offset.y}px) scale(${zoom})`
              : 'translate(0, 0) scale(1)',
            transformOrigin: 'top left',
            maxWidth: 'none',
            height: '100%',
            width: 'auto'
          }}
          onLoad={index === 0 ? handleImageLoad : undefined}
        />
        
        {/* Highlight overlay */}
        {isActive && activeBoundingBox && (
          <div
            className="absolute border-2 border-blue-400 bg-blue-400/20 pointer-events-none transition-all duration-500"
            style={{
              left: `${xmin * 100}%`,
              top: `${ymin * 100}%`,
              width: `${(xmax - xmin) * 100}%`,
              height: `${(ymax - ymin) * 100}%`,
              transform: `translate(${offset.x / zoom}px, ${offset.y / zoom}px) scale(${zoom})`,
              transformOrigin: 'top left',
              boxShadow: '0 0 20px rgba(59, 130, 246, 0.5)'
            }}
          >
            {fieldName && (
              <div className="absolute -top-6 left-0 bg-blue-400 text-white text-xs px-2 py-1 rounded whitespace-nowrap">
                {fieldName}
              </div>
            )}
          </div>
        )}
      </div>
    );
  };

  return (
    <div
      ref={containerRef}
      className="w-full h-full bg-slate-950 flex relative overflow-hidden"
      onWheel={handleWheel}
    >
      {images.map((img, index) => renderImage(img, index))}
    </div>
  );
};

export default ImageViewer;
