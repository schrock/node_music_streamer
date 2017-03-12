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
		this.format = '';
		this.track = '';
		this.title = name;
		this.artist = '';
		this.album = '';
		this.duration = null;
		try {
			var metadata = ffprobe(path);
			// console.log(metadata);
			this.format= metadata.format.format_name;
			var tags = metadata.format.tags;
			if (tags != null) {
				// track
				if (tags.track != null) {
					this.track = tags.track;
				}
				if (tags.TRACK != null) {
					this.track = tags.TRACK;
				}
				// title
				if (tags.title != null) {
					this.title = tags.title;
				}
				if (tags.TITLE != null) {
					this.title = tags.TITLE;
				}
				if (tags.song != null) {
					this.title = tags.song;
				}
				// artist
				if (tags.artist != null) {
					this.artist = tags.artist;
				}
				if (tags.ARTIST != null) {
					this.artist = tags.ARTIST;
				}
				if (tags.author != null) {
					this.artist = tags.author;
				}
				// album
				if (tags.album != null) {
					this.album = tags.album;
				}
				if (tags.ALBUM != null) {
					this.album = tags.ALBUM;
				}
				if (tags.game != null) {
					this.album = tags.game;
				}
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
