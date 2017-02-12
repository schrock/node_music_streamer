// configuration
var config = require('./config.json');

// 3rd party
const app = require('express')();
const fs = require('fs');

// classes
const DirEntry = require('./DirEntry.js');

app.get('/hello', function (req, res) {
	res.send("hello world!");
});

app.get('/dir', function (req, res) {
	var queryPath = req.query.path;
	if (typeof queryPath === 'undefined') {
		queryPath = '';
	}
	var realPath = config.baseDir + '/' + queryPath;

	var dirContents;
	try {
		dirContents = fs.readdirSync(realPath);
	} catch (Err) {
		res.send('Unable to read path ' + realPath);
		return;
	}

	var dirEntries = [];
	for (var fileName of dirContents) {
		var filePath = realPath + '/' + fileName;
		var dirUrl = req.protocol + '://' + req.hostname + ':' + req.socket.localPort + '/dir?path=' + queryPath + '/' + fileName;
		var stat = fs.statSync(filePath);
		if (stat.isDirectory()) {
			dirEntries.push(new DirEntry('dir', fileName, filePath, dirUrl));
		} else if (stat.isFile()) {
			dirEntries.push(new DirEntry('file', fileName, filePath, null));
		}
	}
	res.send(dirEntries);
});

app.listen(3000, function () {
	console.log('Example app listening on port 3000!');
});
