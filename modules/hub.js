"use strict";

const {LoadMatchConfig, SaveMatchConfig} = require("./config");
const {DrawBoard} = require("./draw_board");
const {DrawInfobox} = require("./draw_infobox");
const {ipcRenderer} = require("electron");
const {NewEngine} = require("./engine");
const fs = require("fs");
const {NewRoot} = require("./node");
const {AppendPGN, PreParsePGN, LoadPGNRecord} = require("./pgn");
const {Point} = require("./point");
const utils = require("./utils");

exports.NewHub = function() {

	let hub = Object.create(null);

	hub.game = null;
	hub.book = null;
	hub.config = null;
	hub.config_file = null;

	hub.start_game = function() {

		if (this.game || !this.config || this.config.engines.length < 2) {
			return;
		}

		let [white_id, black_id] = this.choose_engines();

		this.game = {
			engine_w: NewEngine(),
			engine_b: NewEngine(),
			white_id: white_id,
			black_id: black_id,
			white_config: this.config.engines[white_id],
			black_config: this.config.engines[black_id],
			node: NewRoot(),		// Maybe replaced in a moment.
		}

		let game = this.game;

		game.engine_w.setup(game.white_config.path, game.white_config.args, this.receive.bind(this, "w", game.engine_w), () => {});
		game.engine_b.setup(game.black_config.path, game.black_config.args, this.receive.bind(this, "b", game.engine_b), () => {});

		game.engine_w.send("uci");
		game.engine_b.send("uci");
		game.engine_w.setoption("UCI_Chess960", true);
		game.engine_b.setoption("UCI_Chess960", true);

		for (let [key, value] of Object.entries(game.white_config.options)) {
			game.engine_w.setoption(key, value);
		}
		for (let [key, value] of Object.entries(game.black_config.options)) {
			game.engine_b.setoption(key, value);
		}

		game.engine_w.send("ucinewgame");
		game.engine_b.send("ucinewgame");

		setTimeout(() => {
			try {
				ipcRenderer.send("set_title", `${game.white_config.name} - ${game.black_config.name}`);
			} catch (err) {
				// pass
			}
		}, 1000);

		if (this.book) {
			let index = Math.floor(this.versus_count(game.white_id, game.black_id) / 2);
			index %= this.book.length;
			try {
				this.game.node = LoadPGNRecord(this.book[index]).get_end();
			} catch (err) {
				alert("While loading game from book: " + err.toString());
			}
		}

		this.draw_board();
		this.draw_infobox();

		this.getmove();
	};

	hub.choose_engines = function() {

		// Find the engine with the fewest games...

		let lowest_game_engine_id = null;
		let lowest_game_count = null;
		
		for (let i = 0; i < this.config.engines.length; i++) {

			let e = this.config.engines[i];

			let results = e.results.split(" ").filter(z => z !== "");

			if (lowest_game_engine_id === null || results.length < lowest_game_count) {
				lowest_game_engine_id = i;
				lowest_game_count = results.length;
			}
		}

		// Find the opponent it's played the least...

		let opponent_id = null;
		let games_vs_opponent = null;

		for (let i = 0; i < this.config.engines.length; i++) {

			if (i === lowest_game_engine_id) {
				continue;
			}

			let vs_count = this.versus_count(lowest_game_engine_id, i);

			if (opponent_id === null || vs_count < games_vs_opponent) {
				opponent_id = i;
				games_vs_opponent = vs_count;
			}
		}

		// Put the lowest ID first to make it easy to be sure we're choosing black / white correctly...

		let ret = [lowest_game_engine_id, opponent_id]
		ret.sort();

		// Choose black and white...

		if (games_vs_opponent % 2 === 0) {
			return ret;
		} else {
			return ret.reverse();
		}
	};

	hub.versus_count = function(index_a, index_b) {

		let count = 0;

		let e = this.config.engines[index_a];

		let results = e.results.split(" ").filter(z => z !== "");

		for (let result of results) {

			let opp_id = parseInt(result.slice(1));
			if (opp_id === index_b) {
				count++;
			}
		}

		return count;
	};

	hub.receive = function(engine_colour, engine_object, s) {

		if (!this.game) {
			engine_object.shutdown();
			return;
		}

		let game = this.game;

		if (engine_colour === "w" && engine_object !== game.engine_w) {
			engine_object.shutdown();
			return;
		}

		if (engine_colour === "b" && engine_object !== game.engine_b) {
			engine_object.shutdown();
			return;
		}

		if (s.startsWith("bestmove")) {

			if (game.node.board.active !== engine_colour) {
				this.forfeit(engine_colour, "bestmove out of turn");
				return;
			}

			let tokens = s.split(" ").filter(z => z !== "");

			let ok = this.move(tokens[1]);

			if (!ok) {
				this.forfeit(engine_colour, "illegal: " + s);
				return;
			}

			this.progress_game();
		}
	};

	hub.progress_game = function() {

		if (!this.game) {
			return;
		}

		let result = this.adjudicate();

		if (result) {
			this.finish_game(result);
			return;
		}

		this.getmove();
	};

	hub.adjudicate = function() {

		if (!this.game) {
			return null;
		}

		let board = this.game.node.board;

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
		if (this.game.node.is_triple_rep()) {
			return "1/2-1/2";
		}

		return null;
	};

	hub.getmove = function() {

		if (!this.game) {
			return;
		}

		let game = this.game;

		let engine = game.node.board.active === "w" ? game.engine_w : game.engine_b;

		let root_fen = game.node.get_root().board.fen(false);
		let setup = `fen ${root_fen}`;

		engine.send(`position ${setup} moves ${game.node.history().join(" ")}`);
		engine.send("isready");
		engine.send(`go movetime ${this.config.movetime}`);
	};

	hub.move = function(s) {							// Returns false on illegal.

		if (!this.game) {
			return false;
		}

		let source = Point(s.slice(0, 2));

		if (!source) {
			return false;
		}

		// Convert old-school castling notation to Chess960 format...

		let board = this.game.node.board;
		s = board.c960_castling_converter(s);

		// The promised legality check...

		let illegal_reason = board.illegal(s);
		if (illegal_reason !== "") {
			return false;
		}

		this.game.node = this.game.node.make_move(s);
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

		if (!this.game) {		// Required because the user can call this at odd times.
			return;
		}

		if (this.game.white_config.results !== "") this.game.white_config.results += " ";
		if (this.game.black_config.results !== "") this.game.black_config.results += " ";

		if (result === "1-0") {
			this.game.white_config.results += `+${this.game.black_id}`;
			this.game.black_config.results += `-${this.game.white_id}`;
		} else if (result === "1/2-1/2") {
			this.game.white_config.results += `=${this.game.black_id}`;
			this.game.black_config.results += `=${this.game.white_id}`;
		} else if (result === "0-1") {
			this.game.white_config.results += `-${this.game.black_id}`;
			this.game.black_config.results += `+${this.game.white_id}`;
		}

		SaveMatchConfig(this.config_file, this.config);

		let root = this.game.node.get_root();

		if (this.game.white_config.name) {
			root.tags.White = this.game.white_config.name;
		} else {
			root.tags.White = this.game.engine_w.name;
		}

		if (this.game.black_config.name) {
			root.tags.Black = this.game.black_config.name;
		} else {
			root.tags.Black = this.game.engine_b.name;
		}
		
		root.tags.Result = result;

		if (this.config.outpgn) {
			AppendPGN(this.config.outpgn, this.game.node);
		}

		this.terminate();

		setTimeout(this.start_game.bind(this), 2000);
	};

	hub.terminate = function() {

		// Stops the game but doesn't affect the match state or loaded config.

		if (!this.game) {
			return;
		}

		this.game.engine_w.shutdown();
		this.game.engine_b.shutdown();
		this.game = null;

		this.draw_infobox();
	};

	hub.load_match = function(filename) {

		// We might need to restore these things on failure...

		let old_config = this.config;
		let old_config_file = this.config_file;
		let old_book = this.book;

		try {

			this.config = LoadMatchConfig(filename);

			if (this.config.book) {
				let buf = fs.readFileSync(this.config.book);
				this.book = PreParsePGN(buf);
			} else {
				this.book = null;
			}

			this.config_file = filename;

		} catch (err) {

			alert("While loading match file: " + err.toString());
			this.config = old_config;
			this.config_file = old_config_file;
			this.book = old_book;
			return;

		}

		this.terminate();
		this.start_game();
	};

	hub.draw_board = function() {
		if (this.game) {
			DrawBoard(this.game.node.board);
		}
	};

	hub.draw_infobox = function() {
		DrawInfobox(this.config, this.config_file, this.game !== null);
	};

	return hub;
}
