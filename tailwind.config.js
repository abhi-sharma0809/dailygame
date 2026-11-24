/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        night: { DEFAULT: '#101923', 2: '#16222E', 3: '#1D2C3A' },
        forest: { DEFAULT: '#19382E', light: '#2A5244' },
        moss: { DEFAULT: '#78936B', light: '#9DB28F' },
        parchment: { DEFAULT: '#F0E6D1', dark: '#E2D3B4', edge: '#CDBB96' },
        gold: { DEFAULT: '#D9AD63', light: '#ECCB8B', deep: '#B4843C' },
        sky: { DEFAULT: '#89B7CE', light: '#B5D3E2' },
        ink: { DEFAULT: '#26323A', soft: '#4A5761', faint: '#7A8790' },
        cream: '#F8F3E8',
        ember: '#C8693F',
        plum: '#5E4E7A',
      },
      fontFamily: {
        display: ['Fraunces', 'Georgia', 'serif'],
        sans: ['"DM Sans"', 'system-ui', 'sans-serif'],
        mono: ['"IBM Plex Mono"', 'ui-monospace', 'monospace'],
        pixel: ['"Pixelify Sans"', '"DM Sans"', 'system-ui', 'sans-serif'],
      },
      boxShadow: {
        paper: '0 1px 0 rgba(255,255,255,.6) inset, 0 18px 40px -18px rgba(8,14,20,.75), 0 2px 6px rgba(8,14,20,.35)',
        lift: '0 24px 60px -24px rgba(5,10,15,.85)',
        glow: '0 0 0 1px rgba(217,173,99,.5), 0 0 30px -6px rgba(217,173,99,.55)',
      },
    },
  },
  plugins: [],
};
