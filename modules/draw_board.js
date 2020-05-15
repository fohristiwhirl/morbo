"use strict";

const images = require("./images");
const utils = require("./utils");

let boardsize = 480;

let light_square = "#b8b8b8";
let dark_square = "#dadada";

let square_size = Math.floor(boardsize / 8);
boardsize = square_size * 8;

exports.Init = function() {

	images.load_from(path.join(__dirname, "../pieces"));

	boardpieces.width = boardsquares.width = boardsize;
	boardpieces.height = boardsquares.height = boardsize;
	boardpieces.style.left = boardsquares.offsetLeft.toString() + "px";
	boardpieces.style.top = boardsquares.offsetTop.toString() + "px";

	for (let y = 0; y < 8; y++) {
		let tr1 = document.createElement("tr");
		let tr2 = document.createElement("tr");
		boardsquares.appendChild(tr1);
		boardpieces.appendChild(tr2);
		for (let x = 0; x < 8; x++) {
			let td1 = document.createElement("td");
			let td2 = document.createElement("td");
			td1.id = "underlay_" + utils.S(x, y);
			td2.id = "overlay_" + utils.S(x, y);
			td1.width = td2.width = square_size;
			td1.height = td2.height = square_size;
			if ((x + y) % 2 === 0) {
				td1.style["background-color"] = light_square;
			} else {
				td1.style["background-color"] = dark_square;
			}
			tr1.appendChild(td1);
			tr2.appendChild(td2);
		}
	}
}

exports.DrawBoard = function(board) {

	if (images.loads !== 12) {
		return;
	}

	for (let x = 0; x < 8; x++) {

		for (let y = 0; y < 8; y++) {

			let piece_to_draw = board.state[x][y];

			let s = utils.S(x, y);
			let td = document.getElementById("overlay_" + s);

			if (piece_to_draw === "") {
				td.style["background-image"] = "none";
			} else {
				td.style["background-image"] = images[piece_to_draw].string_for_bg_style;
				td.style["background-size"] = "contain";
			}
		}
	};

	fenbox.innerHTML = board.fen(true);
}
