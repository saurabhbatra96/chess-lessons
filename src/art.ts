// Optional Midjourney art: drop files named in art/PROMPTS.md into src/art/ and they appear.
const files = import.meta.glob('./art/*.{jpg,jpeg,png,webp}', {
  query: '?url',
  import: 'default',
  eager: true,
}) as Record<string, string>;

export function artUrl(name: string): string | null {
  const match = Object.keys(files).find((path) => path.replace(/^.*\//, '').replace(/\.\w+$/, '') === name);
  return match ? files[match] : null;
}

export function artImage(name: string, alt: string, className: string): string {
  const url = artUrl(name);
  return url ? `<img class="${className}" src="${url}" alt="${alt}">` : '';
}
