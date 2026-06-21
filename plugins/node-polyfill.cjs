// Docusaurus plugin: polyfill a small slice of Node's standard library for the
// *client* bundle so the iMessage-viewer blog post can run its ported decoders
// (typedstream / NSKeyedArchiver) in the browser unchanged. Those modules lean
// on Node's `Buffer`; sql.js's emscripten glue references `fs`/`path`/`crypto`
// in dead code paths that webpack 5 would otherwise try (and fail) to resolve.
const webpack = require("webpack");

module.exports = function nodePolyfillPlugin() {
    return {
        name: "node-polyfill-plugin",
        configureWebpack(_config, isServer) {
            if (isServer) return {};
            return {
                resolve: {
                    fallback: {
                        buffer: require.resolve("buffer/"),
                        // sql.js references these only on its Node path; stub them out.
                        fs: false,
                        path: false,
                        crypto: false,
                    },
                },
                plugins: [
                    new webpack.ProvidePlugin({
                        Buffer: ["buffer", "Buffer"],
                    }),
                ],
            };
        },
    };
};
