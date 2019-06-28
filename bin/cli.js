#!/usr/bin/env node

const args = process.argv.slice(2);
if (args.length !== 2) {
	console.error('copy-modules requires 2 parameters: projectPath and targetPath');
	process.exit(1);
}

const params = {
	projectPath:     args[0],
	targetPath:      args[1],
	includeOptional: args.includes('--include-optional'),
};

require('../index').executeSync(params);


