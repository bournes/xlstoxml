const electron = require('electron')
const BrowserWindow = electron.BrowserWindow
const path = require('path')
const url = require('url')

let windowList = {}

function createWindow(windowName, createParams, path, isOpenDev) {
    let window = new BrowserWindow(createParams)

    // and load the index.html of the app.
    window.loadURL(url.format({
        pathname: path,
        protocol: 'file:',
        slashes: true
    }))

    if (isOpenDev) {
        window.webContents.openDevTools()
    }
    windowList[windowName] = window;
    window.on('closed', function() {
        delete windowList[windowName];
    });
    window.windowName = windowName;
    return window
}



function getWindow(windowName) {
    return windowList[windowName]
}

function closeWindow(window) {
    if (window != null) {
        window.close();
        let windowName = window.windowName;
        delete windowList[windowName];
    }
}


module.exports = {
    createWindow: createWindow,
    closeWindow: closeWindow,
    getWindow: getWindow
};