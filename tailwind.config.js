/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./*.{js,ts,jsx,tsx}",
    "./components/**/*.{js,ts,jsx,tsx}",
    "./pages/**/*.{js,ts,jsx,tsx}",
    "./src/**/*.{js,ts,jsx,tsx}"
  ],
  theme: {
    extend: {
      colors: {
        gray: { 50: '#F6F8FA', 100: '#F3F4F6', 200: '#E5E7EB', 300: '#D1D5DB', 400: '#9CA3AF', 500: '#6B7280', 600: '#4B5563', 700: '#374151', 800: '#1F2937', 900: '#111827' },
        indigo: { 50: '#F2F2F5', 100: '#E6E6EA', 500: '#3C3C52', 600: '#323244', 700: '#282836' },
        amber: { 50: '#FFFAEB', 100: '#FEF3C7', 400: '#FFBF00', 500: '#F59E0B' },
      },
      fontFamily: { sans: ['Inter', 'sans-serif'] },
      animation: { 'neon-pulse': 'neon-pulse 2s infinite' },
      keyframes: { 'neon-pulse': { '0%, 100%': { boxShadow: 'inset 0 0 0 4px #FACC15' }, '50%': { boxShadow: 'inset 0 0 15px 4px #CCFF00' } } }
    },
  },
  plugins: [],
}