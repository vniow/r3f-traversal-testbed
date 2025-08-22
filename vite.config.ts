import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import type { Plugin } from 'vite';

import tailwindcss from '@tailwindcss/vite';

// Small plugin to strip sourceMappingURL comments from dependencies
// that ship incorrect/missing sourcemap references. This prevents
// the dev server from logging "Could not read source map" messages
// for files inside node_modules.
function stripSourceMapPlugin(): Plugin {
  return {
    name: 'strip-sourcemap-comments',
    enforce: 'post',
    transform(code: string, id: string) {
      if (!id || !id.includes('node_modules')) return null;
      if (typeof code !== 'string') return null;
      const out = code
        // remove single-line sourcemap comments
        .replace(/\/\/#[ \t]*sourceMappingURL=.*$/gm, '')
        // remove block sourcemap comments
        .replace(/\/\*#?[ \t]*sourceMappingURL=.*?\*\//gs, '');
      if (out === code) return null;
      return { code: out, map: null };
    },
  };
}

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [react(), tailwindcss(), stripSourceMapPlugin()],
});
