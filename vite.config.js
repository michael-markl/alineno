import { defineConfig } from "vite";
import { viteSingleFile } from "vite-plugin-singlefile";
import { viteStaticCopy } from "vite-plugin-static-copy";

export default defineConfig({
  base: "./",
  build: {
    outDir: "dist",
    sourcemap: true,
  },
  plugins: [
    {
      name: 'crossorigin',
      transformIndexHtml(html) {
        return html.replace(/crossorigin/g, '');
      },
    },
    {
      generateBundle(options, bundle) {
        for (const url in bundle) {
          // 2. Then replace `crossOrigin`
          if (bundle[url].name === 'helper') {
            bundle[url].code = bundle[url].code.replace(
              'crossOrigin=""',
              ''
            );
          }
        }
      },
    },
    viteSingleFile(),
    viteStaticCopy({
      targets: [
        {
          src: "node_modules/pdfjs-dist/build/pdf.worker.min.mjs",
          dest: "assets/",
        },
      ],
    }),
  ],
  server: {
    cors: false,
  },
});
