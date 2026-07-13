import { resolve } from 'node:path'
import { defineConfig } from 'vite'
import type { Plugin } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'

function inlineCjsAssets(enabled: boolean): Plugin {
  return {
    name: 'swiftchess-inline-cjs-assets',
    enforce: 'pre',
    async resolveId(source, importer, options) {
      if (!enabled || !source.endsWith('?no-inline')) return null
      return this.resolve(source.slice(0, -'?no-inline'.length), importer, {
        ...options,
        skipSelf: true,
      })
    },
  }
}

function isolateSwiftChessCss(): Plugin {
  return {
    name: 'swiftchess-isolate-css',
    enforce: 'post',
    generateBundle(_options, bundle) {
      for (const output of Object.values(bundle)) {
        if (output.type !== 'asset' || !output.fileName.endsWith('.css')) continue
        let css = String(output.source)
        css = css.replaceAll('@layer properties', '@layer swiftchess-properties')
        css = css.replace(
          '*,:before,:after,::backdrop{',
          '.swiftchess-root,.swiftchess-root *,.swiftchess-root:before,.swiftchess-root:after,.swiftchess-root :before,.swiftchess-root :after{',
        )
        css = css.replace(':root,:host{--sw-', '.swiftchess-root{--sw-')
        css = css.replace(/@property --tw-[\w-]+\{[^{}]*\}/g, '')
        output.source = css
      }
    },
  }
}

export default defineConfig(({ mode }) => {
  const isCjsBuild = mode === 'library-cjs'

  return {
    base: './',
    plugins: [
      inlineCjsAssets(isCjsBuild),
      react(),
      tailwindcss(),
      isolateSwiftChessCss(),
    ],
    build: {
      copyPublicDir: false,
      emptyOutDir: !isCjsBuild,
      lib: {
        entry: resolve(__dirname, 'src/lib/build-entry.ts'),
        formats: [isCjsBuild ? 'cjs' : 'es'],
        fileName: (format) => (format === 'es' ? 'index.js' : 'index.cjs'),
        cssFileName: 'style',
      },
      sourcemap: !isCjsBuild,
      rollupOptions: {
        external: ['react', 'react-dom', 'react/jsx-runtime', 'chess.js'],
      },
    },
  }
})
