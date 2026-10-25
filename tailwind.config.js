/** @type {import('tailwindcss').Config} */
module.exports = {
  content: ['./app/**/*.{js,ts,jsx,tsx,mdx}', './components/**/*.{js,ts,jsx,tsx,mdx}'],
  theme: {
    extend: {
      fontFamily: {
        sans: ['Commissioner', 'ui-sans-serif', 'system-ui', 'sans-serif'],
      },
      keyframes: {
        sheet: { from: { transform: 'translateY(24px)', opacity: '0' }, to: { transform: 'translateY(0)', opacity: '1' } },
        fade: { from: { opacity: '0' }, to: { opacity: '1' } },
        pop: { from: { transform: 'scale(0.96)', opacity: '0' }, to: { transform: 'scale(1)', opacity: '1' } },
      },
      animation: {
        sheet: 'sheet 220ms cubic-bezier(0.2, 0.8, 0.2, 1)',
        fade: 'fade 180ms ease-out',
        pop: 'pop 160ms ease-out',
      },
    },
  },
  plugins: [],
}
