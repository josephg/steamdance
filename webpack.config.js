const webpack = require('webpack');

var env = process.env.NODE_ENV || 'development';
process.argv.forEach(a => {
  if(a === '-p') env = 'production';
});

const config = {
  entry: {
    editor: './browser/editor.js',
    browse: './browser/browse.js',
  },
  output: {
    path: __dirname + '/public',
    filename: '[name]-compiled.js',
  },
  plugins: [
    new webpack.DefinePlugin({
      "process.env.NODE_ENV": `"${env}"`,
    }),
    // only 3k at the moment
    //new webpack.optimize.CommonsChunkPlugin('common'),
  ],
  module: {
    loaders: [{
      test: /\.coffee$/,
      loader: "coffee-loader"
    }, {
      test: /\.js$/,
      exclude: __dirname + '/node_modules/',
      include: [__dirname],
      loader: 'babel',
    }, {
      test: /\.glsl$/,
      loader: 'webpack-glsl'
    }]
  },
  node: {
    fs: 'empty',
  },
  resolve: {
    extensions: ['', '.js', '.coffee']
  }
};

if (env === 'production') {
  config.plugins.push(new webpack.optimize.UglifyJsPlugin({
    compress: { warnings: false },
  }));
} else {
  config.devtool = 'cheap-module-source-map';
}

//console.log(require('util').inspect(config, {depth:10, color:true}));

module.exports = config;

