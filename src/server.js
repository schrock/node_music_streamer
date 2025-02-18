'use strict';

const buffer = require('buffer');
const cluster = require('cluster');
const os = require('os');
const express = require('express');
const bodyParser = require('body-parser');
const cookieParser = require('cookie-parser');
const ffmpeg = require('fluent-ffmpeg');
const http = require('http');
const fs = require('fs');
const crypto = require('crypto');

// classes
const DirEntry = require('./DirEntry.js');
const Directory = require('./Directory.js');
const MediaFile = require('./MediaFile.js');

const safePaths = [
	process.env.WEBBASEDIR + '/login.html',
	process.env.WEBBASEDIR + '/login',
	process.env.WEBBASEDIR + '/logout'
];

if (cluster.isMaster) {
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
	var app = express();
	app.use(bodyParser.urlencoded({extended: true}));
	app.use(cookieParser());
	app.use(checkSessionId);
	app.use(function (req, res, next) {
		res.header("Cache-Control", "no-store, no-cache");
		next();
	});
	// timeout of 10 minutes
	const apiTimeout = 10 * 60 * 1000;
	app.use(function (req, res, next) {
		// Set the timeout for all HTTP requests
		req.setTimeout(apiTimeout, function () {
			let err = new Error('Request Timeout');
			err.status = 408;
			next(err);
		});
		// Set the server response timeout for all HTTP requests
		res.setTimeout(apiTimeout, function () {
			let err = new Error('Service Unavailable');
			err.status = 503;
			next(err);
		});
		next();
	});
	app.post(process.env.WEBBASEDIR + '/login', postLogin);
	app.get(process.env.WEBBASEDIR + '/logout', getLogout);
	app.get(process.env.WEBBASEDIR + '/dir', getDir);
	app.get(process.env.WEBBASEDIR + '/play', getPlay);
	app.use(process.env.WEBBASEDIR + '/', express.static('src/www'));
	app.use(process.env.WEBBASEDIR + '/node_modules', express.static('node_modules'));

	var server = http.createServer(app);
	var httpPort = process.env.PORT;
	server.listen(httpPort, function () {
		console.log('worker running on port ' + httpPort + '...');
	});
}

function checkSessionId(req, res, next) {
	if (safePaths.includes(req.path)) {
		next();
	} else {
		// check session id
		var sessionId = req.cookies.musicAppSessionId;
		if (fs.existsSync('session_cache/' + sessionId)) {
			next();
		} else {
			res.status(303);
			res.setHeader('Location', 'login.html');
			res.send('Valid login credentials required for access. Redirecting to login page...');
		}
	}
}

function postLogin(req, res) {
	var username = req.body.username;
	var password = req.body.password;
	var userEntries = fs.readFileSync('conf/users', {encoding: 'utf8', flag: 'r'}).split("\n");
	for (var userEntry of userEntries) {
		if (userEntry.startsWith(username + ":")) {
			var userEntryParts = userEntry.split(':', 3);
			var salt = userEntryParts[1];
			var finalHash = userEntryParts[2];
			var hash = crypto.createHash('sha512').update(password + salt).digest('hex');
			for (let i = 0; i < 1000000; i++) {
				hash = crypto.createHash('sha512').update(hash + password + salt).digest('hex');
			}
			if (hash == finalHash) {
				var sessionId = crypto.randomBytes(32).toString('hex');
				fs.writeFileSync('session_cache/' + sessionId, username, {encoding: 'utf8', flush: true});
				var expires = new Date(new Date().getTime()+1000*60*60*24*365).toGMTString();
				res.setHeader('Set-Cookie', 'musicAppSessionId=' + sessionId + '; Path=' + process.env.WEBBASEDIR + '; Secure; HttpOnly; expires=' + expires);
				res.status(303);
				res.setHeader('Location', 'index.html');
				res.contentType('text/plain');
				res.send('Login successful. Redirecting...');
				return;
			} else {
				// only check first matching username entry
				break;
			}
		}
	}
	res.status(303);
	res.setHeader('Location', 'login.html');
	res.contentType('text/plain');
	res.send('Invalid credentials.');
}

function getLogout(req, res) {
	var sessionId = req.cookies.musicAppSessionId;
	fs.unlinkSync('session_cache/' + sessionId);
	res.setHeader('Set-Cookie', 'musicAppSessionId=' + sessionId + '; Path=' + process.env.WEBBASEDIR + '; Secure; HttpOnly; expires=Thu, 01 Jan 1970 00:00:00 GMT');
	res.status(303);
	res.setHeader('Location', 'login.html');
	res.send('Logged out. Redirecting to login page...');
}

