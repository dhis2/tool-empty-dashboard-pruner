module.exports = [
    {
        ignores: ["src/resources/dhis-header-bar.js"],
        languageOptions: {
            globals: {
                browser: true,
                es2021: true,
            },
            ecmaVersion: 12,
            sourceType: "module",
        },
        plugins: {
            react: require("eslint-plugin-react"),
            "@typescript-eslint": require("@typescript-eslint/eslint-plugin"),
        },
        rules: {
            // your existing rules
        },
    },
];