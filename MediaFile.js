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
			if (this.trackNum == null) {
				this.trackNum = '';
			}
			this.title = metadata.common.title;
			if (this.title == null) {
				this.title = name;
			}
			this.artist = metadata.common.artist;
			if (this.artist == null) {
				this.artist = '';
			}
			this.album = metadata.common.album;
			if (this.album == null) {
				this.album = '';
			}
			this.duration = metadata.format.duration;
			this.playUrl += '&duration=' + this.duration;
		} finally {
			stream.close();
		}
	}

}
