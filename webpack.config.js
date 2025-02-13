"use strict";

const path = require("path");
const webpack = require("webpack");
const CopyWebpackPlugin = require("copy-webpack-plugin");
const HTMLWebpackPlugin = require("html-webpack-plugin");

var dhisConfig;
try {
    dhisConfig = require("./d2auth.json"); // eslint-disable-line
    dhisConfig.authorization = `Basic ${Buffer.from(`${dhisConfig.username}:${dhisConfig.password}`).toString("base64")}`;
} catch (e) {
    console.warn("\nWARNING! Failed to load DHIS config:", e.message);
    dhisConfig = {
        baseUrl: "http://localhost:8080/dhis",
        authorization: "Basic YWRtaW46ZGlzdHJpY3Q=", // admin:district
    };
}

const devServerPort = 8081;
const isDevBuild = process.argv[1].indexOf("webpack-dev-server") !== -1;


let cookie = ''; // Store cookie globally
async function fetchSessionCookie() {
    try {
        const response = await fetch(dhisConfig.baseUrl + '/api/me', {
            headers: {
                "Authorization": dhisConfig.authorization
            },
            credentials: 'include'
        });

        if (!response.ok) {
            throw new Error(`HTTP error! status: ${response.status}`);
        }

        // Extract and store JSESSIONID from the Set-Cookie header
        const setCookieHeader = response.headers.get('set-cookie');
        if (setCookieHeader) {
            const jsessionIdCookie = setCookieHeader.split(',').find(header => header.includes('JSESSIONID'));
            if (jsessionIdCookie) {
                cookie = jsessionIdCookie.split(';')[0]; // Get only the `JSESSIONID=value` part
                console.log("JSESSIONID cookie successfully set:", cookie);
            }
        }
    } catch (error) {
        console.error("Failed to fetch JSESSIONID cookie:", error.message);
    }
}

async function initialize() {
    await fetchSessionCookie();
    console.log("Initialization has completed.");
}

// Call the initialize function to start the process
initialize();
const webpackConfig = {
    context: __dirname,
    entry: "./src/app.js",
    devtool: "source-map",
    output: {
        path: __dirname + "/build",
        filename: "[name]-[hash].js",
        publicPath: isDevBuild ? "http://localhost:8081/" : "./"
    },
    module: {
        rules: [
            {
                test: /\.css$/,
                use: ["style-loader", "css-loader"]
            },
            {
                test: /\.scss$/,
                use: ["style-loader", "css-loader", "sass-loader"]
            },
            {
                test: /\.html$/,
                use: ["html-loader"]
            },
            {
                test: /\.png$/,
                use: ["url-loader?limit=100000"]
            },
            {
                test: /\.woff(2)?(\?v=[0-9]\.[0-9]\.[0-9])?$/,
                use: ["url-loader?limit=10000&mimetype=application/font-woff"]
            },
            {
                test: /\.(ttf|otf|eot|svg)(\?v=[0-9]\.[0-9]\.[0-9])?|(jpg|gif)$/,
                use: ["file-loader"]
            },
            {
                test: /\.js$/,
                exclude: [
                    path.resolve(__dirname, "node_modules"),
                    path.resolve(__dirname, "src/resources/dhis-header-bar.js")
                ]
            }
        ]
    },
    resolve: {
        alias: {}
    },
    plugins: [
        new HTMLWebpackPlugin({
            template: "src/index.html"
        }),
        new CopyWebpackPlugin({
            patterns: [
                { from: "./src/css", to: "css" },
                { from: "./src/img", to: "img" },
                { from: "./src/resources/dhis-header-bar.js", to: "resources" }
            ]
        }),
        new webpack.ProvidePlugin({
            $: "jquery",
            jQuery: "jquery",
            "window.jQuery": "jquery"
        }),
        !isDevBuild ? undefined : new webpack.DefinePlugin({
            DHIS_CONFIG: JSON.stringify(dhisConfig),
        }),
        isDevBuild ? undefined : new webpack.DefinePlugin({
            "process.env.NODE_ENV": "\"production\"",
            DHIS_CONFIG: JSON.stringify({}),
        }),
    ].filter(v => v),
    devServer: {
        port: devServerPort,
        compress: true,
        proxy: [
            {
                context: () => true,
                target: dhisConfig.baseUrl,
                secure: false,
                changeOrigin: true,
                headers: {
                    "Authorization": dhisConfig.authorization,
                },
                onProxyReq: (proxyReq) => {
                    if (cookie) {
                        proxyReq.setHeader('Cookie', cookie);
                    } else {
                        console.warn("No cookie found");
                    }
                },
                onProxyRes: (proxyRes) => {
                    const setCookieHeader = proxyRes.headers['set-cookie'];
                    if (setCookieHeader) {
                        const jsessionIdCookie = setCookieHeader.find(header => header.includes('JSESSIONID'));
                        if (jsessionIdCookie) {
                            cookie = jsessionIdCookie.split(';')[0];
                        }
                    }
                }
            }
        ]
    }
    ,
    mode: "development"
};

module.exports = webpackConfig;
