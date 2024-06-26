import path from 'path';
import babel from '@rollup/plugin-babel';
import resolve from '@rollup/plugin-node-resolve';
import wasm from '@rollup/plugin-wasm';

const root = process.platform === 'win32' ? path.resolve('/') : '/';
const external = (id) => !id.startsWith('.') && !id.startsWith(root);
const extensions = ['.ts', '.tsx'];

const babelOptions = {
  babelrc: false,
  extensions,
  exclude: '**/node_modules/**',
  babelHelpers: 'runtime',
  presets: [
    ['@babel/preset-env', {
      bugfixes: true,
      loose: true,
      modules: false,
      targets: '> 1%, not dead, not ie 11, not op_mini all',
    }],
    '@babel/preset-react',
    ['@babel/preset-typescript', { allowDeclareFields: true }],
  ],
  plugins: [
    ['@babel/transform-runtime', { regenerator: false, useESModules: true }],
  ],
};

export default {
  input: './src/index.tsx',
  output: { dir: `dist`, format: 'esm' },
  external,
  plugins: [
    babel(babelOptions),
    resolve({ extensions }),
    wasm({ maxFileSize: Infinity }),
  ],
};
