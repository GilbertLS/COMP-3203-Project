var logger = require('morgan');
var express = require('express');
var app = express();
var server = require('http').createServer(app);
var sockets = require('./sockets')(server);

var port = 80;

//=====================
//=======Express=======
//=====================
app.use(logger('dev'));
app.use(express.static(__dirname + '/public'));
server.listen(port);

console.log('Express listening on ' + port + '...');