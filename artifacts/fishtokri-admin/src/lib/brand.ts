export const BRAND_COLORS = {
  primary: "#F05B4E",
  primary50: "#FEF1EF",
  primary100: "#FCDDDA",
  primary600: "#D94A3D",

  secondary: "#364F9F",
  secondary50: "#EEF1F9",
  secondary100: "#D6DDF0",
  secondary600: "#2C418A",
} as const;

export type BrandColorKey = keyof typeof BRAND_COLORS;
