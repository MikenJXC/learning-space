import { copyFile, mkdir } from "node:fs/promises";

// Serve the worker as an untransformed static asset. Some dev loaders inject
// browser-only code into JS modules, which cannot run in a worker context.
await mkdir(new URL("../public/", import.meta.url), {recursive: true});
await copyFile(
  new URL("../node_modules/pdfjs-dist/build/pdf.worker.min.mjs", import.meta.url),
  new URL("../public/pdf.worker.min.mjs", import.meta.url),
);
