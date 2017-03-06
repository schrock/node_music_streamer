const DirEntry = require('./DirEntry.js');
const sync = require('synchronize')
const fs = require('fs');
const util = require('util');
const mm = require('music-metadata');

module.exports = class MediaFile extends DirEntry {

	constructor(name, path, playUrl) {
		super('file', name, path);
		this.playUrl = playUrl;

		sync(mm, 'parseStream');
		sync.fiber(function () {
			var stream = fs.createReadStream(path);
			var metadata = sync.await(mm.parseStream(stream, { native: true }));
			stream.close();
			console.log(metadata);
		});
	}

}
