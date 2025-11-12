// frontend/src/utils/cloudinary.js
export const fixCloudinaryPdfUrl = (url) => {
  if (!url) return url;
  
  // Replace /image/upload/ with /raw/upload/ for PDFs
  if (url.includes('/image/upload/') && url.endsWith('.pdf')) {
    return url.replace('/image/upload/', '/raw/upload/');
  }
  
  return url;
};