module.exports = {
    "env": {
        "browser": true,
		"es6": true
		
    },
    "extends": "eslint:recommended",
    "parserOptions": {
        "sourceType": "module",
		"ecmaVersion": "latest"
    },
    "rules": {
		"indent": [
			"error",
			4
		],
		"quotes": [
			"error",
			"double"
		],
		"semi": [
			"error",
			"always"
		],
		"no-console": "off"
	},
	"globals": {
		"require": true,
		"__dirname": true,
		"process": true,
		"module": true,
		"DHIS_CONFIG": true
	}
};
