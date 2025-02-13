'use strict';

// 3rd party
const fs = require('fs');
const crypto = require('crypto');
const readlineSync = require('readline-sync');

var username = readlineSync.question('Enter username: ');
username = username.trim();
if (username.length == 0 || username.includes(':')) {
	console.log('Bad username format.');
	return;
}
var password = readlineSync.question('Enter password: ', {hideEchoBack: true});
if (password.length < 8) {
	console.log('Bad password format.');
	return;
}
var salt = crypto.randomBytes(32).toString('hex');
var hash = crypto.createHash('sha512').update(password + salt).digest('hex');
for (let i = 0; i < 1000000; i++) {
	hash = crypto.createHash('sha512').update(hash + password + salt).digest('hex');
}
var entry = username + ':' + salt + ':' + hash + "\n";
fs.appendFileSync('conf/users', entry, {encoding: 'utf8', flush: true});
