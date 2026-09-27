/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,ts,jsx,tsx}'],
  darkMode: 'class',
  theme: {
    extend: {
      colors: {
        leaf: { DEFAULT: '#1E5631', light: '#4CAF50', dark: '#123B22' },
        orange: { DEFAULT: '#F57C00', light: '#FFA726', dark: '#C45F00' },
        cream: '#F9FBF9',
        success: '#16A34A', warning: '#F59E0B', danger: '#DC2626',
      },
      fontFamily: {
        sans: ['Inter', 'ui-sans-serif', 'system-ui'],
        heading: ['Poppins', 'Inter', 'ui-sans-serif', 'system-ui'],
        mono: ['JetBrains Mono', 'ui-monospace', 'monospace'],
      },
    },
  },
  plugins: [],
};
