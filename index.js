const copier = {};
module.exports = copier;

const _ = require('lodash');
require('colors');
const fs = require('fs-extra');
const path = require('path');
const NODE_MODULES = 'node_modules';

copier.execute = (projectPath, targetPath) => {
	if (_.isNil(projectPath)) {
		throw new Error('projectPath must be defined.');
	} else if (_.isNil(targetPath)) {
		throw new Error('targetPath must be defined.');
	}

	// resolve path names for file copying
	projectPath = path.resolve(projectPath);
	targetPath = path.resolve(targetPath);

	let packageJson;
	try {
		packageJson = require(path.join(projectPath, 'package.json'));
	} catch (err) {
		console.error(err);
		return new Error(`Cannot load package.json file: ${path.join(projectPath, 'package.json')}`);
	}

	const dependencies = packageJson && packageJson.dependencies;

	const directoriesToBeCopied = [];
	const directoriesFound = [];

	const pendingItems = _.keys(dependencies).map(name => ({ name }));

	while (pendingItems.length) {
		const currentItem = pendingItems.shift();
		console.debug(`searching for module: ${currentItem.name}`.blue);
		const dependency = findDependency(currentItem);
		if (dependency && ! _.includes(directoriesFound, dependency.directory)) {
			directoriesFound.push(dependency.directory);
			if (dependency.isRoot && ! _.includes(directoriesToBeCopied, dependency.directory)) {
				directoriesToBeCopied.push(dependency.directory);
				console.debug(`    adding dependency: ${dependency.name}`);
			}
			_.forEach(dependency.dependencies, subDependency => {
				pendingItems.push({
					name:   subDependency,
					parent: {
						name:      dependency.name,
						directory: dependency.directory,
					},
				});
			});
		}
	}
	console.debug(`directoriesToBeCopied: ${JSON.stringify(directoriesToBeCopied, null, 2)}`.blue);

	_.forEach(directoriesToBeCopied, directory => {
		const destPath = path.join(targetPath, directory.substring(projectPath.length));
		console.debug(`copying to directory: ${destPath}`);
		fs.copySync(directory, destPath, { overwrite: true, dereference: true });
	});

	function findDependency(metadata, name) {
		if (_.isNil(metadata)) {
			return null;
		}
		name = name || metadata.name;
		const parentDir = _.get(metadata, 'parent.directory', projectPath);
		const directory = path.join(parentDir, NODE_MODULES, name);
		console.debug(`    looking in dir: ${directory}`);
		let dependencyPackageJson;
		try {
			dependencyPackageJson = require(path.join(directory, 'package.json'));
		} catch (err) {
			console.debug(`     error: ${directory}`.red);
			return findDependency(metadata.parent, name);
		}
		console.debug('    found module!'.green);
		return {
			name,
			directory,
			dependencies: _.keys(dependencyPackageJson.dependencies),
			isRoot:       projectPath === parentDir,
		};
	}
};

