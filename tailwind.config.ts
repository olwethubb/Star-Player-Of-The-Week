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
        'accent-dark': 'var(--accent-dark)',
        'accent-ink': 'var(--accent-ink)',
        'accent-contrast': 'var(--accent-contrast)',
        'on-dark': 'var(--on-dark)',
        'on-dark-muted': 'var(--on-dark-muted)',
        'on-dark-surface': 'var(--on-dark-surface)',
        'on-dark-surface-border': 'var(--on-dark-surface-border)',
      },
      // One typeface, like blacfox.com itself — every alias below resolves to the
      // same Montserrat stack rather than four different fonts, so nothing else in
      // the app has to change which `font-*` class it reaches for. Weight and style
      // (bold, italic, uppercase+tracked for an eyebrow) still come from ordinary
      // Tailwind utilities at each call site.
      fontFamily: {
        sans: ['Montserrat', 'system-ui', 'sans-serif'],
        display: ['Montserrat', 'system-ui', 'sans-serif'],
        mono: ['Montserrat', 'system-ui', 'sans-serif'],
        serif: ['Montserrat', 'system-ui', 'sans-serif'],
      },
      boxShadow: {
        card: '0 1px 2px rgba(10,10,10,0.06), 0 8px 24px rgba(10,10,10,0.08)',
      },
    },
  },
  plugins: [],
} satisfies Config;
