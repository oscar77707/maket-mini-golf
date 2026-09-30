/** Couleurs #RRGGBB : normalisation et contraste (WCAG) pour éviter un texte illisible. */

const HEX = /^#[0-9A-Fa-f]{6}$/;

export const isHexColor = (value: string) => HEX.test(value);

function luminance(hex: string) {
  const channels = [1, 3, 5].map((i) => {
    const c = parseInt(hex.slice(i, i + 2), 16) / 255;
    return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
  });
  return 0.2126 * channels[0] + 0.7152 * channels[1] + 0.0722 * channels[2];
}

/** Rapport de contraste entre deux couleurs (de 1 à 21). */
export function contrastRatio(a: string, b: string) {
  const [hi, lo] = [luminance(a), luminance(b)].sort((x, y) => y - x);
  return (hi + 0.05) / (lo + 0.05);
}

/** Couleurs de texte définies dans globals.css par-dessus la couleur principale et la secondaire. */
export const TEXT_ON_PRIMARY = "#FFFFFF";
export const TEXT_ON_SECONDARY = "#3B2500";
