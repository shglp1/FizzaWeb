import type { Config } from 'tailwindcss';

const config: Config = {
  content: ['./src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        fizza: {
          primary: '#0B683A', secondary: '#14A34A', soft: '#C3E759', mint: '#A7F3D0', gold: '#FACC15', bg: '#F8FAF8', text: '#1F2937', danger: '#EF4444'
        }
      }
    }
  },
  plugins: []
};

export default config;
