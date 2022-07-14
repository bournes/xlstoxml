
const {ipcRenderer} = require('electron')




angular.module('myapp').controller("SettingCtrl", function($scope) {

    $scope.settings = ipcRenderer.sendSync('c2s_sync_get_setting');

    $scope.close = function() {
        ipcRenderer.send('c2s_close_setting');

    }

    $scope.save = function() {
        ipcRenderer.send('c2s_save_setting', $scope.settings);
        $scope.close();
    }

    $scope.changeDir = function(setting) {
        const {dialog} = require('electron').remote
        let path = dialog.showOpenDialog({properties: [ 'openDirectory']});
        if (path && path.length>0) {
            setting.dir = path[0];
        }
    
    }
});
