import React, { useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { cropToPixels, DEFAULT_CROP, updateCrop, type CropHandle } from '../domain/crop';

interface CropViewProps {
  imageSrc: string;
  onConfirm: (croppedImage: string) => void;
  onCancel: () => void;
}

interface RenderedImageRect {
  left: number;
  top: number;
  width: number;
  height: number;
}

export const CropView: React.FC<CropViewProps> = ({ imageSrc, onConfirm, onCancel }) => {
  const { t } = useTranslation();
  const [crop, setCrop] = useState(DEFAULT_CROP);
  const [imageRect, setImageRect] = useState<RenderedImageRect>();
  const containerRef = useRef<HTMLDivElement>(null);
  const imageRef = useRef<HTMLImageElement>(null);
  const drag = useRef<{ handle: CropHandle; x: number; y: number }>();

  const measure = () => {
    const container = containerRef.current;
    const image = imageRef.current;
    if (!container || !image?.naturalWidth || !image.naturalHeight) return;
    const bounds = container.getBoundingClientRect();
    const scale = Math.min(bounds.width / image.naturalWidth, bounds.height / image.naturalHeight);
    const width = image.naturalWidth * scale;
    const height = image.naturalHeight * scale;
    setImageRect({
      left: (bounds.width - width) / 2,
      top: (bounds.height - height) / 2,
      width,
      height,
    });
  };

  useEffect(() => {
    const observer = new ResizeObserver(measure);
    if (containerRef.current) observer.observe(containerRef.current);
    return () => observer.disconnect();
  }, []);

  const startDrag = (event: React.PointerEvent, handle: CropHandle) => {
    event.preventDefault();
    event.stopPropagation();
    event.currentTarget.setPointerCapture(event.pointerId);
    drag.current = { handle, x: event.clientX, y: event.clientY };
  };

  const moveDrag = (event: React.PointerEvent) => {
    if (!drag.current || !imageRect) return;
    event.preventDefault();
    const deltaX = (event.clientX - drag.current.x) / imageRect.width * 100;
    const deltaY = (event.clientY - drag.current.y) / imageRect.height * 100;
    setCrop((current) => updateCrop(current, drag.current!.handle, deltaX, deltaY));
    drag.current = { ...drag.current, x: event.clientX, y: event.clientY };
  };

  const stopDrag = () => { drag.current = undefined; };

  const performCrop = () => {
    const image = imageRef.current;
    if (!image) return;
    const pixels = cropToPixels(crop, image.naturalWidth, image.naturalHeight);
    const canvas = document.createElement('canvas');
    canvas.width = pixels.width;
    canvas.height = pixels.height;
    const context = canvas.getContext('2d');
    if (!context) return;
    context.drawImage(
      image,
      pixels.x,
      pixels.y,
      pixels.width,
      pixels.height,
      0,
      0,
      pixels.width,
      pixels.height,
    );
    onConfirm(canvas.toDataURL('image/jpeg', 0.88));
  };

  const handles: Array<{ handle: CropHandle; className: string }> = [
    { handle: 'tl', className: '-left-4 -top-4' },
    { handle: 'tr', className: '-right-4 -top-4' },
    { handle: 'bl', className: '-bottom-4 -left-4' },
    { handle: 'br', className: '-bottom-4 -right-4' },
  ];

  return (
    <section className="absolute inset-0 z-50 flex flex-col bg-[#0b0b0a] text-white">
      <header className="absolute inset-x-0 top-0 z-20 flex items-center justify-between bg-gradient-to-b from-black/88 to-transparent px-5 pb-12 pt-[max(1rem,env(safe-area-inset-top))]">
        <button type="button" onClick={onCancel} className="ll-icon-button ll-pressable rounded-xl px-4 py-2.5 text-sm font-semibold">
          {t('crop.retake')}
        </button>
        <h2 className="font-mono text-[10px] font-medium uppercase tracking-[0.2em]">{t('crop.title')}</h2>
        <button type="button" onClick={() => onConfirm(imageSrc)} className="ll-icon-button ll-pressable rounded-xl px-4 py-2.5 text-sm font-semibold">
          {t('crop.useFullImage')}
        </button>
      </header>

      <div
        ref={containerRef}
        className="relative flex-1 overflow-hidden touch-none"
        onPointerMove={moveDrag}
        onPointerUp={stopDrag}
        onPointerCancel={stopDrag}
      >
        <img
          ref={imageRef}
          src={imageSrc}
          alt={t('crop.sourceAlt')}
          onLoad={measure}
          className="h-full w-full select-none object-contain opacity-45"
          draggable={false}
        />

        {imageRect && (
          <div
            className="absolute"
            style={{ left: imageRect.left, top: imageRect.top, width: imageRect.width, height: imageRect.height }}
          >
            <div
              className="absolute cursor-move touch-none border border-[#f2efe6] shadow-[0_0_0_9999px_rgba(0,0,0,0.58)]"
              style={{ left: `${crop.x}%`, top: `${crop.y}%`, width: `${crop.width}%`, height: `${crop.height}%` }}
              onPointerDown={(event) => startDrag(event, 'move')}
            >
              <div className="pointer-events-none absolute inset-0 overflow-hidden">
                <img
                  src={imageSrc}
                  alt=""
                  draggable={false}
                  className="absolute max-w-none select-none"
                  style={{
                    left: `-${crop.x / crop.width * 100}%`,
                    top: `-${crop.y / crop.height * 100}%`,
                    width: `${100 / crop.width * 100}%`,
                    height: `${100 / crop.height * 100}%`,
                  }}
                />
              </div>
              <div className="pointer-events-none absolute inset-0 grid grid-cols-3 grid-rows-3 opacity-35 [&>*]:border-white/70">
                <span className="border-e" /><span className="border-e" /><span />
                <span className="border-e border-t" /><span className="border-e border-t" /><span className="border-t" />
                <span className="border-e border-t" /><span className="border-e border-t" /><span className="border-t" />
              </div>
              {handles.map(({ handle, className }) => (
                <button
                  key={handle}
                  type="button"
                  aria-label={t('crop.resizeHandle')}
                  onPointerDown={(event) => startDrag(event, handle)}
                  className={`absolute z-10 h-9 w-9 touch-none rounded-xl border border-white/80 bg-[var(--ll-accent)] shadow-lg ${className}`}
                />
              ))}
            </div>
          </div>
        )}
      </div>

      <footer className="absolute inset-x-0 bottom-0 z-20 bg-gradient-to-t from-black via-black/90 to-transparent px-5 pb-[max(1.25rem,env(safe-area-inset-bottom))] pt-16 text-center">
        <p className="mb-3 font-mono text-[9px] uppercase tracking-[0.14em] text-white/52">{t('crop.hint')}</p>
        <button type="button" onClick={performCrop} className="ll-primary-action w-full rounded-[1.2rem] bg-[var(--ll-accent)] px-8 py-4 text-base font-bold text-[var(--ll-on-accent)]">
          {t('crop.analyze')}
        </button>
      </footer>
    </section>
  );
};
