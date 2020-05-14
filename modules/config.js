"use strict";

const fs = require("fs");

function LoadMatchConfig(filename) {
	return JSON.parse(fs.readFileSync(filename, "utf8"));		// Can throw
}



exports.LoadMatchConfig = LoadMatchConfig;
