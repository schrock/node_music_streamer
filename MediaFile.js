const DirEntry = require('./DirEntry.js');
const deasync = require('deasync');
const fs = require('fs');
const ffmpeg = require('fluent-ffmpeg');
const ffprobe = deasync(ffmpeg.ffprobe);

module.exports = class MediaFile extends DirEntry {

	constructor(name, path, playUrl) {
		super('file', name, path);
		this.playUrl = playUrl;
		// parse tag metadata
		var metadata = null;
		try {
			metadata = ffprobe(path);
			//console.log(metadata);
			this.trackNum = metadata.format.tags.track;
			if (this.trackNum == null) {
				this.trackNum = '';
			}
			this.title = metadata.format.tags.title;
			if (this.title == null) {
				this.title = name;
			}
			this.artist = metadata.format.tags.artist;
			if (this.artist == null) {
				this.artist = '';
			}
			this.album = metadata.format.tags.album;
			if (this.album == null) {
				this.album = '';
			}
			this.duration = metadata.format.duration;
			if (this.duration == null || typeof this.duration != 'number') {
				this.duration = 1800;
			}
			this.playUrl += '&duration=' + this.duration;
		} catch (err) {
			console.log('Error while reading metadata for ' + path + '\n' + err);
		}
	}

}
