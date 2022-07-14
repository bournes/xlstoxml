const electron = require('electron')
    // Module to control application life.
const app = electron.app

const path = require('path')
const url = require('url')


const windows = require("./windows")

let xlsService
let settingService



function checkMainWindow() {
    if (windows.getWindow("Main") == null) {
        windows.createWindow("Main", { width: 700, height: 600 }, path.join(__dirname, '../html/index.html'), false)
    }
}

let setupAppEvents = function() {

    // This method will be called when Electron has finished
    // initialization and is ready to create browser windows.
    // Some APIs can only be used after this event occurs.
    app.on('ready', checkMainWindow)

    // Quit when all windows are closed.
    app.on('window-all-closed', function() {
        // On OS X it is common for applications and their menu bar
        // to stay active until the user quits explicitly with Cmd + Q
        if (process.platform !== 'darwin') {
            app.quit()
        }
    })

    app.on('activate', function() {
        // On OS X it's common to re-create a window in the app when the
        // dock icon is clicked and there are no other windows open.
        checkMainWindow();
    })
}




let setupServices = function() {
    settingService = require("./settingService")
    settingService.start()

    xlsService = require("./xlsService")
    xlsService.start()
}

setupAppEvents();

setupServices()