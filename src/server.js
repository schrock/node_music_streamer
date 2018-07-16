'use strict';

// configuration
const nconf = require('nconf');
nconf.argv().env().file('./config.local.json');
nconf.defaults({
	"baseDir": process.env.HOME + "/Music",
	"extensions": ["mp3", "m4a", "flac", "ogg", "ay", "gbs", "gym", "hes", "kss", "nsf", "nsfe", "sap", "spc", "vgm"],
	"httpsCertFile": "./localhost.cert",
	"httpsKeyFile": "./localhost.key",
	"whitelistIps": [
		[
			"127.0.0.0",
			"127.255.255.255"
		],
		[
			"172.16.0.0",
			"172.31.255.255"
		],
		[
			"192.168.0.0",
			"192.168.255.255"
		],
		"::1"
	]
});

// 3rd party
const cluster = require('cluster');
const os = require('os');
const express = require('express');
const https = require('https');
const app = express();
const IpFilter = require('express-ipfilter').IpFilter;
const IpDeniedError = require('express-ipfilter').IpDeniedError;
const fs = require('fs');
const ffmpeg = require('fluent-ffmpeg');

// classes
const DirEntry = require('./DirEntry.js');
const Directory = require('./Directory.js');
const MediaFile = require('./MediaFile.js');

if (cluster.isMaster) {
	console.log('baseDir: ' + JSON.stringify(nconf.get('baseDir'), null, 4));
	console.log('extensions: ' + JSON.stringify(nconf.get('extensions'), null, 4));
	console.log('httpsCertFile: ' + JSON.stringify(nconf.get('httpsCertFile'), null, 4));
	console.log('httpsKeyFile: ' + JSON.stringify(nconf.get('httpsKeyFile'), null, 4));
	console.log('whitelistIps: ' + JSON.stringify(nconf.get('whitelistIps'), null, 4));

	var numCPUs = os.cpus().length;
	for (var i = 0; i < numCPUs; i++) {
		// Create a worker
		cluster.fork();
	}

	cluster.on('exit', function (worker, code, signal) {
		console.log('Worker %d died with code/signal %s. Restarting worker...', worker.process.pid, signal || code);
		cluster.fork();
	});
} else {
	// whitelist certain ip addresses
	app.use(IpFilter(nconf.get('whitelistIps'), { mode: 'allow', logLevel: 'deny' }));
	app.use(function (err, req, res, _next) {
		if (err instanceof IpDeniedError) {
			res.status(401);
		} else {
			res.status(err.status || 500);
		}

		res.send(err.message);
	});

	app.use(function (req, res, next) {
		res.header("Cache-Control", "no-store, no-cache");
		next();
	});

	app.get('/hello', function (req, res) {
		res.send('hello world!');
	});

	app.get('/dir', getDir);

	app.get('/play', getPlay);

	// serve client-side web app
	app.use('/', express.static('src/www'));
	// serve client-side dependencies
	app.use('/node_modules', express.static('node_modules'));

	// setup server
	var options = {
		key: fs.readFileSync(nconf.get('httpsKeyFile')),
		cert: fs.readFileSync(nconf.get('httpsCertFile')),
		requestCert: false,
		rejectUnauthorized: false
	};
	var port = 8443;
	var server = https.createServer(options, app);
	server.listen(port, function () {
		console.log('worker running on port ' + port + '...');
	});
}

function getDir(req, res) {
	var queryPath = req.query.path;
	if (typeof queryPath === 'undefined') {
		queryPath = '';
	}
	var realPath = nconf.get('baseDir') + '/' + queryPath;

	var dirContents;
	try {
		dirContents = fs.readdirSync(realPath);
		dirContents.sort();
	} catch (Err) {
		res.send('Unable to read path ' + realPath);
		return;
	}

	var dirEntries = [];
	var initPromises = [];
	for (var fileName of dirContents) {
		var filePath = queryPath + '/' + fileName;
		var realPath = nconf.get('baseDir') + '/' + filePath;
		var stat = fs.statSync(realPath);
		if (stat.isDirectory()) {
			var dirUrl = '/dir?path=' + encodeURIComponent(queryPath + '/' + fileName);
			dirEntries.push(new Directory(fileName, realPath, dirUrl));
		} else if (stat.isFile()) {
			var extIndex = fileName.lastIndexOf('.');
			if (extIndex > 0) {
				var ext = fileName.substring(extIndex + 1);
				if (nconf.get('extensions').indexOf(ext) > -1) {
					var playUrl = '/play?path=' + encodeURIComponent(queryPath + '/' + fileName);
					var mediaFile = new MediaFile(fileName, realPath, playUrl);
					initPromises.push(mediaFile.init());
				}
			}
		}
	}
	Promise.all(initPromises).then(function (mediaFiles) {
		dirEntries = dirEntries.concat(mediaFiles);
		res.contentType('application/json');
		res.send(JSON.stringify(dirEntries, null, 4));
	}).catch(function (err) {
		res.status(500);
		res.contentType('text/plain');
		res.send('Failed to get file metadata. See server log.');
	});
}

function getPlay(req, res) {
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
	var realPath = nconf.get('baseDir') + '/' + queryPath;
	var extIndex = realPath.lastIndexOf('.');
	var ext = null;
	if (extIndex > 0) {
		ext = realPath.substring(extIndex + 1);
	}

	// disable for now
	// if (ext != null && ext == 'mp3') {
	if (false) {
		// return requested portion of original file
		console.log('streaming original ' + range + ' : ' + queryPath);

		var fileSize = fs.statSync(realPath).size;
		if (endByte.length == 0) {
			endByte = fileSize - 1;
		} else {
			endByte = Number(endByte);
		}
		endByte = fileSize - 1;

		res.setHeader('Content-Range', 'bytes ' + startByte + '-' + endByte + '/' + fileSize);
		res.setHeader('Content-Length', endByte - startByte + 1);
		res.status(206);

		fs.createReadStream(realPath, { start: startByte, end: endByte }).pipe(res, { end: true });
	} else {
		// convert to mp3 using ffmpeg
		console.log('converting to mp3 ' + range + ' : ' + queryPath);

		var track_index = Number(req.query.track_index);

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
			.audioFilters('volume=replaygain=album')
			.on('start', function () {
				// console.log('ffmpeg processing started: ' + realPath);
			})
			.on('error', function (err) {
				if (!err.toString().includes('Output stream closed')) {
					console.log('ffmpeg processing error: ' + realPath + ' : ' + err.message);
				}
				if (!err.toString().includes('SIGKILL')) {
					// console.log('Killing ffmpeg...');
					command.kill();
				}
			})
			.on('end', function () {
				// console.log('ffmpeg processing finished: ' + realPath);
			})
			.pipe(res, { end: true });
		// // kill ffmpeg after 10 minutes
		// setTimeout(function () {
		// 	console.log('ffmpeg running for 10 minutes. Killing ffmpeg...');
		// 	command.kill();
		// }, 600000);
		res.on('finish', function () {
			// console.log('Play response using ffmpeg finished. Killing ffmpeg...');
			command.kill();
		});
	}


}