"use strict";

const DrawBoard = require("./draw").DrawBoard;
const ipcRenderer = require("electron").ipcRenderer;
const LoadMatchConfig = require("./config").LoadMatchConfig;
const NewEngine = require("./engine").NewEngine;
const NewRoot = require("./node").NewRoot;
const Point = require("./point").Point;

function NewHub() {

	let hub = Object.create(null);

	hub.node = NewRoot();

	// These things should all be false/null, or all be valid at once...

	hub.engine_w = null;
	hub.engine_b = null;
	hub.white_id = null;
	hub.black_id = null;
	hub.white_config = null;
	hub.black_config = null;
	hub.game_running = false;

	hub.start_game = function() {

		if (this.game_running || !this.config) {
			return;
		}

		this.engine_w = NewEngine();
		this.engine_b = NewEngine();
		[this.white_id, this.black_id] = this.choose_engines();
		this.white_config = this.config.engines[this.white_id];
		this.black_config = this.config.engines[this.black_id];
		this.game_running = true;

		this.engine_w.setup(
			this.white_config.path,
			this.white_config.args,
			this.receive.bind(this, "w", this.engine_w),
			() => {},
		);

		this.engine_b.setup(
			this.black_config.path,
			this.black_config.args,
			this.receive.bind(this, "b", this.engine_b),
			() => {},
		);

		this.engine_w.send("uci");
		this.engine_b.send("uci");

		this.engine_w.setoption("UCI_Chess960", true);
		this.engine_b.setoption("UCI_Chess960", true);

		for (let [key, value] of Object.entries(this.white_config.options)) {
			this.engine_w.setoption(key, value);
		}

		for (let [key, value] of Object.entries(this.black_config.options)) {
			this.engine_b.setoption(key, value);
		}

		this.engine_w.send("ucinewgame");
		this.engine_b.send("ucinewgame");

		this.node = NewRoot();
		this.draw_board();

		setTimeout(() => {
			ipcRenderer.send("set_title", `${this.engine_w.name} - ${this.engine_b.name}`);
		}, 1000);

		this.getmove();
	};

	hub.choose_engines = function() {
		return [0, 1];
	};

	hub.receive = function(engine_colour, engine_object, s) {

		if ((engine_colour === "w" && engine_object !== this.engine_w) || (engine_colour === "b" && engine_object !== this.engine_b)) {
			engine_object.shutdown();
			return;
		}

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

	hub.progress_game = function() {

		let board = this.node.board;

		let result = this.adjudicate();

		if (result) {
			this.finish_game(result);
			return;
		}

		this.getmove();
	};

	hub.adjudicate = function() {

		// TODO: update match stats etc.

		let board = this.node.board;

		if (board.no_moves()) {
			if (board.king_in_check()) {
				return board.active === "w" ? "0-1" : "1-0";
			} else {
				return "1/2-1/2";
			}
		}
		if (board.insufficient_material()) {
			return "1/2-1/2";
		}
		if (board.halfmove >= 100) {
			return "1/2-1/2";
		}
		if (this.node.is_triple_rep()) {
			return "1/2-1/2";
		}

		return null;
	};

	hub.getmove = function() {

		let engine = this.node.board.active === "w" ? this.engine_w : this.engine_b;

		let root_fen = this.node.get_root().board.fen(false);
		let setup = `fen ${root_fen}`;

		engine.send(`position ${setup} moves ${this.node.history().join(" ")}`);
		engine.send("isready");
		engine.send(`go movetime ${this.config.movetime}`);
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
		this.draw_board();
		return true;
	};

	hub.forfeit = function(engine_colour, reason) {
		alert(`Forfeit (${engine_colour}), ${reason}`);
		result = engine_colour === "w" ? "0-1" : "1-0";
		this.finish_game(result);
		return;
	};

	hub.finish_game = function(result) {		// TODO - accept a comment parameter

		if (!this.game_running) {		// Required because the user can call this at odd times.
			return;
		}

		console.log(`${this.engine_w.name} ${result} ${this.engine_b.name}`);
		console.log(this.nice_history().join(" "));

		this.terminate();

		setTimeout(this.start_game.bind(this), 2000);
	};

	hub.terminate = function() {
		if (this.engine_w) this.engine_w.shutdown();
		if (this.engine_b) this.engine_b.shutdown();
		this.engine_w = null;
		this.engine_b = null;
		this.white_id = null;
		this.black_id = null;
		this.white_config = null;
		this.black_config = null;
		this.game_running = false;
	};

	hub.load_match = function(filename) {

		try {
			this.config = LoadMatchConfig(filename)
		} catch (err) {
			alert(err);
			return;
		}

		this.terminate();
		this.start_game();
	};

	hub.draw_board = function() {
		DrawBoard(this.node.board);
	};

	hub.nice_history = function() {
		return this.node.node_history().map(node => node.token()).slice(1);
	};

	return hub;
}



exports.NewHub = NewHub;
