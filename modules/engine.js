"use strict";

const child_process = require("child_process");
const path = require("path");
const readline = require("readline");

function NewEngine() {

	let eng = Object.create(null);

	eng.exe = null;
	eng.name = "??";
	eng.readyok_required = 0;
	eng.bestmove_required = 0;
	eng.scanner = null;
	eng.err_scanner = null;
	eng.ever_sent = false;
	eng.ever_received_uciok = false;

	eng.send = function(msg) {

		if (!this.exe) {
			return;
		}

		msg = msg.trim();

		if (msg.startsWith("go")) {
			this.bestmove_required++;
		}

		if (msg === "isready") {
			this.readyok_required++;
		}

		try {
			this.exe.stdin.write(msg);
			this.exe.stdin.write("\n");
			// Log("--> " + msg);
			this.ever_sent = true;
		} catch (err) {
			// Log("(failed) --> " + msg);
		}

		return msg;
	};

	eng.setoption = function(name, value) {
		let s = `setoption name ${name} value ${value}`;
		this.send(s);
		return s;
	};

	eng.setup = function(filepath, args, receive_fn, err_receive_fn) {

		// Log("");
		// Log(`Launching ${filepath}`);
		// Log("");

		this.receive_fn = receive_fn;
		this.err_receive_fn = err_receive_fn;

		this.readyok_required = 0;
		this.bestmove_required = 0;

		this.name = path.basename(filepath);		// Temporary until (hopefully) we receive an id name UCI reply.

		try {
			this.exe = child_process.spawn(filepath, args, {cwd: path.dirname(filepath)});
		} catch (err) {
			alert(err);
			return;
		}
		
		this.exe.once("error", (err) => {
			alert(err);
		});

		this.scanner = readline.createInterface({
			input: this.exe.stdout,
			output: undefined,
			terminal: false
		});

		this.err_scanner = readline.createInterface({
			input: this.exe.stderr,
			output: undefined,
			terminal: false
		});

		this.err_scanner.on("line", (line) => {
			// Log(". " + line);
			this.err_receive_fn(line);
		});

		this.scanner.on("line", (line) => {

			// Firstly, make sure we correct our sync counters...
			// Do both these things before anything else.

			if (line.includes("bestmove") && this.bestmove_required > 0) {
				this.bestmove_required--;
			}

			if (line.includes("readyok") && this.readyok_required > 0) {
				this.readyok_required--;
			}

			// Startup info...

			if (line.includes("uciok")) {
				this.ever_received_uciok = true;
			}

			if (line.startsWith("id name")) {
				let tokens = line.split(" ").slice(2);
				this.name = tokens.join(" ");
			}

			// We want to ignore output that is clearly obsolete...

			if (this.bestmove_required > 1 || (line.includes("bestmove") && this.bestmove_required > 0)) {
				//	if (config.log_info_lines || line.includes("info") === false) {
				//		Log("(bestmove desync) < " + line);
				//	}
				return;
			}

			// We want to ignore all output when waiting for "readyok"...

			if (this.readyok_required > 0) {
				//	if (config.log_info_lines || line.includes("info") === false) {
				//		Log("(readyok desync) < " + line);
				//	}
				return;
			}

			//	if (config.log_info_lines || line.includes("info") === false) {
			//		Log("< " + line);
			//	}

			this.receive_fn(line);
		});
	};

	eng.shutdown = function() {				// Note: Don't reuse the engine object.
		this.receive_fn = () => {};
		this.err_receive_fn = () => {};
		this.send("quit");
		if (this.exe) {
			setTimeout(() => {
				this.exe.kill();
			}, 2000);
		}
	};
	
	return eng;
}

exports.NewEngine = NewEngine;
