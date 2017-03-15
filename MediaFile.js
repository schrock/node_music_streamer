const DirEntry = require('./DirEntry.js');
const deasync = require('deasync');
const fs = require('fs');
const ffmpeg = require('fluent-ffmpeg');
const ffprobe = deasync(ffmpeg.ffprobe);

module.exports = class MediaFile extends DirEntry {

	constructor(name, path, playUrl) {
		super('file', name, path);
		var playUrl = playUrl;
		// parse tag metadata
		var format = '';
		var tracks = 1;
		var track = '';
		var title = name;
		var artist = '';
		var album = '';
		var duration = 1200;
		try {
			var metadata = ffprobe(path);
			// console.log(metadata);
			format = metadata.format.format_name;
			var tags = metadata.format.tags;
			if (tags != null) {
				// tracks
				if (tags.tracks != null) {
					tracks = tags.tracks;
				}
				// track
				if (tags.track != null) {
					track = tags.track;
				}
				if (tags.TRACK != null) {
					track = tags.TRACK;
				}
				var slashIndex = track.indexOf('/');
				if (slashIndex > 0) {
					track = track.substring(0, slashIndex);
				}
				// title
				if (tags.title != null) {
					title = tags.title;
				}
				if (tags.TITLE != null) {
					title = tags.TITLE;
				}
				if (tags.song != null) {
					title = tags.song;
				}
				// artist
				if (tags.artist != null) {
					artist = tags.artist;
				}
				if (tags.ARTIST != null) {
					artist = tags.ARTIST;
				}
				if (tags.author != null) {
					artist = tags.author;
				}
				// album
				if (tags.album != null) {
					album = tags.album;
				}
				if (tags.ALBUM != null) {
					album = tags.ALBUM;
				}
				if (tags.game != null) {
					album = tags.game;
				}
				// duration
				if (metadata.format.duration != null && typeof metadata.format.duration == 'number') {
					duration = metadata.format.duration;
				}
			}
			playUrl += '&duration=' + duration;
		} catch (err) {
			console.log('Error while reading metadata for ' + path + '\n' + err);
		}

		this.tracks = [];
		for (var i = 0; i < tracks; i++) {
			var details = {};
			details.playUrl = playUrl + '&track_index=' + i;
			details.format = format;
			if (track == '') {
				details.track = i + 1;
			} else {
				details.track = track;
			}
			details.title = title;
			details.artist = artist;
			details.album = album;
			details.duration = duration;
			this.tracks.push(details);
		}
	}

}
