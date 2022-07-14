let jetpack = require('fs-jetpack');
const windows = require("./windows")
const path = require('path')

let userDataDir = jetpack.cwd(path.join(__dirname, '../'));
let stateStoreFile = 'setting.json'

let state = userDataDir.read(stateStoreFile, 'json') || [
    { dir: "", need: true, text: "lua", reg: "Client|Both|Lua" },
    { dir: "", need: true, text: "xml", reg: "Server|Both|Xml" },
    { dir: "", need: false, text: "csv", reg: "Client|Both|Csv" }
];


let settingWindow


function saveData(s) {
    state = s;
    userDataDir.write(stateStoreFile, state, { atomic: true });
}

function start() {
    const { ipcMain } = require('electron')



    ipcMain.on('c2s_open_setting', (event, arg) => {
        let settingWindow = windows.getWindow("setting");
        if (settingWindow != null) {
            windows.closeWindow(settingWindow);
        }

        settingWindow = windows.createWindow("setting", { width: 700, height: 400, modal: true }, path.join(__dirname, '../html/setting.html'))

        settingWindow.show()
    })

    ipcMain.on('c2s_close_setting', (event, arg) => {

        let settingWindow = windows.getWindow("setting");
        if (settingWindow != null) {
            windows.closeWindow(settingWindow);
        }
    })

    ipcMain.on('c2s_save_setting', (event, data) => {
        saveData(data);
    })

    ipcMain.on('c2s_sync_get_setting', (event, arg) => {
        event.returnValue = state
    })
}


module.exports = {
    start: start,
    getData: function() { return state }
};


// let window