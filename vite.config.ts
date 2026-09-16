import { readFileSync } from 'node:fs';
import { defineConfig } from 'vite-plus';

// Files projen writes are regenerated on every synth, so formatting or linting them only produces
// a diff the next synth reverts. projen marks each of them linguist-generated in .gitattributes;
// reading that list keeps this config from drifting when .projenrc.ts adds or drops a component.
const projenGenerated = readFileSync('.gitattributes', 'utf8')
  .split('\n')
  .filter((line) => line.includes('linguist-generated'))
  .map((line) => line.split(/\s+/)[0].replace(/^\//, ''));

const buildOutput = ['lib/**', 'dist/**', '.jsii', 'tsconfig.tsbuildinfo', 'coverage/**'];
// Synthesized CloudFormation, written by integ-runner.
const integSnapshots = ['test/*.snapshot/**'];

export default defineConfig({
  fmt: {
    singleQuote: true,
    trailingComma: 'all',
    semi: true,
    printWidth: 100,
    ignorePatterns: [...projenGenerated, ...buildOutput, ...integSnapshots],
  },
  lint: {
    plugins: ['typescript', 'unicorn', 'oxc', 'import'],
    ignorePatterns: [...projenGenerated, ...buildOutput, ...integSnapshots],
    options: {
      typeAware: true,
      typeCheck: true,
    },
    overrides: [
      {
        // Only src/ and test/ belong to a tsconfig project the type checker can see (tsconfig.json
        // and test/tsconfig.json). .projenrc.ts and this file sit at the root outside both, and
        // the plugin's type-aware rules crash on them instead of skipping them.
        files: ['src/**/*.ts', 'test/**/*.ts'],
        jsPlugins: ['oxlint-plugin-awscdk'],
        // oxlint-plugin-awscdk's `strict` preset, spelled out: the plugin's entry point cannot be
        // imported from this CommonJS-loaded config. strict rather than recommended because this
        // is a published construct library, so the JSDoc and props-default rules matter as much
        // as the construct-ID ones.
        rules: {
          'awscdk/construct-constructor-property': 'error',
          'awscdk/no-construct-in-interface': 'error',
          'awscdk/no-construct-in-public-property-of-construct': 'error',
          'awscdk/no-construct-stack-suffix': 'error',
          'awscdk/no-import-private': 'error',
          'awscdk/no-mutable-property-of-props-interface': 'error',
          'awscdk/no-mutable-public-property-of-construct': 'error',
          'awscdk/no-parent-name-construct-id-match': [
            'error',
            { disallowContainingParentName: true },
          ],
          'awscdk/no-unused-props': 'error',
          'awscdk/no-variable-construct-id': 'error',
          'awscdk/pascal-case-construct-id': 'error',
          'awscdk/prefer-grants-property': 'error',
          'awscdk/prevent-construct-id-collision': 'error',
          'awscdk/props-name-convention': 'error',
          'awscdk/require-jsdoc': 'error',
          'awscdk/require-passing-this': 'error',
          'awscdk/require-props-default-doc': 'error',
        },
      },
    ],
  },
  test: {
    include: ['test/**/*.test.ts'],
    exclude: ['**/node_modules/**', '**/cdk.out/**', 'test/*.snapshot/**'],
  },
});
