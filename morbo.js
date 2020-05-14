"use strict";

const Engine = require("./modules/engine");
const NewRoot = require("./modules/node").NewRoot;
const Point = require("./modules/point").Point;

let hub = Object.create(null);

hub.engine_one = Engine();
hub.engine_two = Engine();

hub.receive = function(engine_colour, s) {

	console.log(`${engine_colour} < ${s}`);

	if (s.startsWith("bestmove")) {

		if (this.node.board.active !== engine_colour) {
			this.forfeit(engine_colour, "bestmove out of turn");
			return;
		}

		let tokens = s.split(" ").filter(z => s !== "");

		let ok = this.move(tokens[1]);

		if (!ok) {
			this.forfeit(engine_colour, "illegal: " + s);
			return;
		}

		this.progress_game();
	}
};

hub.run_game = function() {

	this.engine_one.shutdown();
	this.engine_two.shutdown();

	this.engine_one = Engine();
	this.engine_two = Engine();

	this.engine_one.setup(
		"C:\\Programs (self-installed)\\Chess Engines\\stockfish.exe",
		[],
		this.receive.bind(this, "w"),
		() => {},
	);

	this.engine_two.setup(
		"C:\\Programs (self-installed)\\Chess Engines\\stockfish.exe",
		[],
		this.receive.bind(this, "b"),
		() => {},
	);

	this.engine_one.send("uci");
	this.engine_two.send("uci");

	this.engine_one.setoption("UCI_Chess960", true);
	this.engine_two.setoption("UCI_Chess960", true);

	this.engine_one.send("ucinewgame");
	this.engine_two.send("ucinewgame");

	this.node = NewRoot();
	this.getmove();
};

hub.getmove = function() {

	let engine = this.node.board.active === "w" ? this.engine_one : this.engine_two;

	let root_fen = this.node.get_root().board.fen(false);
	let setup = `fen ${root_fen}`;

	console.log(engine.send(`position ${setup} moves ${this.node.history().join(" ")}`));
	console.log(engine.send("isready"));
	console.log(engine.send("go nodes 100000"));
};

hub.move = function(s) {							// Returns false on illegal.

	let source = Point(s.slice(0, 2));

	if (!source) {
		return false;
	}

	// Convert old-school castling notation to Chess960 format...

	let board = this.node.board;
	s = board.c960_castling_converter(s);

	// The promised legality check...

	let illegal_reason = board.illegal(s);
	if (illegal_reason !== "") {
		return false;
	}

	this.node = this.node.make_move(s);
	return true;
};

hub.forfeit = function(engine_colour, reason) {
	console.log(`Forfeit (${engine_colour}), ${reason}`);
	return;		// TODO
};

hub.nice_history = function() {
	return this.node.node_history().map(node => node.token()).slice(1);
};

hub.progress_game = function() {

	let board = this.node.board;

	console.log(this.node.token());

	if (this.adjudicate()) {
		console.log(this.nice_history().join(" "));
		// Start next game
		return;
	}

	this.getmove();
};

hub.adjudicate = function() {

	// TODO: update match stats etc.

	let board = this.node.board;

	if (board.no_moves()) {
		if (board.king_in_check()) {
			return true;
		} else {
			return true;
		}
	}
	if (board.insufficient_material()) {
		return true;
	}
	if (board.halfmove >= 100) {
		return true;
	}
	if (this.node.is_triple_rep()) {
		return true;
	}

	return false;
}



hub.run_game();
