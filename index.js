// configuration
var config = require('./config.json');

// 3rd party
const express = require('express');
const app = express();
const fs = require('fs');

// classes
const DirEntry = require('./DirEntry.js');
const Directory = require('./Directory.js');
const MediaFile = require('./MediaFile.js');

app.get('/hello', function (req, res) {
	res.send('hello world!');
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
		dirContents.sort();
	} catch (Err) {
		res.send('Unable to read path ' + realPath);
		return;
	}

	var dirEntries = [];
	for (var fileName of dirContents) {
		var filePath = queryPath + '/' + fileName;
		var realPath = config.baseDir + '/' + filePath;
		var stat = fs.statSync(realPath);
		if (stat.isDirectory()) {
			var dirUrl = req.protocol + '://' + req.hostname + ':' + req.socket.localPort + '/dir?path=' + queryPath + '/' + fileName;
			dirEntries.push(new Directory(fileName, filePath, dirUrl));
		} else if (stat.isFile()) {
			var extIndex = fileName.lastIndexOf('.');
			if (extIndex > 0) {
				var ext = fileName.substring(extIndex + 1);
				if (config.extensions.indexOf(ext) > -1) {
					var playUrl = req.protocol + '://' + req.hostname + ':' + req.socket.localPort + '/play?path=' + queryPath + '/' + fileName;
					dirEntries.push(new MediaFile(fileName, filePath, playUrl));
				}
			}
		}
	}
	res.contentType('application/json');
	res.send(JSON.stringify(dirEntries, null, 4));
});

app.get('/play', function (req, res) {
	var queryPath = req.query.path;
	var realPath = config.baseDir + '/' + queryPath;

	res.setHeader('Content-Type', 'audio/mpeg');
	res.setHeader('Content-Length', fs.statSync(realPath).size);
	fs.createReadStream(realPath).pipe(res);
});

// serve client-side web app
app.use(express.static('www'));
// serve client-side dependencies
app.use('/node_modules', express.static('node_modules'));

app.listen(3000, function () {
	console.log('node_music_streamer running on port 3000...');
});
