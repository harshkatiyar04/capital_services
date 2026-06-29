/**
 * Cloudinary image URLs — update here when new assets are uploaded.
 * Used as reference; hero images are embedded in index.html and about.html.
 */
export const CLOUDINARY_IMAGES = {
  heroHome:
    'https://res.cloudinary.com/dhlmxyh9f/image/upload/v1782706135/hero-home_rtckml.jpg',
  heroAbout:
    'https://res.cloudinary.com/dhlmxyh9f/image/upload/v1782706127/hero-about_ynpawl.jpg',
};

/** Append Cloudinary auto-format, quality, and max width */
export function cloudinaryUrl(baseUrl, width = 1920) {
  return baseUrl.replace('/upload/', `/upload/f_auto,q_auto,w_${width}/`);
}
