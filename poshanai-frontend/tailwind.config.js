/** @type {import('tailwindcss').Config} */
export default {
  darkMode: 'class',
  content: [
    './index.html',
    './src/**/*.{js,ts,jsx,tsx}',
  ],
  theme: {
    extend: {
      colors: {
        leaf: '#244b36',
        forest: '#244b36',
        deepForest: '#173a2c',
        moss: '#728f5b',
        sage: '#e8eddf',
        paper: '#f8f7f1',
        cream: '#f8f7f1',
        ink: '#27362d',
      },
      fontFamily: {
        sans: ['Inter', 'ui-sans-serif', 'system-ui', '-apple-system', 'BlinkMacSystemFont', 'Segoe UI', 'sans-serif'],
      },
      boxShadow: {
        soft: '0 8px 24px rgb(23 58 44 / 8%)',
        card: '0 12px 32px rgb(23 58 44 / 10%)',
      },
    },
  },
  plugins: [],
};
