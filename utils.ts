export const triggerHaptic = (pattern: number | number[] = 50) => {
  if (typeof window !== 'undefined' && navigator.vibrate) {
    // navigator.vibrate can fail in some cross-origin iframes without permissions, 
    // but we wrap it in a try-catch just in case or just let it attempt
    try {
      navigator.vibrate(pattern);
    } catch (e) {
      console.warn('Vibration API error', e);
    }
  }
};

export const compressHistoryImage = (base64Str: string, maxDim = 400, quality = 0.6): Promise<string> => {
  return new Promise((resolve) => {
    const img = new Image();
    img.crossOrigin = 'anonymous';
    img.src = base64Str;
    img.onload = () => {
      const canvas = document.createElement('canvas');
      let width = img.width;
      let height = img.height;
      if (width > maxDim || height > maxDim) {
        if (width > height) {
          height = (maxDim / width) * height;
          width = maxDim;
        } else {
          width = (maxDim / height) * width;
          height = maxDim;
        }
      }
      canvas.width = width;
      canvas.height = height;
      const ctx = canvas.getContext('2d');
      if (ctx) {
        ctx.drawImage(img, 0, 0, width, height);
        // WebP is highly optimized for local storage databases (falls back to jpeg where webp isn't supported)
        resolve(canvas.toDataURL('image/webp', quality));
      } else {
        resolve(base64Str);
      }
    };
    img.onerror = () => {
      resolve(base64Str);
    };
  });
};

