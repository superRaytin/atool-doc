import path, { join } from 'path';
import { readdirSync, readFileSync, existsSync } from 'fs';
import getWebpackCommonConfig from 'atool-build/lib/getWebpackCommonConfig';
import mergeCustomConfig from 'atool-build/lib/mergeCustomConfig';
import { ProgressPlugin } from 'atool-build/lib/webpack';
import HtmlWebpackPlugin from 'html-webpack-plugin';
import { marked } from 'atool-doc-util';

const root = path.join(__dirname, '..');

const getResolve = function (cwd, pkg) {
  return {
    root: cwd,
    extensions: ['', '.js', '.jsx'],
    alias: {
      [`${pkg.name}$`]: join(cwd, 'index.js'),
      [pkg.name]: cwd,
    },
  };
};

const getDemoFiles = function (dir) {
  return readdirSync(dir).map(file => join(dir, file));
};

const getEntry = function (source) {
  const files = getDemoFiles(source);
  const entry = {};
  files.forEach(file => {
    const ext = path.extname(file);
    const name = path.basename(file, ext);
    if (ext === '.md' || (ext === '.js' && existsSync(join(path.dirname(file), `${name}.html`)))) {
      entry[join(path.dirname(file), name)] = file;
    }
  });
  return entry;
};


export default function (source, dest, cwd, tpl, config) {
  const pkg = require(join(cwd, 'package.json'));

  const commonConfig = getWebpackCommonConfig({ cwd });
  const customConfigPath = join(cwd, config);

  const webpackConfig = existsSync(customConfigPath)
    ? mergeCustomConfig(commonConfig, customConfigPath, 'development')
    : commonConfig;

  const entry = getEntry(source);

  webpackConfig.entry = entry;
  webpackConfig.resolve = getResolve(cwd, pkg);
  webpackConfig.output = {
    path: join(cwd, dest),
    filename: '[name].js',
  };
  webpackConfig.cwd = cwd;
  webpackConfig.tplSource = source;
  webpackConfig.resolveLoader.root = join(__dirname, '../node_modules');

  webpackConfig.module.loaders.push({
    test: /\.md$/,
    loader: `atool-doc-md-loader?template=${tpl}`,
    include: path.join(cwd, source),
  });

  webpackConfig.module.loaders.push({
    test: /\.(jsx|js)$/,
    loader: `atool-doc-js-loader?template=${tpl}`,
    include: path.join(cwd, source),
  });


  webpackConfig.plugins = webpackConfig.plugins.concat([
    new ProgressPlugin((percentage, msg) => {
      const stream = process.stderr;
      if (stream.isTTY && percentage < 0.71) {
        stream.cursorTo(0);
        stream.write(`📦   ${msg}`);
        stream.clearLine(1);
      } else if (percentage === 1) {
        console.log('\nwebpack: bundle build is now finished.');
      }
    }),
  ], [
    new HtmlWebpackPlugin({
      filename: 'index.html',
      template: join(root, '/tpl/index.ejs'),
      inject: 'body',
      chunks: [],
      title: `${pkg.name}@${pkg.version}`,
      homepage: pkg.homepage,
      link: entry,
      readme: marked(readFileSync(join(cwd, 'README.md'), 'utf-8')),
    }),
  ]);

  return webpackConfig;
}