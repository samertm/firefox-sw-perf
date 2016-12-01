var express = require('express');
var app = express();

app.get('/', function(req, res) {
  res.sendfile('index.html');
});

app.get('/with_sw', function(req, res) {
  res.sendfile('index.html');
});

app.get('/with_dbxsw', function(req, res) {
  res.sendfile('index.html');
});

app.get('/with_faster_dbxsw', function(req, res) {
  res.sendfile('index.html');
});

app.get('/sw.js', function(req, res) {
  res.sendfile('sw.js');
});

app.get('/dbxsw.js', function(req, res) {
  res.sendfile('dbxsw.js');
});

app.get('/faster_dbxsw.js', function(req, res) {
  res.sendfile('faster_dbxsw.js');
});

app.get('/get_results.js', function(req, res) {
  res.sendfile('get_results.js');
});

app.use('/static', express.static('./static/', {maxAge: 100000000000}));

var server = app.listen(4445, function() {
  console.log('Test server listening at http://localhost:%s',
              server.address().port);
});
