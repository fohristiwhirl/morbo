"use strict";

const draw_board = require("./modules/draw_board");
const {ipcRenderer} = require("electron");
const {NewHub} = require("./modules/hub");
const path = require("path");

// --------------------------------------------------------------

draw_board.Init();
let hub = NewHub();

// --------------------------------------------------------------

ipcRenderer.on("call", (event, msg) => {

	let fn;

	if (typeof msg === "string") {																		// msg is function name
		fn = hub[msg].bind(hub);
	} else if (typeof msg === "object" && typeof msg.fn === "string" && Array.isArray(msg.args)) {		// msg is object with fn and args
		fn = hub[msg.fn].bind(hub, ...msg.args);
	}

	fn();
});

