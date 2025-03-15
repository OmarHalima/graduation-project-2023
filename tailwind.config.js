/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,ts,jsx,tsx}'],
  darkMode: 'class',
  theme: {
    extend: {
      colors: {
        dark: {
          background: '#121212',
          surface: '#1e1e1e',
          border: '#2e2e2e',
          text: {
            primary: '#ffffff',
            secondary: '#a0a0a0',
          },
        },
      },
    },
  },
  plugins: [],
};
