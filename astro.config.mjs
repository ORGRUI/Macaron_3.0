import { defineConfig } from 'astro/config';
import react from '@astrojs/react';
import UnoCSS from 'unocss/astro';

export default defineConfig({
  output: 'static',
  devToolbar: { enabled: false },
  integrations: [
    react(),
    UnoCSS({ injectReset: false }),
  ],
  server: { host: '0.0.0.0', port: 3000 },
  vite: {
    resolve: {
      alias: {
        '$macaron/ui': '/lib/ui/src',
        'partial-react': '/lib/partial-react/src/runtime.tsx',
        'partial-react/compiler': '/lib/partial-react/src/compiler.ts',
        'partial-react/render-context': '/lib/partial-react/src/renderContext.ts',
        'partial-tsx': '/lib/partial-tsx/src/partial.ts',
        '@genui/importmap': '/lib/genui-importmap/src/importMap.ts',
        '@genui/unocss': '/lib/genui-unocss/src/unoScope.tsx',
      }
    },
    optimizeDeps: {
      force: true,
    },
  }
});
