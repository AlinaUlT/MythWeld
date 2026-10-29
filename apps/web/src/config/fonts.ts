// SHEET-06: the font packages the app ships (src/theme/fonts.css). The build copies each one's
// LICENSE into fonts/<file>, as the SIL Open Font License asks of every copy of the font.
export const FONT_PACKAGES = [
  { name: '@fontsource-variable/inter', license: 'fonts/inter-OFL.txt' },
  { name: '@fontsource-variable/eb-garamond', license: 'fonts/eb-garamond-OFL.txt' },
] as const;
