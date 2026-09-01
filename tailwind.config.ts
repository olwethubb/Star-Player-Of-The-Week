import type { Config } from 'tailwindcss';

export default {
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        bg: 'var(--bg)',
        'bg-elevated': 'var(--bg-elevated)',
        'bg-card': 'var(--bg-card)',
        text: 'var(--text)',
        'text-muted': 'var(--text-muted)',
        border: 'var(--border)',
        'border-soft': 'var(--border-soft)',
        accent: 'var(--accent)',
        'accent-contrast': 'var(--accent-contrast)',
        'on-dark': 'var(--on-dark)',
        'on-dark-muted': 'var(--on-dark-muted)',
        'on-dark-surface': 'var(--on-dark-surface)',
        'on-dark-surface-border': 'var(--on-dark-surface-border)',
      },
      fontFamily: {
        sans: ['Inter', 'system-ui', 'sans-serif'],
        display: ['"Space Grotesk"', 'sans-serif'],
        mono: ['"JetBrains Mono"', 'monospace'],
        serif: ['Fraunces', 'Georgia', '"Iowan Old Style"', '"Times New Roman"', 'serif'],
      },
      boxShadow: {
        card: '0 1px 2px rgba(32,26,20,0.08), 0 8px 24px rgba(32,26,20,0.10)',
      },
    },
  },
  plugins: [],
} satisfies Config;
