// Copyright 2026 VirtusCo
// esbuild.config.js — Dual-bundle: extension host + webview
const esbuild = require('esbuild');

const isWatch = process.argv.includes('--watch');
const isProduction = process.argv.includes('--production');

/** @type {esbuild.BuildOptions} */
const extensionConfig = {
  entryPoints: ['src/extension.ts'],
  bundle: true,
  outfile: 'dist/extension.js',
  external: ['vscode'],
  format: 'cjs',
  platform: 'node',
  target: 'node18',
  sourcemap: !isProduction,
  minify: isProduction,
  logLevel: 'info',
};

/** @type {esbuild.BuildOptions} */
const webviewConfig = {
  entryPoints: ['webview-ui/src/index.tsx'],
  bundle: true,
  outfile: 'dist/webview.js',
  format: 'esm',
  platform: 'browser',
  target: 'es2022',
  sourcemap: !isProduction,
  minify: true,
  logLevel: 'info',
  jsx: 'automatic',
  loader: {
    '.tsx': 'tsx',
    '.ts': 'ts',
    '.css': 'css',
  },
  define: {
    'process.env.NODE_ENV': '"production"',
  },
};

async function build() {
  if (isWatch) {
    const extCtx = await esbuild.context(extensionConfig);
    const webCtx = await esbuild.context(webviewConfig);
    await Promise.all([extCtx.watch(), webCtx.watch()]);
    console.log('[watch] Watching for changes...');
  } else {
    await Promise.all([
      esbuild.build(extensionConfig),
      esbuild.build(webviewConfig),
    ]);
  }
}

build().catch((err) => {
  console.error(err);
  process.exit(1);
});
