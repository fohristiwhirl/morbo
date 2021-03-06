"use strict";

const alert = require("./modules/alert");
const electron = require("electron");
const path = require("path");
const url = require("url");

// We want sync save and open dialogs. In Electron 5 we could get these by calling
// showSaveDialog or showOpenDialog without a callback, but in Electron 6 this no
// longer works and we must call new functions. So find out if they exist...

const save_dialog = electron.dialog.showSaveDialogSync || electron.dialog.showSaveDialog;
const open_dialog = electron.dialog.showOpenDialogSync || electron.dialog.showOpenDialog;

let win;
let menu = menu_build();

if (electron.app.isReady()) {
	startup();
} else {
	electron.app.once("ready", () => {
		startup();
	});
}

// ----------------------------------------------------------------------------------

function startup() {

	win = new electron.BrowserWindow({
		backgroundColor: "#000000",
		resizable: true,
		show: false,
		useContentSize: true,
		webPreferences: {
			backgroundThrottling: false,
			enableRemoteModule: true,
			nodeIntegration: true,
			zoomFactor: 1 / electron.screen.getPrimaryDisplay().scaleFactor		// Unreliable, see https://github.com/electron/electron/issues/10572
		}
	});

	win.once("ready-to-show", () => {
		try {
			win.webContents.setZoomFactor(1 / electron.screen.getPrimaryDisplay().scaleFactor);	// This seems to work, note issue 10572 above.
		} catch (err) {
			win.webContents.zoomFactor = 1 / electron.screen.getPrimaryDisplay().scaleFactor;	// The method above "will be removed" in future.
		}
		win.show();
		win.focus();
	});

	electron.ipcMain.on("set_title", (event, msg) => {
		win.setTitle(msg);
	});

	electron.app.on("window-all-closed", () => {
		electron.app.quit();
	});

	// Actually load the page last, I guess, so the event handlers above are already set up...

	win.loadURL(url.format({
		protocol: "file:",
		pathname: path.join(__dirname, "morbo.html"),
		slashes: true
	}));

	electron.Menu.setApplicationMenu(menu);
}

function menu_build() {

	let template = [
		{
			label: "App",
			submenu: [
				{
					label: "About",
					click: () => {
						alert(`Morbo ${electron.app.getVersion()} in Electron ${process.versions.electron}`);
					}
				},
				{
					role: "toggledevtools"
				},
				{
					type: "separator"
				},
				{
					role: "zoomin",
					accelerator: "CommandOrControl+="
				},
      			{
      				role: "zoomout",
      				accelerator: "CommandOrControl+-"
      			},
      			{
					type: "separator"
				},
				{
					role: "quit",
					label: "Quit",
					accelerator: "CommandOrControl+Q"
				},
			]
		},
		{
			label: "Match",
			submenu: [
				{
					label: "Load match",
					accelerator: "CommandOrControl+O",
					click: () => {
						let files = open_dialog({
							properties: ["openFile"]
						});
						if (Array.isArray(files) && files.length > 0) {
							let file = files[0];
							win.webContents.send("call", {
								fn: "load_match",
								args: [file]
							});
						}
					}
				},
				{
					type: "separator"
				},
				{
					label: "Declare White wins this game",
					click: () => {
						win.webContents.send("call", {
							fn: "finish_game",
							args: ["1-0"]
						});
					}
				},
				{
					label: "Declare Black wins this game",
					click: () => {
						win.webContents.send("call", {
							fn: "finish_game",
							args: ["0-1"]
						});
					}
				},
				{
					label: "Declare draw",
					click: () => {
						win.webContents.send("call", {
							fn: "finish_game",
							args: ["1/2-1/2"]
						});
					}
				},
				{
					type: "separator"
				},
				{
					label: "Abort game",
					click: () => {
						win.webContents.send("call", "terminate");
					}
				},
				{
					label: "Resume match",
					click: () => {
						win.webContents.send("call", "start_game");
					}
				},
				{
					type: "separator"
				},
				{
					label: "Reset match scores",
					click: () => {
						win.webContents.send("call", "reset_match_scores");
					}
				},
			]
		}
	];

	// Actually build the menu...

	return electron.Menu.buildFromTemplate(template);
}
