/** @type {import('tailwindcss').Config} */
module.exports = {
  content: ['./views/**/*.ejs', './public/js/**/*.js'],
  theme: {
    extend: {
      colors: {
        brand: {
          50: '#f0f9ff',
          100: '#e0f2fe',
          500: '#0ea5e9',
          600: '#0284c7',
          700: '#0369a1'
        }
      },
      boxShadow: {
        soft: '0 10px 30px -12px rgba(2, 132, 199, 0.35)'
      }
    }
  },
  plugins: []
};
