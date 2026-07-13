import React, { useState, useRef, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { AppTheme, AppLanguage } from '../types';
import { useSettingsStore } from '../store/useSettingsStore';

interface CropViewProps {
  imageSrc: string;
  onConfirm: (croppedImage: string) => void;
  onCancel: () => void;
}

export const CropView: React.FC<CropViewProps> = ({ imageSrc, onConfirm, onCancel }) => {
  const { t } = useTranslation();
  const { theme, language } = useSettingsStore();
  const [crop, setCrop] = useState({ x: 10, y: 30, width: 80, height: 40 }); // Percentages
  const containerRef = useRef<HTMLDivElement>(null);
  const imageRef = useRef<HTMLImageElement>(null);
  const isDragging = useRef<string | null>(null); // 'move', 'tl', 'tr', 'bl', 'br'
  const lastPos = useRef<{ x: number; y: number } | null>(null);
  const [imageRect, setImageRect] = useState<{ left: number; top: number; width: number; height: number } | null>(null);

  const isDark = theme === 'dark';

  const updateImageRect = () => {
    if (!containerRef.current || !imageRef.current) return;
    const container = containerRef.current.getBoundingClientRect();
    const img = imageRef.current;
    if (!img.naturalWidth || !img.naturalHeight) return;

    const ratio = Math.min(container.width / img.naturalWidth, container.height / img.naturalHeight);
    const renderedWidth = img.naturalWidth * ratio;
    const renderedHeight = img.naturalHeight * ratio;
    const left = (container.width - renderedWidth) / 2;
    const top = (container.height - renderedHeight) / 2;

    setImageRect({
      left,
      top,
      width: renderedWidth,
      height: renderedHeight
    });
  };

  useEffect(() => {
    window.addEventListener('resize', updateImageRect);
    return () => {
      window.removeEventListener('resize', updateImageRect);
    };
  }, []);

  useEffect(() => {
    if (imageRef.current && imageRef.current.complete) {
      updateImageRect();
    }
  }, [imageSrc]);

  // Touch/Mouse Handlers
  const handleStart = (e: React.TouchEvent | React.MouseEvent, type: string) => {
    // e.preventDefault(); // removed to allow some default behaviors if needed, but usually strictly controlled
    const clientX = 'touches' in e ? e.touches[0].clientX : (e as React.MouseEvent).clientX;
    const clientY = 'touches' in e ? e.touches[0].clientY : (e as React.MouseEvent).clientY;
    
    isDragging.current = type;
    lastPos.current = { x: clientX, y: clientY };
  };

  const handleMove = (e: React.TouchEvent | React.MouseEvent) => {
    if (!isDragging.current || !lastPos.current || !containerRef.current) return;
    
    const clientX = 'touches' in e ? e.touches[0].clientX : (e as React.MouseEvent).clientX;
    const clientY = 'touches' in e ? e.touches[0].clientY : (e as React.MouseEvent).clientY;

    const rect = imageRect || containerRef.current.getBoundingClientRect();
    const deltaX = ((clientX - lastPos.current.x) / rect.width) * 100;
    const deltaY = ((clientY - lastPos.current.y) / rect.height) * 100;

    setCrop(prev => {
      let { x, y, width, height } = prev;
      
      switch (isDragging.current) {
        case 'move':
          x = Math.max(0, Math.min(100 - width, x + deltaX));
          y = Math.max(0, Math.min(100 - height, y + deltaY));
          break;
        case 'tl':
          // Limit min size to 10%
          if (width - deltaX > 10) { x += deltaX; width -= deltaX; }
          if (height - deltaY > 10) { y += deltaY; height -= deltaY; }
          break;
        case 'tr':
          if (width + deltaX > 10) { width += deltaX; }
          if (height - deltaY > 10) { y += deltaY; height -= deltaY; }
          break;
        case 'bl':
          if (width - deltaX > 10) { x += deltaX; width -= deltaX; }
          if (height + deltaY > 10) { height += deltaY; }
          break;
        case 'br':
          if (width + deltaX > 10) { width += deltaX; }
          if (height + deltaY > 10) { height += deltaY; }
          break;
      }
      return { x, y, width, height };
    });

    lastPos.current = { x: clientX, y: clientY };
  };

  const handleEnd = () => {
    isDragging.current = null;
    lastPos.current = null;
  };

  const performCrop = () => {
    if (!imageRef.current) return;
    
    const img = imageRef.current;
    const canvas = document.createElement('canvas');
    
    // Calculate actual pixel coordinates
    // We assume the image displayed covers the container or is contained within it.
    // However, to be precise, we map the crop % to the natural dimensions of the image.
    
    const naturalWidth = img.naturalWidth;
    const naturalHeight = img.naturalHeight;

    const pixelX = (crop.x / 100) * naturalWidth;
    const pixelY = (crop.y / 100) * naturalHeight;
    const pixelW = (crop.width / 100) * naturalWidth;
    const pixelH = (crop.height / 100) * naturalHeight;

    canvas.width = pixelW;
    canvas.height = pixelH;
    
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    ctx.drawImage(
      img,
      pixelX, pixelY, pixelW, pixelH, // Source
      0, 0, pixelW, pixelH            // Destination
    );

    const base64 = canvas.toDataURL('image/jpeg', 0.9);
    onConfirm(base64);
  };

  // Add event listeners for global release
  useEffect(() => {
      const stop = () => handleEnd();
      window.addEventListener('mouseup', stop);
      window.addEventListener('touchend', stop);
      return () => {
          window.removeEventListener('mouseup', stop);
          window.removeEventListener('touchend', stop);
      };
  }, []);

  return (
    <div className="absolute inset-0 z-50 bg-black flex flex-col animate-fade-in">
      {/* Header */}
      <div className="absolute top-0 inset-x-0 p-6 z-20 flex justify-between items-center bg-gradient-to-b from-black/80 to-transparent">
        <button onClick={onCancel} className="text-white/80 font-medium px-4 py-2 rounded-full bg-white/10 backdrop-blur-md">
           {t('crop.retake')}
        </button>
        <span className="text-white font-light tracking-widest uppercase text-sm shadow-black drop-shadow-md">{t('crop.title')}</span>
        <div className="w-16"></div> {/* Spacer */}
      </div>

      {/* Image Area */}
      <div 
        ref={containerRef}
        className="relative flex-1 w-full h-full overflow-hidden bg-black touch-none"
        onMouseMove={handleMove}
        onTouchMove={handleMove}
      >
        <div
          style={imageRect ? {
            position: 'absolute',
            left: `${imageRect.left}px`,
            top: `${imageRect.top}px`,
            width: `${imageRect.width}px`,
            height: `${imageRect.height}px`
          } : {
            position: 'absolute',
            left: 0,
            top: 0,
            width: '100%',
            height: '100%'
          }}
        >
          <img 
            ref={imageRef}
            src={imageSrc} 
            alt="Crop Source" 
            onLoad={updateImageRect}
            className="w-full h-full object-cover pointer-events-none select-none opacity-50"
          />

          {/* The Crop Box (Highlighted Area) */}
          {/* We use a separate image element clipped to the crop area to simulate the "highlight" effect 
              while the background is dimmed. */}
          <div 
              style={{
                  left: `${crop.x}%`,
                  top: `${crop.y}%`,
                  width: `${crop.width}%`,
                  height: `${crop.height}%`
              }}
              className="absolute z-10 group cursor-move"
              onMouseDown={(e) => handleStart(e, 'move')}
              onTouchStart={(e) => handleStart(e, 'move')}
          >
               {/* The crisp image inside the selection */}
               <div className="absolute inset-0 overflow-hidden bg-black">
                   <img 
                      src={imageSrc} 
                      className="absolute max-w-none"
                      style={{
                          left: `-${(crop.x / crop.width) * 100}%`,
                          top: `-${(crop.y / crop.height) * 100}%`,
                          width: `${(100 / crop.width) * 100}%`,
                          height: `${(100 / crop.height) * 100}%`
                      }}
                   />
               </div>
               
               {/* Border & Grid */}
               <div className="absolute inset-0 border-2 border-white shadow-[0_0_0_9999px_rgba(0,0,0,0.6)]">
                   {/* Rule of Thirds Grid */}
                   <div className="absolute inset-0 grid grid-cols-3 grid-rows-3 pointer-events-none opacity-30">
                       <div className="border-r border-white/50"></div>
                       <div className="border-r border-white/50"></div>
                       <div className="border-b border-white/50 col-span-3 row-start-1"></div>
                       <div className="border-b border-white/50 col-span-3 row-start-2"></div>
                   </div>
               </div>

               {/* Handles */}
               <div 
                  className="absolute -top-3 -left-3 w-8 h-8 flex items-center justify-center z-20 touch-manipulation"
                  onMouseDown={(e) => { e.stopPropagation(); handleStart(e, 'tl'); }}
                  onTouchStart={(e) => { e.stopPropagation(); handleStart(e, 'tl'); }}
               >
                   <div className="w-4 h-4 border-t-4 border-l-4 border-indigo-400 rounded-tl-sm bg-transparent shadow-sm"></div>
               </div>
               <div 
                  className="absolute -top-3 -right-3 w-8 h-8 flex items-center justify-center z-20 touch-manipulation"
                  onMouseDown={(e) => { e.stopPropagation(); handleStart(e, 'tr'); }}
                  onTouchStart={(e) => { e.stopPropagation(); handleStart(e, 'tr'); }}
               >
                   <div className="w-4 h-4 border-t-4 border-r-4 border-indigo-400 rounded-tr-sm bg-transparent shadow-sm"></div>
               </div>
               <div 
                  className="absolute -bottom-3 -left-3 w-8 h-8 flex items-center justify-center z-20 touch-manipulation"
                  onMouseDown={(e) => { e.stopPropagation(); handleStart(e, 'bl'); }}
                  onTouchStart={(e) => { e.stopPropagation(); handleStart(e, 'bl'); }}
               >
                   <div className="w-4 h-4 border-b-4 border-l-4 border-indigo-400 rounded-bl-sm bg-transparent shadow-sm"></div>
               </div>
               <div 
                  className="absolute -bottom-3 -right-3 w-8 h-8 flex items-center justify-center z-20 touch-manipulation"
                  onMouseDown={(e) => { e.stopPropagation(); handleStart(e, 'br'); }}
                  onTouchStart={(e) => { e.stopPropagation(); handleStart(e, 'br'); }}
               >
                   <div className="w-4 h-4 border-b-4 border-r-4 border-indigo-400 rounded-br-sm bg-transparent shadow-sm"></div>
               </div>
          </div>
        </div>
      </div>

      {/* Footer Controls */}
      <div className="absolute bottom-0 inset-x-0 pb-10 pt-16 px-6 bg-gradient-to-t from-black via-black/80 to-transparent flex flex-col items-center justify-center gap-4 z-20 pointer-events-none">
         <p className="text-white/60 text-xs tracking-wider animate-pulse mb-2">{t('crop.hint')}</p>
         <button 
            onClick={performCrop}
            className="pointer-events-auto bg-white text-black px-8 py-4 rounded-full font-bold text-lg tracking-wide shadow-[0_0_20px_rgba(255,255,255,0.3)] active:scale-95 transition-transform flex items-center gap-2"
         >
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-5.197-5.197m0 0A7.5 7.5 0 105.196 5.196a7.5 7.5 0 0010.607 10.607z" /></svg>
            {t('crop.analyze')}
         </button>
      </div>
    </div>
  );
};