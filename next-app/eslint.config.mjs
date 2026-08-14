import next from 'eslint-config-next';

const config = [
  { ignores: ['.next/**', 'node_modules/**'] },
  ...next,
];

export default config;
