#!/usr/bin/env node

const args = process.argv.slice(2);
if (args.length != 2) {
	console.error('copy-modules requires 2 parameters: projectPath and targetPath');
	return 1;
} else {
	require('../index').execute(...args);
}

