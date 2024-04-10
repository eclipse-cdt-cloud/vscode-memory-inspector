// @ts-check
const esbuild = require('esbuild');
const path = require('path');

const watch = process.argv.includes('--watch') || process.argv.includes('-w');
const dev = watch || process.argv.includes('--dev') || process.argv.includes('-d');

const defaults = {
    bundle: true,
    minify: !dev,
    sourcemap: !dev,
    external: ['vscode']
}

const srcDir = path.join(__dirname, 'src');
const distDir = path.join(__dirname, 'dist');

/** @type {import('esbuild').BuildOptions} */
const desktopPluginConfig = {
    ...defaults,
    entryPoints: [path.join(srcDir, 'entry-points', 'desktop', 'extension.ts')],
    outdir: path.join(distDir, 'desktop'),
    format: 'cjs',
    platform: 'node',
    target: ['es2020'],
}

/** @type {import('esbuild').BuildOptions} */
const browserPluginConfig = {
    ...defaults,
    entryPoints: [path.join(srcDir, 'entry-points', 'browser', 'extension.ts')],
    outdir: path.join(distDir, 'browser'),
    format: 'cjs',
    platform: 'neutral',
    mainFields: ['main', 'module'],
    target: ['es2020'],
}

/** @type {import('esbuild').BuildOptions} */
const webviewConfig = {
    ...defaults,
    entryPoints: [path.join(srcDir, 'webview', 'memory-webview-view.tsx')],
    inject: [path.join(srcDir, 'webview', 'buffer-shim.js')],
    outfile: path.join(distDir, 'views', 'memory.js'),
    format: 'esm',
    platform: 'browser',
    target: ['es2020'],
    loader: { ".ttf": "copy" },
}

const allConfigs = [
    desktopPluginConfig,
    browserPluginConfig,
    webviewConfig
];

async function main() {
    if (watch) {
        await Promise.all(allConfigs.map(config => esbuild.context(config).then(context => context.watch())));
    } else {
        await Promise.all(allConfigs.map(config => esbuild.build(config)));
    }
}

main();
