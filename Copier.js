const makeSynchronous = require(`make-synchronous`);
const fs = require(`fs-extra`);
const path = require(`path`);
const _ = require(`lodash`);

const NODE_MODULES = `node_modules`;
const THE_ROOT_MODULE = `__THE_ROOT_MODULE__`;

class Copier {

	constructor({ projectPath, targetPath, includeOptional = false, includePeers = false } = {}) {
		if (projectPath === null || projectPath === undefined) {
			throw new Error(`projectPath must be defined.`);
		}
		if (targetPath === null || targetPath === undefined) {
			throw new Error(`targetPath must be defined.`);
		}

		// resolve path names for file copying
		this.projectPath = path.resolve(projectPath);
		this.targetPath = path.resolve(targetPath);

		this.includeOptional = includeOptional;
		this.includePeers = includePeers;

	}

	async execute() {

	}


}

module.exports = Copier;

