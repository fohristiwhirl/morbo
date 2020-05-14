"use strict";

const fs = require("fs");
const path = require("path");

let sprites = {

	loads: 0,

	fully_loaded: function() {
		return this.loads === 12;
	},

	load_from: function(directory) {

		for (let c of "KkQqRrBbNnPp") {

			sprites[c] = new Image();
			sprites[c].addEventListener("load", () => {sprites.loads++;}, {once: true});

			if (c === c.toUpperCase()) {

				sprites[c].addEventListener("error", () => {console.log(`Failed to load image ${c}.svg or ${c}.png`);}, {once: true});
				
				if (fs.existsSync(path.join(directory, `${c}.svg`))) {
					sprites[c].src = path.join(directory, `${c}.svg`);
				} else {
					sprites[c].src = path.join(directory, `${c}.png`);
				}

			} else {

				sprites[c].addEventListener("error", () => {console.log(`Failed to load image _${c.toUpperCase()}.svg or _${c.toUpperCase()}.png`);}, {once: true});

				if (fs.existsSync(path.join(directory, `_${c.toUpperCase()}.svg`))) {
					sprites[c].src = path.join(directory, `_${c.toUpperCase()}.svg`);
				} else {
					sprites[c].src = path.join(directory, `_${c.toUpperCase()}.png`);
				}
			}

			sprites[c].string_for_bg_style = `url("${sprites[c].src}")`;		// Since the src path won't contain " this should be safe.
		}
	},
};

module.exports = sprites;
