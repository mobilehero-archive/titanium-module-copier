
const fs = require(`fs-extra`);
const path = require(`path`);
const _ = require(`lodash`);

const NODE_MODULES = `node_modules`;
const THE_ROOT_MODULE = `__THE_ROOT_MODULE__`;

class Dependency {
	constructor( {parent, name, directory, root }) {
		this.name = name;
		this.parent = parent;
		this.directory = directory;
		this.root = root;
	}

	/**
	 * Get directories that need to be copied to target.
	 * @param {boolean} [includeOptional=true] - Include optional dependencies?
	 * @param {boolean} [includePeers=true] - Include peer dependencies?
	 * @returns {Promise<string[]>} Full set of directories to copy.
	 */
	getDirectoriesToCopy({ includeOptional = false, includePeers = false }) {
		const childrenNames = this.gatherChildren({ includeOptional, includePeers });
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
	 * Gather a list of all child dependencies.
	 * @param {boolean} [includeOptional] - Include optional dependencies?
	 * @param {boolean} [includePeers] - Include peer dependencies?
	 * @returns {Promise<string[]>} Set of dependency names.
	 */
	gatherChildren( {includeOptional = false, includePeers = false }) {
		const packageJson = fs.readJsonSync(path.join(this.directory, `package.json`));

		const result = {
		};

		result.includeParent = !_.get(packageJson, 'titanium.ignore', false);
		const titaniumDependencies = _.get(packageJson, 'titanium.dependencies');

		if (!result.includeParent && this.name !== THE_ROOT_MODULE) {
			let main;
			if (packageJson.main) {
				if (fs.existsSync(path.join(this.directory, packageJson.main))) {
					main = path.join(this.directory, packageJson.main).substring(this.root.length);
				} else if (fs.existsSync(path.join(this.directory, `${packageJson.main}.js`))) {
					main = path.join(this.directory, `${packageJson.main}.js`).substring(this.root.length);
				} else if (fs.existsSync(path.join(this.directory, `${packageJson.main}.json`))) {
					main = path.join(this.directory, `${packageJson.main}.json`).substring(this.root.length);
				} else if (fs.existsSync(path.join(this.directory, `index.js`))) {
					main = path.join(this.directory, `index.js`).substring(this.root.length);
				} else if (fs.existsSync(path.join(this.directory, `index.json`))) {
					main = path.join(this.directory, `index.json`).substring(this.root.length);
				}
			}

			copier.package_registry.push({
				name:      packageJson.name,
				version:   packageJson.version,
				directory: this.directory,
				main,
			});

		}

		const aliases = _.get(packageJson, `titanium.aliases`);
		if (_.isObject(aliases)) {
			for (const alias in aliases) {
				let main = aliases[alias];
				if (!main.startsWith(`/`)) {
					main = path.join(this.directory, main).substring(this.root.length);
				}
				copier.package_registry.push({
					alias,
					version:   packageJson.version,
					directory: this.directory,
					main,
				});
			}
		}

		let dependencies = {};

		if(packageJson.titanium && packageJson.titanium. )

		dependencies = Object.keys(packageJson.dependencies || {});
		// include optional dependencies too?
		if (includeOptional && packageJson.optionalDependencies) {
			dependencies.push(...Object.keys(packageJson.optionalDependencies));
		}

		if (includePeers && packageJson.peerDependencies) {
			dependencies.push(...Object.keys(packageJson.peerDependencies));
		}

		if (packageJson.titanium) {

			if (packageJson.titanium.type === `native-module`) {
				copier.nativeModulePaths.push(this.directory);
				// Just add ios and android if type: native-module
				copier.nativeModulePlatformPaths.push(path.join(this.directory, `ios`));
				copier.nativeModulePlatformPaths.push(path.join(this.directory, `android`));
			} else if (packageJson.titanium.type === `widget`) {
				const widgetDir = path.join(this.directory, packageJson.titanium.widgetDir || `.`);
				copier.widgetDirectories.push(widgetDir);
				const widgetManifest = {
					dir:      widgetDir,
					manifest: {
						id:        packageJson.titanium.widgetId || packageJson.id,
						platforms: packageJson.titanium.platforms || `ios,android`,
					},
				};
				copier.widgetManifests.push(widgetManifest);
			}
		}

		return dependencies;
	}

	/**
	 * Attempts to resolve a given module by id to the correct.
	 * @param {string} subModule - Id of a module that is it's dependency.
	 * @returns {Promise<Dependency>} The resolved dependency.
	 */
	async resolve(subModule) {
		try {
			// First try underneath the current module
			const source_directory = path.join(this.directory, NODE_MODULES, subModule);
			// const target_directory = path.join(this.target, NODE_MODULES, subModule);
			const packageJsonExists = await fs.exists(path.join(source_directory, `package.json`));
			if (packageJsonExists) {
				return new Dependency( { parent: this, name: subModule, directory: source_directory, root: this.root });
			}
		} catch (err) {
			// this is the root and we still didn't find it, fail!
			if (this.parent === null) {
				throw err;
			}
		}

		if (this.parent === null) {
			throw new Error(`Could not find dependency: ${subModule}`);
		}
		return this.parent.resolve(subModule); // Try the parent (recursively)
	}
}

module.exports = Dependency;

