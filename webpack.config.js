//@ts-check
'use strict';

const path = require('path');
const webpack = require('webpack');

/** @typedef {import('webpack').Configuration} WebpackConfig **/
/** @type {WebpackConfig} */
const common = {
    mode: 'development',
    devtool: 'inline-source-map',
    module: {
        rules: [
            {
                test: /\.tsx?$/,
                use: 'ts-loader',
                exclude: /node_modules/
            },
            {
                test: /\.m?js/,
                resolve: {
                    fullySpecified: false
                }
            },
            {
                test: /\.css$/i,
                use: [
                  "style-loader",
                  "css-loader",
                ],
            },
        ]
    },
    externals: {
        vscode: 'commonjs vscode'
    }
};

/** @type {WebpackConfig[]} */
module.exports = [
    {
        ...common,
        target: 'node',
        entry: {
            extension: './src/entry-points/desktop/extension.ts'
        },
        output: {
            filename: '[name].js',
            path: path.resolve(__dirname, 'dist', 'desktop'),
            libraryTarget: 'commonjs'
        },
        resolve: {
            extensions: ['.ts', '.js']
        }
    },
    {
        ...common,
        target: 'webworker',
        entry: {
            extension: './src/entry-points/browser/extension.ts'
        },
        output: {
            filename: '[name].js',
            path: path.resolve(__dirname, 'dist', 'browser'),
            libraryTarget: 'commonjs'
        },
        resolve: {
            extensions: ['.ts', '.js']
        }
    },
    {
        ...common,
        target: 'web',
        entry: {
            memory: './src/webview/memory-webview-view.tsx'
        },
        output: {
            filename: '[name].js',
            path: path.resolve(__dirname, 'dist', 'views')
        },
        resolve: {
            extensions: ['.tsx', '.ts', '.js'],
            fallback: {
                buffer: require.resolve('buffer')
            }
        },
        plugins: [
            new webpack.ProvidePlugin({
                Buffer: ['buffer', 'Buffer']
            })
        ]
    }
];
