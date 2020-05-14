"use strict";

exports.XY = function(s) {

	// e.g. "b7" --> [1, 1]

	if (typeof s !== "string" || s.length !== 2) {
		return [-1, -1];
	}
	s = s.toLowerCase();
	let x = s.charCodeAt(0) - 97;
	let y = 8 - parseInt(s[1], 10);
	if (x < 0 || x > 7 || y < 0 || y > 7 || Number.isNaN(y)) {
		return [-1, -1];
	}
	return [x, y];
}

exports.S = function(x, y) {

	// e.g. (1, 1) --> "b7"
	
	if (typeof x !== "number" || typeof y !== "number" || x < 0 || x > 7 || y < 0 || y > 7) {
		return "??";
	}
	let xs = String.fromCharCode(x + 97);
	let ys = String.fromCharCode((8 - y) + 48);
	return xs + ys;
}

exports.ReplaceAll = function(s, search, replace) {		// Fairly slow.
	return s.split(search).join(replace);
}
