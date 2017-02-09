const fs = require('fs');
const express = require('express');
const app = express();

const baseDir = 'x:/music';

app.get('/hello', function(req, res) {
	res.send("hello world!");
});

app.get('/fs/', function(req, res) {
	var files = fs.readdirSync(baseDir);
	res.send(files);
});

app.get('/fs/:path', function(req, res) {
	var path = req.params.path;
	path = baseDir + '/' + path;
	var files = fs.readdirSync(path);
	res.send(files);
});

app.listen(3000, function() {
  console.log('Example app listening on port 3000!');
});

