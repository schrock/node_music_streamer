const fs = require('fs');
const express = require('express');
const app = express();

var config = require('./config.json');

app.get('/hello', function(req, res) {
	res.send("hello world!");
});

app.get('/dir', function(req, res) {
	var path = req.query.path;
	if (typeof path === 'undefined') {
		res.send('You must specify query parameter \'path\'');
		return;
	}
	path = config.baseDir + '/' + path;
	var files = fs.readdirSync(path);
	res.send(files);
});

app.listen(3000, function() {
  console.log('Example app listening on port 3000!');
});

