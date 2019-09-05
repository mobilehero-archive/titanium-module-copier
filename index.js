const copier = {};
module.exports = copier;

copier.nativeModulePaths = [];
copier.nativeModulePlatformPaths = [];
copier.excludedDirectories = [ '.git', '.svn' ];

const fs = require('fs-extra');
const path = require('path');

const NODE_MODULES = 'node_modules';
const THE_ROOT_MODULE = '__THE_ROOT_MODULE__';

/**
 * @description Copy all dependencies to target directory
 * @param {string} projectPath - Absolute filepath for project root directory.
 * @param {string} targetPath - Absolute filepath for target directory to copy node_modules into.
 * @param {object} [options] - Options object.
 * @param {boolean} [options.includeOptional=true] - Whether to include optional dependencies when gathering.
 * @returns {void} A Promise that resolves on completion.
 */
copier.executeSync = ({ projectPath, targetPath, includeOptional = true, includePeers = true }) => {
	if (projectPath === null || projectPath === undefined) {
		throw new Error('projectPath must be defined.');
	}
	if (targetPath === null || targetPath === undefined) {
		throw new Error('targetPath must be defined.');
	}

	// resolve path names for file copying
	projectPath = path.resolve(projectPath);
	targetPath = path.resolve(targetPath);

	// recursively gather the full set of dependencies/directories we need to copy
	const root = new Dependency(null, THE_ROOT_MODULE, projectPath);
	const directoriesToBeCopied = root.getDirectoriesToCopy(includeOptional, includePeers);

	const dirSet = new Set(directoriesToBeCopied); // de-duplicate
	// back to Array so we can #map()
	const deDuplicated = Array.from(dirSet);

	// Then copy them over
	deDuplicated.map(directory => {
		const relativePath = directory.substring(projectPath.length);
		const destPath = path.join(targetPath, relativePath);
		return fs.copySync(directory, destPath, {
			overwrite:   true,
			dereference: true,
			// Make sure we are not copying unwanted dependencies or directories marked for skipping
			filter:      src => !src.endsWith(NODE_MODULES)
					&& copier.nativeModulePlatformPaths.every(item => !src.startsWith(item))
					&& copier.excludedDirectories.every(item => !src.endsWith(item)),
		});
	});
};

class Dependency {
	constructor(parent, name, directory) {
		this.name = name;
		this.parent = parent;
		this.directory = directory;
	}

	/**
	 * @description Get directories that need to be copied to target
	 * @param {boolean} [includeOptional=true] - Include optional dependencies?
	 * @param {boolean} [includePeers=true] - Include peer dependencies?
	 * @returns {Promise<string[]>} Full set of directories to copy.
	 */
	getDirectoriesToCopy(includeOptional = true, includePeers = true) {
		const childrenNames = this.gatherChildren(includeOptional);
		if (!childrenNames) {
			return []; // Ignore this directory
		}

		if (childrenNames.length === 0) {
			if (this.name !== THE_ROOT_MODULE) {
				return [ this.directory ]; // just need our own directory!
			} else {
				return [];
			}
		}

		const children = childrenNames.map(name => this.resolve(name));
		const allDirs = children.map(child => child.getDirectoriesToCopy(includeOptional, includePeers));
		// flatten allDirs down to single Array
		const flattened = allDirs.reduce((acc, val) => acc.concat(val), []); // TODO: replace with flat() call once Node 11+

		if (this.name !== THE_ROOT_MODULE) {
			flattened.push(this.directory); // We need to include our own directory
		}
		return flattened;
	}

	/**
	 * @description Gather a list of all child dependencies
	 * @param {boolean} [includeOptional] - Include optional dependencies?
	 * @param {boolean} [includePeers] - Include peer dependencies?
	 * @returns {Promise<string[]>} Set of dependency names.
	 */
	gatherChildren(includeOptional = true, includePeers = true) {
		const packageJson = fs.readJsonSync(path.join(this.directory, 'package.json'));
		const dependencies = Object.keys(packageJson.dependencies || {});
		// include optional dependencies too?
		if (includeOptional && packageJson.optionalDependencies) {
			dependencies.push(...Object.keys(packageJson.optionalDependencies));
		}

		if (includePeers && packageJson.peerDependencies) {
			dependencies.push(...Object.keys(packageJson.peerDependencies));
		}

		if (packageJson.titanium) {
			if (packageJson.titanium.ignore) {
				return; // ignore this module
			}

			if (packageJson.titanium.type === 'native-module') {
				copier.nativeModulePaths.push(this.directory);
				// Just add ios and android if type: native-module
				copier.nativeModulePlatformPaths.push(path.join(this.directory, 'ios'));
				copier.nativeModulePlatformPaths.push(path.join(this.directory, 'android'));
			}
		}

		return dependencies;
	}

	/**
	 * @description Attempts to resolve a given module by id to the correct.
	 * @param {string} subModule - Id of a module that is it's dependency.
	 * @returns {Promise<Dependency>} The resolved dependency.
	 */
	resolve(subModule) {
		try {
			// First try underneath the current module
			const targetDir = path.join(this.directory, NODE_MODULES, subModule);
			const packageJsonExists = fs.existsSync(path.join(targetDir, 'package.json'));
			if (packageJsonExists) {
				return new Dependency(this, subModule, targetDir);
			}
		} catch (err) {
			// this is the root and we still didn't find it, fail!
			if (this.parent === null) {
				throw err;
			}
		}

		return this.parent.resolve(subModule); // Try the parent (recursively)
	}
}
