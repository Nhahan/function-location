const path = require('path');

module.exports = {
    mode: 'production',
    entry: {
        index: './lib/index.ts',
    },
    output: {
        path: path.resolve(__dirname, 'dist'),
        filename: '[name].js',
        clean: true,
        library: {
            name: 'FunctionLocation',
            type: 'umd',
        },
        globalObject: 'this',
    },
    resolve: {
        extensions: ['.ts', '.js', '.node']
    },
    module: {
        rules: [
            {
                test: /\.ts$/,
                use: ['ts-loader'],
                exclude: /node_modules/,
            },
            {
                test: /\.node$/,
                use: 'ignore-loader',
            },
        ],
    },
    target: 'node',
};