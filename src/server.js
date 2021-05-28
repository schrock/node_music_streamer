'use strict';

// configuration
const nconf = require('nconf');
nconf.argv();
nconf.defaults({
	"musicDir": process.env.HOME + "/music",
	"bitrate": 256,
	"extensions": ["mp3", "m4a", "flac", "ogg", "ay", "gbs", "gym", "hes", "kss", "nsf", "nsfe", "sap", "spc", "vgm"],
	"httpsCertFile": "./localhost.cert",
	"httpsKeyFile": "./localhost.key",
	"ips": [
		'::1',
		'::ffff:127.0.0.1',
		'::ffff:192.168.1.0/24',
		'::ffff:128.149.0.0/16',
		'::ffff:137.79.0.0/16',
		['::ffff:174.192.0.0', '::ffff:174.255.255.255']
	]
});

// 3rd party
const cluster = require('cluster');
const os = require('os');
const express = require('express');
const http = require('http');
const https = require('https');
const fs = require('fs');

// classes
const Worker = require('./Worker.js');

var httpPort = 8080;
var httpsPort = 8443;

if (cluster.isMaster) {
	console.log('argv: ' + process.argv);
	console.log('musicDir: ' + JSON.stringify(nconf.get('musicDir'), null, 4));
	console.log('bitrate: ' + JSON.stringify(nconf.get('bitrate'), null, 4));
	console.log('extensions: ' + JSON.stringify(nconf.get('extensions'), null, 4));
	console.log('httpsCertFile: ' + JSON.stringify(nconf.get('httpsCertFile'), null, 4));
	console.log('httpsKeyFile: ' + JSON.stringify(nconf.get('httpsKeyFile'), null, 4));

	var numCPUs = os.cpus().length;
	for (var i = 0; i < numCPUs; i++) {
		// Create a worker
		cluster.fork();
	}

	cluster.on('exit', function (worker, code, signal) {
		console.log('Worker %d died with code/signal %s. Restarting worker...', worker.process.pid, signal || code);
		cluster.fork();
	});

	// create http server for redirection to https
	var app = express();
	app.use(function (req, res, next) {
		var host = req.headers.host.replace(/:\d+$/, '');
		var newUrl = "https://" + host + ":" + httpsPort + req.url;
		console.log("redirecting to " + newUrl);
		res.redirect(newUrl);
	});
	var server = http.createServer(app);
	server.listen(httpPort, function () {
		console.log('http redirection running on port ' + httpPort + '...');
	});
} else {
	// setup server
	var worker = new Worker(nconf);
	var options = {
		key: fs.readFileSync(nconf.get('httpsKeyFile')),
		cert: fs.readFileSync(nconf.get('httpsCertFile')),
		requestCert: false,
		rejectUnauthorized: false
	};
	var server = https.createServer(options, worker.getApp());
	server.listen(httpsPort, function () {
		console.log('worker running on port ' + httpsPort + '...');
	});
	// let worker code handle timeouts
	server.timeout = 0;
}
