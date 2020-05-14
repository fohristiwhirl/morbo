"use strict";

const path = require("path");

function DrawInfobox(config, config_filename, running) {

	if (!config || !config_filename) {
		return;
	}

	let s = "";

	s += `${path.basename(config_filename)}<br>`;
	s += (running ? "Running!" : "Halted") + "<br><br>";

	for (let e of config.engines) {
		if (e.name) {
			s += e.name;
		} else {
			s += path.basename(e.path);
		}

		let wins = 0;
		let losses = 0;
		let draws = 0;

		for (let c of e.results) {
			if (c === "+") {
				wins++;
			} else if (c === "-") {
				losses++;
			} else if (c === "=") {
				draws++;
			}
		}

		s += `  WDL: ${wins}-${draws}-${losses}<br>`;
	}

	infobox.innerHTML = s;
}

exports.DrawInfobox = DrawInfobox;
