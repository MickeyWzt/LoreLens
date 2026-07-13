export async function normalizeImageFile(file: File, maxDimension = 2560): Promise<string> {
  if (!file.type.startsWith('image/')) throw new Error('Unsupported image type');

  if ('createImageBitmap' in window) {
    const bitmap = await createImageBitmap(file, { imageOrientation: 'from-image' });
    const scale = Math.min(1, maxDimension / Math.max(bitmap.width, bitmap.height));
    const canvas = document.createElement('canvas');
    canvas.width = Math.max(1, Math.round(bitmap.width * scale));
    canvas.height = Math.max(1, Math.round(bitmap.height * scale));
    const context = canvas.getContext('2d');
    if (!context) throw new Error('Image processing is unavailable');
    context.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
    bitmap.close();
    return canvas.toDataURL('image/jpeg', 0.9);
  }

  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onerror = () => reject(new Error('Could not read the image'));
    reader.onload = () => {
      const image = new Image();
      image.onerror = () => reject(new Error('Could not decode the image'));
      image.onload = () => {
        const scale = Math.min(1, maxDimension / Math.max(image.naturalWidth, image.naturalHeight));
        const canvas = document.createElement('canvas');
        canvas.width = Math.max(1, Math.round(image.naturalWidth * scale));
        canvas.height = Math.max(1, Math.round(image.naturalHeight * scale));
        const context = canvas.getContext('2d');
        if (!context) return reject(new Error('Image processing is unavailable'));
        context.drawImage(image, 0, 0, canvas.width, canvas.height);
        resolve(canvas.toDataURL('image/jpeg', 0.9));
      };
      image.src = String(reader.result);
    };
    reader.readAsDataURL(file);
  });
}
