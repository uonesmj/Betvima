import type { Config } from 'tailwindcss';

const config: Config = {
  content: ['./src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        nova: {
          bg: '#080B14', surface: '#0E1322', surface2: '#141A2C', line: '#1E2740',
          text: '#E8EDF7', muted: '#8C99B4',
          primary: '#00E07A', primaryDark: '#00B863',
          danger: '#FF4D6A', warn: '#FFB020', info: '#3DA5FF', gold: '#F5C451',
        },
      },
      screens: { xs: '360px' },
      fontFamily: { sans: ['var(--nova-font)', 'system-ui', 'Segoe UI', 'Tahoma', 'sans-serif'] },
      keyframes: {
        'flash-up': { '0%': { backgroundColor: 'rgba(0,224,122,0.35)' }, '100%': { backgroundColor: 'transparent' } },
        'flash-down': { '0%': { backgroundColor: 'rgba(255,77,106,0.35)' }, '100%': { backgroundColor: 'transparent' } },
        shimmer: { '100%': { transform: 'translateX(100%)' } },
      },
      animation: { 'flash-up': 'flash-up 1.2s ease-out', 'flash-down': 'flash-down 1.2s ease-out' },
    },
  },
  plugins: [],
};
export default config;
