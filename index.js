const copier = {};
module.exports = copier;

const get = require('lodash.get');
require('colors');
const fs = require('fs-extra');
const path = require('path');
const NODE_MODULES = 'node_modules';

/**
 * @param {string} projectPath absolute filepath for project root directory
 * @param {string} targetPath absolute filepath for target directory to copy node_modules into
 * @returns {Promise<void>}
 */
copier.execute = async (projectPath, targetPath) => {
	if (projectPath === null) {
		throw new Error('projectPath must be defined.');
	}
	if (targetPath === null) {
		throw new Error('targetPath must be defined.');
	}

	// resolve path names for file copying
	projectPath = path.resolve(projectPath);
	targetPath = path.resolve(targetPath);

	let packageJson;
	try {
		packageJson = await fs.readJson(path.join(projectPath, 'package.json'));
	} catch (err) {
		console.error(err);
		throw new Error(`Cannot load package.json file: ${path.join(projectPath, 'package.json')}`);
	}

	const dependencies = packageJson && packageJson.dependencies;
	const directoriesToBeCopied = gatherDirectoriesToCopy(projectPath, Object.keys(dependencies));
	console.debug(`directoriesToBeCopied: ${JSON.stringify(directoriesToBeCopied, null, 2)}`.blue);

	return Promise.all(directoriesToBeCopied.map(async directory => {
		const destPath = path.join(targetPath, directory.substring(projectPath.length));
		console.debug(`copying to directory: ${destPath}`);
		return fs.copy(directory, destPath, { overwrite: true });
	}));
};

// FIXME: Use an actual Set to ensure no duplicates?
/**
 * Gathers the full listing of directories we need to copy
 * @param {string} projectPath absolute path to source project root directory
 * @param {string[]} dependencies array of module ids to be copied
 * @returns {string[]} set of directories to copy
 */
function gatherDirectoriesToCopy(projectPath, dependencies) {
	const directoriesToBeCopied = [];
	const directoriesFound = [];

	const pendingItems = dependencies.map(name => ({ name }));

	while (pendingItems.length) {
		const currentItem = pendingItems.shift();
		console.debug(`searching for module: ${currentItem.name}`.blue);
		const dependency = findDependency(currentItem);
		if (dependency && !directoriesFound.includes(dependency.directory)) {
			directoriesFound.push(dependency.directory);
			if (dependency.isRoot && !directoriesToBeCopied.includes(dependency.directory)) {
				directoriesToBeCopied.push(dependency.directory);
				console.debug(`    adding dependency: ${dependency.name}`);
			}
			dependency.dependencies.forEach(subDependency => {
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
	return directoriesToBeCopied;

	/**
	 * @param {object} metadata module metadata
	 * @param {string} [name] module name
	 * @returns {object} module metadata
	 */
	function findDependency(metadata, name) {
		if (metadata === null) {
			return null;
		}
		name = name || metadata.name;
		const parentDir = get(metadata, 'parent.directory', projectPath);
		const directory = path.join(parentDir, NODE_MODULES, name);
		console.debug(`    looking in dir: ${directory}`);
		let dependencyPackageJson;
		try {
			dependencyPackageJson = fs.readJsonSync(path.join(directory, 'package.json'));
		} catch (err) {
			console.debug(`     error: ${directory}`.red);
			return findDependency(metadata.parent, name);
		}
		console.debug('    found module!'.green);
		const dependencies = Object.keys(dependencyPackageJson.dependencies || {});
		// include optional dependencies too
		if (dependencyPackageJson.optionalDependencies) {
			dependencies.push(...Object.keys(dependencyPackageJson.optionalDependencies));
		}
		return {
			name,
			directory,
			dependencies,
			isRoot: projectPath === parentDir,
		};
	}
}

