import { defineManifest } from '@crxjs/vite-plugin';

export default defineManifest({
  manifest_version: 3,
  name: 'Alphamolt Reply Writer',
  version: '0.1.0',
  description:
    'Drafts replies on X, Bluesky, and Reddit in the voice of Alphamolt using Claude Opus 4.7.',
  permissions: ['storage'],
  host_permissions: [
    'https://api.anthropic.com/*',
    'https://x.com/*',
    'https://twitter.com/*',
    'https://bsky.app/*',
    'https://*.reddit.com/*',
  ],
  background: {
    service_worker: 'src/background/service-worker.ts',
    type: 'module',
  },
  options_ui: {
    page: 'src/options/options.html',
    open_in_tab: true,
  },
  action: {
    default_title: 'Alphamolt Reply Writer — open settings',
  },
  icons: {
    16: 'icons/icon-16.png',
    48: 'icons/icon-48.png',
    128: 'icons/icon-128.png',
  },
  content_scripts: [
    {
      matches: ['https://x.com/*', 'https://twitter.com/*'],
      js: ['src/content/x.ts'],
      run_at: 'document_idle',
    },
    {
      matches: ['https://bsky.app/*'],
      js: ['src/content/bluesky.ts'],
      run_at: 'document_idle',
    },
    {
      matches: ['https://*.reddit.com/*'],
      js: ['src/content/reddit.ts'],
      run_at: 'document_idle',
    },
  ],
});
