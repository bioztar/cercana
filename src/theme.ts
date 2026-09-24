// Palette from Andrey's Claude Design mockups (design/mockups). Keys are shared by every screen —
// change values here, never hardcode colours in screens.
// Contrast: ink on bg ≈ 15:1; white on terracotta ≈ 6:1; white on ink ≈ 16:1; inkSoft on bg ≈ 6.6:1.
export const colors = {
  bg: '#F7F3EC',         // cream page
  card: '#FFFFFF',
  ink: '#1F1B16',        // text + primary dark buttons
  inkSoft: '#5E574E',    // secondary text
  line: '#E4DACB',       // borders, dividers
  lineSoft: '#EDE5D8',
  terracotta: '#A34A24', // accent: links, primary action buttons, badges
  terracottaDark: '#7E3719',
  peach: '#F6D2B8',      // tinted surfaces (event chips, highlights)
  peachSoft: '#FBEFE7',
  warm: '#F6D2B8',       // legacy alias used by banners — same as peach
  coral: '#E8735A',
  blue: '#234A70',       // secondary group accent
  blueSoft: '#D3DEEA',
  green: '#2F6B3A',      // call / "yes" actions (AA on white)
  sage: '#7FAE68',       // decorative only
  gold: '#F2D27A',
  danger: '#D9483B',
  white: '#FFFFFF',
};

// Fonts from the mockups. Loaded in App.tsx via expo-font (@expo-google-fonts/*);
// until loaded, fall back to the system font so nothing blocks rendering.
export const fonts = {
  display: 'Fraunces_600SemiBold',    // headings
  displayMedium: 'Fraunces_500Medium',
  body: 'AtkinsonHyperlegible_400Regular',
  bodyBold: 'AtkinsonHyperlegible_700Bold',
};

// Patient-side type scale (px; RN Text scales with system font size by default).
// Deliberately larger than the mockups' 16–20 px: readability for the patient wins.
export const type = { body: 22, label: 20, name: 28, title: 40, huge: 48 };

// Family-side type scale, matching the mockups.
export const typeFamily = { small: 14, body: 17, label: 16, title: 22, huge: 30 };

export const radius = { sm: 9, md: 14, lg: 20, xl: 22, pill: 999 };

export const TARGET = 64; // minimum touch-target height
export const MAX_WIDTH = 1100;
