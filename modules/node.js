"use strict";

let next_node_id = 1;

function NewNode(parent, move, board) {		// move must be legal; board is only relevant for root nodes

	let node = Object.create(node_prototype);
	node.id = next_node_id++;

	if (parent) {
		node.parent = parent;
		node.move = move;
		node.board = parent.board.move(move);
		node.depth = parent.depth + 1;
	} else {
		node.parent = null;
		node.move = null;
		node.board = board;
		node.depth = 0;
	}

	node.__nice_move = null;
	node.destroyed = false;
	node.children = [];

	return node;
}

function NewRoot(board) {					// Arg is a board (position) object, not a FEN
	
	if (!board) {
		board = LoadFEN("rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1");
	}

	let root = NewNode(null, null, board);

	root.tags = Object.create(null);		// Only root gets these. Get overwritten by the PGN loader.
	root.tags.Event = "Morbo Match";
	root.tags.Site = "Earth";
	root.tags.Date = DateString(new Date());
	root.tags.Round = "1";
	root.tags.White = "White";
	root.tags.Black = "Black";
	root.tags.Result = "*";

	return root;
}

const node_prototype = {

	make_move: function(s, force_new_node) {

		// s must be exactly a legal move, including having promotion char iff needed (e.g. e2e1q)

		if (!force_new_node) {
			for (let child of this.children) {
				if (child.move === s) {
					return child;
				}
			}
		}

		let new_node = NewNode(this, s);
		this.children.push(new_node);

		return new_node;
	},

	is_triple_rep: function() {

		let our_board = this.board;
		let ancestor = this;
		let hits = 0;

		while (ancestor.parent && ancestor.parent.parent) {
			ancestor = ancestor.parent.parent;
			if (ancestor.board.compare(our_board)) {
				hits++;
				if (hits >= 2) {
					return true;
				}
			}
		}

		return false;
	},

	nice_move: function() {

		if (this.__nice_move) {
			return this.__nice_move;
		}

		if (!this.move || !this.parent) {
			this.__nice_move = "??";
		} else {
			this.__nice_move = this.parent.board.nice_string(this.move);
		}

		return this.__nice_move;
	},

	token: function() {

		// The complete token when writing the move, including number string if necessary,
		// which depends on position within variations etc and so cannot easily be cached.
		// We don't do brackets because closing brackets are complicated.

		if (!this.move || !this.parent) {
			return "";
		}

		let need_number_string = false;

		if (this.parent.board.active === "w") need_number_string = true;
		if (this.parent.children[0] !== this) need_number_string = true;

		// In theory we should also write the number if the parent had siblings. Meh.

		let s = "";

		if (need_number_string) {
			s += this.parent.board.next_number_string() + " ";
		}
		
		s += this.nice_move();

		return s;
	},

	detach: function() {

		// Returns the node that the renderer should point to,
		// which is the parent unless the call is a bad one.

		let parent = this.parent;
		if (!parent) return this;		// Fail

		let new_list_for_parent = [];

		for (let c of parent.children) {
			if (c !== this) {
				new_list_for_parent.push(c);
			}
		}

		parent.children = new_list_for_parent;
		this.parent = null;
		DestroyTree(this);
		return parent;
	},
};

// ---------------------------------------------------------------------------------------------------------
// On the theory that it might help the garbage collector, we can
// destroy trees when we're done with them. Whether this is helpful
// in general I don't know, but we also take this opportunity to
// clear nodes from the live_list.

function DestroyTree(node) {
	__destroy_tree(node.get_root());
}

function __destroy_tree(node) {

	// Non-recursive when possible...

	while (node.children.length === 1) {

		let child = node.children[0];

		node.parent = null;
		node.board = null;
		node.children = null;
		node.destroyed = true;

		node = child;
	}

	// Recursive when necessary...

	let children = node.children;

	node.parent = null;
	node.board = null;
	node.children = null;
	node.destroyed = true;

	for (let child of children) {
		__destroy_tree(child);
	}
}



exports.NewNode = NewNode;
exports.NewRoot = NewRoot;
exports.DestroyTree = DestroyTree;
