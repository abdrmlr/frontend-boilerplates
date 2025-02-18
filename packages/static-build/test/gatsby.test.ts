import { injectPlugins, createPluginSymlinks } from '../src/utils/gatsby';
import path from 'path';
import {
  detectFrameworkRecord,
  LocalFileSystemDetector,
} from '@vercel/fs-detectors';
import frameworks from '@vercel/frameworks';
import fs from 'fs-extra';
import os from 'os';

async function detectVersion(fixturePath: string) {
  const localFileSystemDetector = new LocalFileSystemDetector(fixturePath);
  const { detectedVersion = null } =
    (await detectFrameworkRecord({
      fs: localFileSystemDetector,
      frameworkList: frameworks,
    })) ?? {};
  return detectedVersion;
}

async function prepareFixture(fixturePath: string) {
  const dest = await fs.mkdtemp(
    path.join(os.tmpdir(), path.basename(fixturePath))
  );
  await fs.copy(fixturePath, dest, { recursive: true });
  return dest;
}

describe('gatsby utilities', () => {
  const fixturesPath = path.join(__dirname, 'gatsby-unit-fixtures');

  let existingEnv: NodeJS.ProcessEnv;

  beforeAll(() => {
    // store initial environment
    existingEnv = process.env;
  });

  afterEach(() => {
    // clear these after each test so they can be accurately set for each test case
    delete process.env.VERCEL_GATSBY_BUILDER_PLUGIN;
    delete process.env.VERCEL_ANALYTICS_ID;
  });

  afterAll(() => {
    // restore environment variables
    process.env = existingEnv;
  });

  it('should return false when env vars are not set', async () => {
    const result = await injectPlugins(null, '');
    expect(result).toBeFalsy();
  });

  it('should not inject builder plugin when gatsby version is <v4', async () => {
    process.env.VERCEL_GATSBY_BUILDER_PLUGIN = '1';
    process.env.VERCEL_ANALYTICS_ID = '1';
    const fixture = await prepareFixture(path.join(fixturesPath, 'gatsby-v3'));
    const version = await detectVersion(fixture);
    await injectPlugins(version, fixture);
    const [gatsbyConfig] = await Promise.all([
      fs.readFile(path.join(fixture, 'gatsby-config.js'), 'utf-8'),
    ]);
    expect(gatsbyConfig).toMatchInlineSnapshot(
      `"module.exports = {\\"plugins\\":[\\"@vercel/gatsby-plugin-vercel-analytics\\"]}"`
    );
  });

  it('should inject plugins and create gatsby-node.js and gatsby-config.js', async () => {
    process.env.VERCEL_GATSBY_BUILDER_PLUGIN = '1';
    process.env.VERCEL_ANALYTICS_ID = '1';
    const fixture = await prepareFixture(path.join(fixturesPath, 'gatsby-v4'));
    const version = await detectVersion(fixture);
    await injectPlugins(version, fixture);
    const [gatsbyNode, gatsbyConfig] = await Promise.all([
      fs.readFile(path.join(fixture, 'gatsby-node.js'), 'utf-8'),
      fs.readFile(path.join(fixture, 'gatsby-config.js'), 'utf-8'),
    ]);
    expect(gatsbyNode).toMatchInlineSnapshot(
      `"module.exports = require('@vercel/gatsby-plugin-vercel-builder/gatsby-node.js');"`
    );
    expect(gatsbyConfig).toMatchInlineSnapshot(
      `"module.exports = {\\"plugins\\":[\\"@vercel/gatsby-plugin-vercel-analytics\\"]}"`
    );
  });

  it('should inject builder plugin and update gatsby-node.js and gatsby-config.js', async () => {
    process.env.VERCEL_GATSBY_BUILDER_PLUGIN = '1';
    process.env.VERCEL_ANALYTICS_ID = '1';
    const fixture = await prepareFixture(
      path.join(fixturesPath, 'gatsby-v4-existing-files-js')
    );
    const version = await detectVersion(fixture);
    await injectPlugins(version, fixture);
    const [gatsbyNode, gatsbyNodeBackup, gatsbyConfig, gatsbyConfigBackup] =
      await Promise.all([
        fs.readFile(path.join(fixture, 'gatsby-node.js'), 'utf-8'),
        fs.readFile(
          path.join(fixture, 'gatsby-node.js.__vercel_builder_backup__.js'),
          'utf-8'
        ),
        fs.readFile(path.join(fixture, 'gatsby-config.js'), 'utf-8'),
        fs.readFile(
          path.join(fixture, 'gatsby-config.js.__vercel_builder_backup__.js'),
          'utf-8'
        ),
      ]);
    expect(gatsbyNode).toMatchInlineSnapshot(`
      "const vercelBuilder = require('@vercel/gatsby-plugin-vercel-builder/gatsby-node.js');
      const gatsbyNode = require('./gatsby-node.js.__vercel_builder_backup__.js');

      const origOnPostBuild = gatsbyNode.onPostBuild;

      gatsbyNode.onPostBuild = async (args, options) => {
        if (typeof origOnPostBuild === 'function') {
          await origOnPostBuild(args, options);
        }
        await vercelBuilder.onPostBuild(args, options);
      };

      module.exports = gatsbyNode;
      "
    `);
    expect(gatsbyNodeBackup).toMatchInlineSnapshot(`
      "console.log('Hello, World!');
      "
    `);
    expect(gatsbyConfig).toMatchInlineSnapshot(`
      "const userConfig = require(\\"./gatsby-config.js.__vercel_builder_backup__.js\\");

      const preferDefault = m => (m && m.default) || m;

      const vercelConfig = Object.assign(
        {},
        preferDefault(userConfig)
      );

      if (!vercelConfig.plugins) {
        vercelConfig.plugins = [];
      }

      for (const plugin of [\\"@vercel/gatsby-plugin-vercel-analytics\\"]) {
        const hasPlugin = vercelConfig.plugins.find(
          (p) => p && (p === plugin || p.resolve === plugin)
        );

        if (!hasPlugin) {
          vercelConfig.plugins = vercelConfig.plugins.slice();
          vercelConfig.plugins.push(plugin);
        }
      }
      module.exports = vercelConfig;
      "
    `);
    expect(gatsbyConfigBackup).toMatchInlineSnapshot(`
      "module.exports = {};
      "
    `);
  });

  it('should inject builder plugin and update gatsby-node.ts and gatsby-config.ts', async () => {
    process.env.VERCEL_GATSBY_BUILDER_PLUGIN = '1';
    process.env.VERCEL_ANALYTICS_ID = '1';
    const fixture = await prepareFixture(
      path.join(fixturesPath, 'gatsby-v4-existing-files-ts')
    );
    const version = await detectVersion(fixture);
    await injectPlugins(version, fixture);
    const [gatsbyNode, gatsbyNodeBackup, gatsbyConfig, gatsbyConfigBackup] =
      await Promise.all([
        fs.readFile(path.join(fixture, 'gatsby-node.ts'), 'utf-8'),
        fs.readFile(
          path.join(fixture, 'gatsby-node.ts.__vercel_builder_backup__.ts'),
          'utf-8'
        ),
        fs.readFile(path.join(fixture, 'gatsby-config.ts'), 'utf-8'),
        fs.readFile(
          path.join(fixture, 'gatsby-config.ts.__vercel_builder_backup__.ts'),
          'utf-8'
        ),
      ]);
    expect(gatsbyNode).toMatchInlineSnapshot(`
      "import type { GatsbyNode } from 'gatsby';
      import * as vercelBuilder from '@vercel/gatsby-plugin-vercel-builder/gatsby-node.js';
      import * as gatsbyNode from './gatsby-node.ts.__vercel_builder_backup__.ts';

      export * from './gatsby-node.ts.__vercel_builder_backup__.ts';

      export const onPostBuild: GatsbyNode['onPostBuild'] = async (args, options) => {
        if (typeof (gatsbyNode as any).onPostBuild === 'function') {
          await (gatsbyNode as any).onPostBuild(args, options);
        }
        await vercelBuilder.onPostBuild(args, options);
      };
      "
    `);
    expect(gatsbyNodeBackup).toMatchInlineSnapshot(`
      "console.log('Hello, World!');
      "
    `);
    expect(gatsbyConfig).toMatchInlineSnapshot(`
      "import userConfig from \\"./gatsby-config.ts.__vercel_builder_backup__.ts\\";
      import type { PluginRef } from \\"gatsby\\";

      const preferDefault = (m: any) => (m && m.default) || m;

      const vercelConfig = Object.assign(
        {},
        preferDefault(userConfig)
      );

      if (!vercelConfig.plugins) {
        vercelConfig.plugins = [];
      }

      for (const plugin of [\\"@vercel/gatsby-plugin-vercel-analytics\\"]) {
        const hasPlugin = vercelConfig.plugins.find(
          (p: PluginRef) =>
            p && (p === plugin || p.resolve === plugin)
        );

        if (!hasPlugin) {
          vercelConfig.plugins = vercelConfig.plugins.slice();
          vercelConfig.plugins.push(plugin);
        }
      }

      export default vercelConfig;
      "
    `);
    expect(gatsbyConfigBackup).toMatchInlineSnapshot(`
      "module.exports = {};
      "
    `);
  });

  it('should inject builder plugin and update gatsby-node.mjs and gatsby-config.mjs', async () => {
    process.env.VERCEL_GATSBY_BUILDER_PLUGIN = '1';
    process.env.VERCEL_ANALYTICS_ID = '1';
    const fixture = await prepareFixture(
      path.join(fixturesPath, 'gatsby-v4-existing-files-mjs')
    );
    const version = await detectVersion(fixture);
    await injectPlugins(version, fixture);
    const [gatsbyNode, gatsbyNodeBackup, gatsbyConfig, gatsbyConfigBackup] =
      await Promise.all([
        fs.readFile(path.join(fixture, 'gatsby-node.mjs'), 'utf-8'),
        fs.readFile(
          path.join(fixture, 'gatsby-node.mjs.__vercel_builder_backup__.mjs'),
          'utf-8'
        ),
        fs.readFile(path.join(fixture, 'gatsby-config.mjs'), 'utf-8'),
        fs.readFile(
          path.join(fixture, 'gatsby-config.mjs.__vercel_builder_backup__.mjs'),
          'utf-8'
        ),
      ]);
    expect(gatsbyNode).toMatchInlineSnapshot(`
      "import * as vercelBuilder from '@vercel/gatsby-plugin-vercel-builder/gatsby-node.js';
      import * as gatsbyNode from './gatsby-node.mjs.__vercel_builder_backup__.mjs';

      export * from './gatsby-node.mjs.__vercel_builder_backup__.mjs';

      export const onPostBuild = async (args, options) => {
        if (typeof gatsbyNode.onPostBuild === 'function') {
          await gatsbyNode.onPostBuild(args, options);
        }
        await vercelBuilder.onPostBuild(args, options);
      };
      "
    `);
    expect(gatsbyNodeBackup).toMatchInlineSnapshot(`
      "console.log('Hello, World!');
      "
    `);
    expect(gatsbyConfig).toMatchInlineSnapshot(`
      "import userConfig from \\"./gatsby-config.mjs.__vercel_builder_backup__.mjs\\";

      const preferDefault = (m) => (m && m.default) || m;

      const vercelConfig = Object.assign(
        {},
        preferDefault(userConfig)
      );

      if (!vercelConfig.plugins) {
        vercelConfig.plugins = [];
      }

      for (const plugin of [\\"@vercel/gatsby-plugin-vercel-analytics\\"]) {
        const hasPlugin = vercelConfig.plugins.find(
          (p) => p && (p === plugin || p.resolve === plugin)
        );

        if (!hasPlugin) {
          vercelConfig.plugins = vercelConfig.plugins.slice();
          vercelConfig.plugins.push(plugin);
        }
      }

      export default vercelConfig;
      "
    `);
    expect(gatsbyConfigBackup).toMatchInlineSnapshot(`
      "module.exports = {};
      "
    `);
  });

  describe(`createPluginSymlinks()`, () => {
    it('should add symlinks for Gatsby plugins', async () => {
      const fixture = await prepareFixture(
        path.join(fixturesPath, 'gatsby-v4-existing-files-mjs')
      );

      await createPluginSymlinks(fixture);

      const analytics = require(path.join(
        fixture,
        'node_modules/@vercel/gatsby-plugin-vercel-analytics'
      ));
      expect(typeof analytics).toEqual('object');

      const builder = require(path.join(
        fixture,
        'node_modules/@vercel/gatsby-plugin-vercel-builder/gatsby-node.js'
      ));
      expect(typeof builder.onPostBuild).toEqual('function');
    });
  });
});
