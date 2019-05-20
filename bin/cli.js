#!/usr/bin/env node

const args = process.argv.slice(2);
if (args.length !== 2) {
	console.error('copy-modules requires 2 parameters: projectPath and targetPath');
	process.exit(1);
}

require('../index').execute(...args)
	.then(() => process.exit(0))
	.catch(e => {
		console.error(e);
		process.exit(1);
	});
