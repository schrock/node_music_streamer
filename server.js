'use strict';

// configuration
var config = require('./config.json');

// 3rd party
const https = require('https');
const pem = require('pem');
const express = require('express');
const app = express();
const IpFilter = require('express-ipfilter').IpFilter;
const IpDeniedError = require('express-ipfilter').IpDeniedError;
const fs = require('fs');
const ffmpeg = require('fluent-ffmpeg');

// classes
const DirEntry = require('./DirEntry.js');
const Directory = require('./Directory.js');
const MediaFile = require('./MediaFile.js');

pem.createCertificate({ days: 90, selfSigned: true }, function (err, keys) {

	// whitelist certain ip addresses
	app.use(IpFilter(config.whitelistIps, { mode: 'allow', logLevel: 'deny' }));
	app.use(function (err, req, res, _next) {
		console.log('Error handler', err);
		if (err instanceof IpDeniedError) {
			res.status(401);
		} else {
			res.status(err.status || 500);
		}

		res.render('error', {
			message: 'Forbidden by ip filter.',
			error: err
		});
	});

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
				var dirUrl = req.protocol + '://' + req.hostname + ':' + req.socket.localPort + '/dir?path=' + encodeURIComponent(queryPath + '/' + fileName);
				dirEntries.push(new Directory(fileName, realPath, dirUrl));
			} else if (stat.isFile()) {
				var extIndex = fileName.lastIndexOf('.');
				if (extIndex > 0) {
					var ext = fileName.substring(extIndex + 1);
					if (config.extensions.indexOf(ext) > -1) {
						var playUrl = req.protocol + '://' + req.hostname + ':' + req.socket.localPort + '/play?path=' + encodeURIComponent(queryPath + '/' + fileName);
						dirEntries.push(new MediaFile(fileName, realPath, playUrl));
					}
				}
			}
		}
		res.contentType('application/json');
		res.send(JSON.stringify(dirEntries, null, 4));
	});

	app.get('/play', function (req, res) {
		res.header('Accept-Ranges', 'bytes');
		res.setHeader('Content-Type', 'audio/mpeg');

		var range = req.headers.range;
		if (range == null) {
			range = 'bytes=0-';
		}
		// console.log('range: ' + range);
		var equalsIndex = range.indexOf('=');
		var dashIndex = range.indexOf('-');
		var startByte = Number(range.substring(equalsIndex + 1, dashIndex));
		var endByte = range.substring(dashIndex + 1);

		var queryPath = req.query.path;
		var realPath = config.baseDir + '/' + queryPath;
		var extIndex = realPath.lastIndexOf('.');
		var ext = null;
		if (extIndex > 0) {
			ext = realPath.substring(extIndex + 1);
		}

		// convert to mp3 using ffmpeg
		var track_index = Number(req.query.track_index);
		var gain = req.query.gain;

		var duration = req.query.duration;
		var fileSize = Math.floor(duration * (256 * 1000 / 8));
		if (endByte.length == 0) {
			endByte = fileSize - 1;
		} else {
			endByte = Number(endByte);
		}
		// console.log('startByte: ' + startByte);
		// console.log('endByte:   ' + endByte);
		res.setHeader('Content-Range', 'bytes ' + startByte + '-' + endByte + '/' + fileSize);
		res.setHeader('Content-Length', endByte - startByte + 1);
		res.status(206);

		var startTime = 0;
		if (startByte > 0) {
			startTime = startByte / (256 * 1000 / 8);
		}
		var endTime = endByte / (256 * 1000 / 8);
		// console.log('startTime: ' + startTime);
		// console.log('endTime:   ' + endTime);

		var command = ffmpeg(realPath);
		if (track_index > 0) {
			command.inputOptions('-track_index ' + track_index);
		}
		command.audioCodec('libmp3lame').audioChannels(2)
			.audioFrequency(44100).audioBitrate(256).format('mp3').noVideo()
			.seek(startTime).duration(endTime - startTime)
			.audioFilters('volume=' + gain)
			.on('start', function () {
				//console.log('Processing started:  ' + realPath);
			})
			.on('error', function (err) {
				if (!err.toString().includes('Output stream closed')) {
					console.log('Processing error:    ' + realPath + ' : ' + err.message);
				}
			})
			.on('end', function () {
				//console.log('Processing finished: ' + realPath);
			})
			.pipe(res, { end: true });
	});

	// serve client-side web app
	app.use(express.static('www'));
	// serve client-side dependencies
	app.use('/node_modules', express.static('node_modules'));

	var port = 8443;
	https.createServer({key: keys.serviceKey, cert: keys.certificate}, app).listen(port);
	console.log('node_music_streamer running on port ' + port + '...');
});