function getDir(req, res) {
	var queryPath = req.query.path;
	if (typeof queryPath === 'undefined') {
		queryPath = '';
	}
	var realPath = process.env.MUSICDIR + '/' + queryPath;

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
		var realPath = process.env.MUSICDIR + '/' + filePath;
		var stat = fs.statSync(realPath);
		if (stat.isDirectory()) {
			var dirUrl = process.env.WEBBASEDIR + '/dir?path=' + encodeURIComponent(queryPath + '/' + fileName);
			dirEntries.push(new Directory(fileName, realPath, dirUrl));
		} else if (stat.isFile()) {
			var extIndex = fileName.lastIndexOf('.');
			if (extIndex > 0) {
				var ext = fileName.substring(extIndex + 1);
				var extensions = process.env.EXTENSIONS.split(':');
				if (extensions.indexOf(ext) > -1) {
					var playUrl = process.env.WEBBASEDIR + '/play?path=' + encodeURIComponent(queryPath + '/' + fileName);
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
	console.log('Play request from ' + req.connection.remoteAddress);

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
	var realPath = process.env.MUSICDIR + '/' + queryPath;
	var extIndex = realPath.lastIndexOf('.');
	var ext = null;
	if (extIndex > 0) {
		ext = realPath.substring(extIndex + 1);
	}

	// return original file if mp3, m4a, ogg, flac
	if (ext != null && (ext == 'mp3' || ext == 'm4a' || ext == 'ogg' || ext == 'flac')) {
		// return requested portion of original file
		console.log('streaming original ' + range + ' : ' + queryPath);

		// var fileSize = fs.statSync(realPath).size;
		// if (endByte.length == 0) {
		// 	endByte = fileSize - 1;
		// } else {
		// 	endByte = Number(endByte);
		// }
		// endByte = fileSize - 1;

		// res.setHeader('Content-Range', 'bytes ' + startByte + '-' + endByte + '/' + fileSize);
		// res.setHeader('Content-Length', endByte - startByte + 1);
		// res.status(206);

		// fs.createReadStream(realPath, { start: startByte, end: endByte }).pipe(res, { end: true });

		res.setHeader('Accept-Ranges', 'bytes');
		switch (ext) {
			case 'm4a':
				res.setHeader('Content-Type', 'audio/mp4');
				break;
			case 'ogg':
				res.setHeader('Content-Type', 'audio/ogg');
				break;
			case 'flac':
				res.setHeader('Content-Type', 'audio/flac');
				break;
			default:
				res.setHeader('Content-Type', 'audio/mpeg');
		}

		res.sendFile(realPath);
	} else {
		// convert to mp3 using ffmpeg
		console.log('converting to mp3 ' + range + ' : ' + queryPath);

		var track_index = Number(req.query.track_index);

		var duration = req.query.duration;
		var fileSize = Math.floor(duration * (Number(process.env.BITRATE) * 1000 / 8));
		if (endByte.length == 0) {
			endByte = fileSize - 1;
		} else {
			endByte = Number(endByte);
		}
		// console.log('startByte: ' + startByte);
		// console.log('endByte:   ' + endByte);
		res.setHeader('Accept-Ranges', 'bytes');
		res.setHeader('Content-Type', 'audio/mpeg');
		res.setHeader('Content-Range', 'bytes ' + startByte + '-' + endByte + '/' + fileSize);
		res.setHeader('Content-Length', endByte - startByte + 1);
		res.status(206);

		var startTime = 0;
		if (startByte > 0) {
			startTime = startByte / (Number(process.env.BITRATE) * 1000 / 8);
		}
		var endTime = endByte / (Number(process.env.BITRATE) * 1000 / 8);
		// console.log('startTime: ' + startTime);
		// console.log('endTime:   ' + endTime);

		// For SPCs, copy file and modify duration in id666 header,
		// which is 3 bytes at position 0xa9.
		if (ext != null && ext == 'spc') {
			var copyPath = os.tmpdir() + '/' + realPath.substring(realPath.lastIndexOf('/') + 1);
			fs.copyFileSync(realPath, copyPath);
			realPath = copyPath;
			console.log('spc copy location: ' + realPath);
			var durationBuffer = buffer.Buffer.alloc(3);
			durationBuffer.writeUInt16LE(duration, 0);
			var fd = fs.openSync(realPath, 'r+');
			fs.writeSync(fd, durationBuffer, 0, durationBuffer.byteLength, 0xa9);
			fs.closeSync(fd);
		}

		var command = ffmpeg(realPath);
		if (track_index > 0) {
			command.inputOptions('-track_index ' + track_index);
		}
		command.audioCodec('libmp3lame').audioChannels(2)
			.audioFrequency(44100).audioBitrate(Number(process.env.BITRATE)).format('mp3').noVideo()
			.seek(startTime).duration(endTime - startTime)
			.audioFilters('volume=replaygain=track')
			.on('start', function () {
				// console.log('ffmpeg processing started: ' + queryPath);
			})
			.on('error', function (err) {
				if (!err.toString().includes('Output stream closed')) {
					console.log('ffmpeg processing error: ' + queryPath + ' : ' + err.message);
				}
				if (!err.toString().includes('SIGKILL')) {
					console.log('Killing ffmpeg for ' + queryPath);
					command.kill();
				}
			})
			.on('end', function () {
				// console.log('ffmpeg processing finished: ' + queryPath);
			})
			.pipe(res, { end: true });
		// // kill ffmpeg after 10 minutes
		// setTimeout(function () {
		// 	console.log('ffmpeg running for 10 minutes. Killing ffmpeg...');
		// 	command.kill();
		// }, 600000);
		res.on('finish', function () {
			console.log('Play response using ffmpeg finished. Killing ffmpeg for ' + queryPath);
			command.kill();
		});
		res.on('close', function () {
			console.log('Play response using ffmpeg closed. Killing ffmpeg for ' + queryPath);
			command.kill();
		});
	}
}
