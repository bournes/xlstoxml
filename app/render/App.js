angular.module('myapp', []);
let packagejson = require("fs").readFileSync(__dirname + "/../../package.json")
let config = JSON.parse(packagejson)
document.title = config['app-name'] + " " + config.version