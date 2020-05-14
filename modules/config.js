"use strict";

const fs = require("fs");

function LoadMatchConfig(filename) {

	let config = JSON.parse(fs.readFileSync(filename, "utf8"));		// Can throw

	if (Array.isArray(config.engines === false)) {
		config.engines = [];
	}

	for (let e of config.engines) {

		if (typeof e.path !== "string") {
			throw "Bad path in engine options";			// Unrecoverable
		}

		if (Array.isArray(e.args) === false) {
			e.args = [];
		}

		if (typeof e.options !== "object") {
			e.options = {};
		}

		if (typeof e.results !== "string") {
			e.results = "";
		}
	}

	if (typeof config.movetime !== "number") {
		config.movetime = 3000;
	}

	return config;
}

function SaveMatchConfig(filename, config) {
	try {
		fs.writeFileSync(filename, JSON.stringify(config, null, "\t"));
	} catch (err) {
		console.log(err.toString());
	}
}

exports.LoadMatchConfig = LoadMatchConfig;
exports.SaveMatchConfig = SaveMatchConfig;
