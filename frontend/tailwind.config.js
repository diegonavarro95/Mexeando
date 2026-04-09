export default {
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        rojo: '#C1121F',
        amarillo: '#F4A300',
        verde: '#2D6A4F',
        verdeLight: '#52B788',
        naranja: '#E85D04',
        bgDark: '#110800',
        crema: '#FFF3DC',
      }
    }
  },
  plugins: [

function({ addUtilities }) {
    addUtilities({
      '.scrollbar-hide': {
        '-ms-overflow-style': 'none',
        'scrollbar-width': 'none',
        '&::-webkit-scrollbar': { display: 'none' },
      },
    });
  }

  ]
}