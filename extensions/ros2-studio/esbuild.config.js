// Copyright 2026 VirtusCo
// esbuild dual-bundle config: extension host (Node.js) + webview (browser)

const esbuild = require("esbuild");

const isWatch = process.argv.includes("--watch");
const isProduction = process.argv.includes("--production");

/** @type {import('esbuild').BuildOptions} */
const extensionConfig = {
  entryPoints: ["src/extension.ts"],
  bundle: true,
  outfile: "dist/extension.js",
  format: "cjs",
  platform: "node",
  target: "node18",
  external: ["vscode", "ws"],
  sourcemap: !isProduction,
  minify: isProduction,
  tsconfig: "tsconfig.json",
  logLevel: "info",
};

/** @type {import('esbuild').BuildOptions} */
const webviewConfig = {
  entryPoints: ["webview-ui/src/index.tsx"],
  bundle: true,
  outfile: "dist/webview.js",
  format: "esm",
  platform: "browser",
  target: "es2022",
  sourcemap: !isProduction,
  minify: true,
  tsconfig: "tsconfig.webview.json",
  loader: {
    ".css": "css",
    ".svg": "dataurl",
    ".png": "dataurl",
  },
  define: {
    "process.env.NODE_ENV": '"production"',
  },
  logLevel: "info",
};

async function build() {
  if (isWatch) {
    const [extCtx, webCtx] = await Promise.all([
      esbuild.context(extensionConfig),
      esbuild.context(webviewConfig),
    ]);
    await Promise.all([extCtx.watch(), webCtx.watch()]);
    console.log("[virtus-ros2-studio] Watching for changes...");
  } else {
    await Promise.all([
      esbuild.build(extensionConfig),
      esbuild.build(webviewConfig),
    ]);
    console.log("[virtus-ros2-studio] Build complete.");
  }
}

build().catch((err) => {
  console.error(err);
  process.exit(1);
});
