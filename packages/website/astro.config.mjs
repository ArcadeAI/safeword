import path from 'node:path';

import starlight from '@astrojs/starlight';
import { defineConfig } from 'astro/config';

const __dirname = import.meta.dirname;

export default defineConfig({
  site: 'https://safeword.dev',
  vite: {
    cacheDir: path.resolve(__dirname, 'node_modules/.vite'),
  },
  integrations: [
    starlight({
      title: 'Safeword',
      customCss: ['./src/styles/custom.css'],
      description: 'The first coding agent discipline system for Cursor and Claude Code',
      head: [
        // Open Graph
        { tag: 'meta', attrs: { property: 'og:type', content: 'website' } },
        {
          tag: 'meta',
          attrs: {
            property: 'og:title',
            content: 'Safeword - The first coding agent discipline system',
          },
        },
        {
          tag: 'meta',
          attrs: {
            property: 'og:description',
            content:
              "Your agent doesn't get to finish until the tests pass. Discipline for Cursor and Claude Code.",
          },
        },
        {
          tag: 'meta',
          attrs: { property: 'og:site_name', content: 'Safeword' },
        },
        // Twitter
        {
          tag: 'meta',
          attrs: { name: 'twitter:card', content: 'summary_large_image' },
        },
        {
          tag: 'meta',
          attrs: {
            name: 'twitter:title',
            content: 'Safeword - Coding agent discipline system',
          },
        },
        {
          tag: 'meta',
          attrs: {
            name: 'twitter:description',
            content: "Your agent doesn't get to finish until the tests pass.",
          },
        },
      ],
      social: [
        {
          icon: 'github',
          label: 'GitHub',
          href: 'https://github.com/TheMostlyGreat/safeword',
        },
      ],
      sidebar: [
        { label: 'Quick Start', slug: 'getting-started/quick-start' },
        { label: 'FAQ', slug: 'getting-started/faq' },
        {
          label: 'Reference',
          items: [
            { label: 'CLI', slug: 'reference/cli' },
            { label: 'Hooks & Skills', slug: 'reference/hooks-and-skills' },
            { label: 'Configuration', slug: 'reference/configuration' },
          ],
        },
      ],
      editLink: {
        baseUrl: 'https://github.com/TheMostlyGreat/safeword/edit/main/packages/website/',
      },
    }),
  ],
});
