const DirEntry = require('./DirEntry.js');
const deasync = require('deasync');
const fs = require('fs');
const mm = require('music-metadata');
const parseStream = deasync(mm.parseStream);

module.exports = class MediaFile extends DirEntry {

	constructor(name, path, playUrl) {
		super('file', name, path);
		this.playUrl = playUrl;
		// parse tag metadata
		var stream = fs.createReadStream(path);
		var metadata = null;
		try {
			metadata = parseStream(stream, { native: true });
			//console.log(metadata);
			this.trackNum = metadata.common.track.no;
			this.title = metadata.common.title;
			this.artist = metadata.common.artist;
			this.album = metadata.common.album;
			this.duration = metadata.format.duration;
		} finally {
			stream.close();
		}
	}

}
