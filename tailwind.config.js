/** @type {import('tailwindcss').Config} */
export default {
  content: [
    './index.html',
    './src/**/*.{js,ts,jsx,tsx}',
  ],
  theme: {
    extend: {
      colors: {
        bg: '#0B0B0B',
        surface: '#141414',
        border: '#232323',
        muted: '#2A2A2A',
        text: {
          primary: '#FFFFFF',
          secondary: '#B3B3B3',
          disabled: '#7A7A7A',
        },
        accent: {
          DEFAULT: '#E67E22',
          light: '#FFB347',
          hover: 'rgba(230,126,34,0.12)',
        },
      },
      boxShadow: {
        weak: '0 2px 6px rgba(0,0,0,0.6)',
        accent: '0 6px 18px rgba(230,126,34,0.06)',
      },
      fontFamily: {
        sans: ['Inter', 'system-ui', '-apple-system', 'Segoe UI', 'Roboto', 'Helvetica Neue', 'Arial', 'sans-serif'],
        display: ['Inter', 'system-ui', '-apple-system', 'Segoe UI', 'Roboto', 'Helvetica Neue', 'Arial', 'sans-serif'],
      },
      borderRadius: {
        xl: '16px',
        '2xl': '20px',
      },
      transitionDuration: {
        220: '220ms',
      },
    },
  },
  plugins: [],
}
