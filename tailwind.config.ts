import type { Config } from 'tailwindcss'

const config: Config = {
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        plum: {
          950: '#180E20',
          900: '#24172F',
          850: '#2A1B38',
          800: '#302041',
          700: '#35233F',
          600: '#453052',
          500: '#584066',
          400: '#70597F',
        },
        copper: {
          200: '#FFD4C2',
          300: '#FFB79E',
          400: '#FFA381',
          500: '#FF936B',
          600: '#F0764A',
          700: '#C95A33',
        },
        'sea': {
          200: '#B6F0E4',
          300: '#8AE8D6',
          400: '#63D8C2',
          500: '#3FC0AA',
          600: '#2B9E8B',
          700: '#1F7769',
        },
        ivory: '#FFF4EB',
        lavender: '#C7B7CC',
        amber: {
          400: '#F5B84C',
          500: '#E89B2E',
        },
        critical: {
          400: '#F58080',
          500: '#E85C5C',
        },
      },
      fontFamily: {
        sans: ['"Inter Variable"', 'Inter', 'system-ui', '-apple-system', 'Segoe UI', 'sans-serif'],
        display: ['"Space Grotesk Variable"', '"Space Grotesk"', 'Inter', 'system-ui', 'sans-serif'],
        mono: ['"JetBrains Mono"', 'ui-monospace', 'SFMono-Regular', 'Menlo', 'Consolas', 'monospace'],
      },
      boxShadow: {
        panel: '0 1px 0 0 rgba(255,244,235,0.04) inset, 0 12px 32px -12px rgba(10,5,16,0.55)',
        glowCopper: '0 0 24px -6px rgba(255,147,107,0.45)',
        glowTeal: '0 0 24px -6px rgba(99,216,194,0.4)',
      },
      backgroundImage: {
        'hero-radial':
          'radial-gradient(1200px 600px at 75% 0%, rgba(99,216,194,0.08), transparent 60%), radial-gradient(900px 500px at 10% 100%, rgba(255,147,107,0.09), transparent 55%)',
        'grid-fine':
          'linear-gradient(rgba(199,183,204,0.055) 1px, transparent 1px), linear-gradient(90deg, rgba(199,183,204,0.055) 1px, transparent 1px)',
      },
      backgroundSize: {
        'grid-fine': '28px 28px',
      },
    },
  },
  plugins: [],
}

export default config
