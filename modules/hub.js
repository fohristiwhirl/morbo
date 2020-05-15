"use strict";

const {LoadMatchConfig, SaveMatchConfig} = require("./config");
const {DrawBoard} = require("./draw_board");
const {DrawInfobox} = require("./draw_infobox");
const {ipcRenderer} = require("electron");
const {NewEngine} = require("./engine");
const {NewRoot} = require("./node");
const {AppendPGN} = require("./pgn");
const {Point} = require("./point");
const utils = require("./utils");

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
	hub.running = false;

	hub.config = null;
	hub.config_file = null;

	hub.start_game = function() {

		if (this.running || !this.config || this.config.engines.length < 2) {
			return;
		}

		this.engine_w = NewEngine();
		this.engine_b = NewEngine();
		[this.white_id, this.black_id] = this.choose_engines();
		this.white_config = this.config.engines[this.white_id];
		this.black_config = this.config.engines[this.black_id];
		this.running = true;

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
		this.draw_infobox();

		setTimeout(() => {
			ipcRenderer.send("set_title", `${this.white_config.name} - ${this.black_config.name}`);
		}, 1000);

		this.getmove();
	};

	hub.choose_engines = function() {

		// Find the engine with the fewest games...

		let lowest_game_count = Infinity;
		let lowest_game_engine_id = null;

		for (let i = 0; i < this.config.engines.length; i++) {
			let e = this.config.engines[i];
			let results = e.results.split(" ");
			if (results.length < lowest_game_count) {
				lowest_game_count = results.length;
				lowest_game_engine_id = i;
			}
		}

		// Find the opponent it's played the least...

		let e = this.config.engines[lowest_game_engine_id];

		let games_counts = new Array(this.config.engines.length).fill(0);

		let results = e.results.split(" ");

		for (let r of results) {
			let opp_id = parseInt(r.slice(1));
			games_counts[opp_id]++;
		}

		let opponent_id = null;
		let opponent_games = null;

		for (let i = 0; i < games_counts.length; i++) {

			if (i === lowest_game_engine_id) {
				continue;
			}

			if (opponent_id === null || games_counts[i] < opponent_games) {
				opponent_id = i;
				opponent_games = games_counts[i];
			}
		}

		// Choose black and white...

		if (opponent_games % 2 === 0) {
			return [lowest_game_engine_id, opponent_id];
		} else {
			return [opponent_id, lowest_game_engine_id];
		}

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

		if (!this.running) {		// Required because the user can call this at odd times.
			return;
		}

		if (this.white_config.results !== "") this.white_config.results += " ";
		if (this.black_config.results !== "") this.black_config.results += " ";

		if (result === "1-0") {
			this.white_config.results += `+${this.black_id}`;
			this.black_config.results += `-${this.white_id}`;
		} else if (result === "1/2-1/2") {
			this.white_config.results += `=${this.black_id}`;
			this.black_config.results += `=${this.white_id}`;
		} else if (result === "0-1") {
			this.white_config.results += `-${this.black_id}`;
			this.black_config.results += `+${this.white_id}`;
		}

		SaveMatchConfig(this.config_file, this.config);

		let root = this.node.get_root();

		if (this.white_config.name) {
			root.tags.White = this.white_config.name;
		} else {
			root.tags.White = this.engine_w.name;
		}

		if (this.black_config.name) {
			root.tags.Black = this.black_config.name;
		} else {
			root.tags.Black = this.engine_b.name;
		}
		
		root.tags.Result = result;

		if (this.config.outpgn) {
			AppendPGN(this.config.outpgn, this.node);
		}

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
		this.running = false;

		this.draw_infobox();
	};

	hub.load_match = function(filename) {

		try {
			this.config = LoadMatchConfig(filename);
		} catch (err) {
			alert(err);
			return;
		}

		this.config_file = filename;

		this.terminate();
		this.start_game();
	};

	hub.draw_board = function() {
		DrawBoard(this.node.board);
	};

	hub.draw_infobox = function() {
		DrawInfobox(this.config, this.config_file, this.running);
	};

	hub.nice_history = function() {
		return this.node.node_history().map(node => node.token()).slice(1);
	};

	return hub;
}



exports.NewHub = NewHub;
