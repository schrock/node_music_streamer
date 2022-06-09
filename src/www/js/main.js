// const { Gapless5 } = require("@regosen/gapless-5");
var player = null;
var playerPaused = true;

var playlist = [];
var playlistDirty = true;

var dirStack = [];

var wakeLockEnabled = false;
var noSleep = new NoSleep();

var repeat = false;

// var audioCtx;
// var analyser;
// var bufferLength;
// var dataArray;

$(document).ready(function () {
	// get root browser contents
	upDir();

	// hookup progress bar
	setInterval(function () {
		if (player !== null) {
			var currentTime = player.getPosition() / 1000;
			//var duration = $('audio.player').get(0).duration;
			var track = playlist[getPlaylistIndex()];
			if (track !== undefined) {
				var duration = track.duration;
				$('div.progress-bar').width(currentTime / duration * 100 + '%');
				// update time display
				$('div.progress-bar').html('<div>' + stringifyTime(currentTime) + '</div>');
				$('.currentTime').html(stringifyTime(currentTime) + '&nbsp;/&nbsp;' + stringifyTime(duration));
				$('.currentInfo').html(playlist[getPlaylistIndex()].replaygainAlbum + '&nbsp;' + playlist[getPlaylistIndex()].format);
			}
		}
	}, 500);
	$('div.progress').click(function (e) {
		var duration = player.getPosition() / 1000;
		var track = playlist[getPlaylistIndex()];
		var duration = track.duration;
		if (duration > 0) {
			var selectedX = e.pageX - $(this).offset().left;
			var maxX = $(this).width();
			var targetTimeFraction = selectedX / maxX;
			var targetTime = duration * targetTimeFraction;
			player.setPosition(targetTime * 1000);
		}
		return false;
	});

	// hookup audio player buttons
	$('button.upDir').click(upDir);
	$('button.previous').click(audioPrevious);
	$('button.play').click(audioPlay);
	$('button.pause').click(audioPause);
	$('button.stop').click(audioStop);
	$('button.next').click(audioNext);
	$('button.repeat').click(audioRepeat);
	// keyboard shortcuts
	$(document).keydown(function (e) {
		var key = e.key;
		if (key == 'z') {
			audioPrevious();
			return false;
		} else if (key == 'x') {
			audioPlay();
			return false;
		} else if (key == 'c') {
			audioPause();
			return false;
		} else if (key == 'v') {
			audioStop();
			return false;
		} else if (key == 'b') {
			audioNext();
			return false;
		} else if (key == 'ArrowLeft') {
			audioSeekBackwards(5);
			return false;
		} else if (key == 'ArrowRight') {
			audioSeekForwards(5);
			return false;
		}
	});

	// // Web Audio API stuff
	// audioCtx = new (window.AudioContext || window.webkitAudioContext)();
	// var myAudio = document.querySelector('audio.player');
	// var source = audioCtx.createMediaElementSource(myAudio);
	// analyser = audioCtx.createAnalyser();
	// analyser.fftSize = 2048;
	// bufferLength = analyser.frequencyBinCount;
	// dataArray = new Uint8Array(bufferLength);
	// source.connect(analyser);
	// analyser.connect(audioCtx.destination);
	// drawWaveform();
	// drawBuffered();
});

// function drawWaveform() {
// 	// draw at browser request/refresh rate
// 	drawVisual = requestAnimationFrame(drawWaveform);

// 	var canvas = document.querySelector('canvas.waveform');
// 	var canvasCtx = canvas.getContext('2d');

// 	// make internal width and height match css width and height
// 	var canvasStyle = window.getComputedStyle(canvas);
// 	canvas.width = canvasStyle.width.substring(0, canvasStyle.width.indexOf('px'));
// 	canvas.height = canvasStyle.height.substring(0, canvasStyle.height.indexOf('px'));

// 	// clear canvas
// 	canvasCtx.fillStyle = window.getComputedStyle(document.body).backgroundColor;
// 	canvasCtx.fillRect(0, 0, canvas.width, canvas.height);

// 	// copy current audio frequency data into array
// 	analyser.getByteTimeDomainData(dataArray);

// 	// draw waveform
// 	canvasCtx.lineWidth = 1;
// 	canvasCtx.strokeStyle = window.getComputedStyle(document.body).color;
// 	canvasCtx.beginPath();
// 	var sliceWidth = canvas.width * 1.0 / bufferLength;
// 	var x = 0;
// 	for (var i = 0; i < bufferLength; i++) {
// 		var v = dataArray[i] / 128.0;
// 		var y = v * canvas.height / 2;
// 		if (i === 0) {
// 			canvasCtx.moveTo(x, y);
// 		} else {
// 			canvasCtx.lineTo(x, y);
// 		}
// 		x += sliceWidth;
// 	}
// 	canvasCtx.lineTo(canvas.width, canvas.height / 2);
// 	canvasCtx.stroke();
// }

// function drawBuffered() {
// 	// draw at browser request/refresh rate
// 	drawVisual = requestAnimationFrame(drawBuffered);

// 	var canvas = document.querySelector('canvas.buffered');
// 	var canvasCtx = canvas.getContext('2d');

// 	// make internal width and height match css width and height
// 	var canvasStyle = window.getComputedStyle(canvas);
// 	canvas.width = canvasStyle.width.substring(0, canvasStyle.width.indexOf('px'));
// 	canvas.height = canvasStyle.height.substring(0, canvasStyle.height.indexOf('px'));

// 	// clear canvas
// 	canvasCtx.fillStyle = window.getComputedStyle(document.body).backgroundColor;
// 	canvasCtx.fillRect(0, 0, canvas.width, canvas.height);

// 	// draw buffered areas
// 	var myAudio = $('audio.player')[0];
// 	var inc = canvas.width / myAudio.duration;
// 	for (i = 0; i < myAudio.buffered.length; i++) {
// 		var startX = myAudio.buffered.start(i) * inc;
// 		var endX = myAudio.buffered.end(i) * inc;
// 		canvasCtx.fillStyle = window.getComputedStyle(document.body).color;
// 		canvasCtx.fillRect(startX, 0, endX - startX, canvas.height);
// 	}
// }

function stringifyTime(time) {
	var minutes = Math.floor(time / 60);
	var seconds = Math.floor(time % 60);
	if (seconds < 10) {
		seconds = '0' + seconds;
	}

	if (isNaN(minutes) || isNaN(seconds)) {
		return '0:00';
	} else {
		return minutes + ':' + seconds;
	}
}

function upDir() {
	// show loading message
	$('.browser').hide();
	$('.loading_message').show();

	playlistDirty = true;

	dirStack.pop();
	if (dirStack.length == 0) {
		$.get('/dir?path=', function (data, status) {
			if (status == 'success') {
				handleDirContents(null, data);
				// hide loading message
				$('.loading_message').hide();
				$('.browser').show();
			}
		});
	} else {
		var dir = dirStack[dirStack.length - 1];
		$.get(dir.dirUrl, function (data, status) {
			if (status == 'success') {
				handleDirContents(dir, data);
				// hide loading message
				$('.loading_message').hide();
				$('.browser').show();
			}
		});
	}
}

function handleDirContents(currentDir, dirEntries) {
	var dirs = [];
	var files = [];
	for (var dirEntry of dirEntries) {
		if (dirEntry.type == 'dir') {
			dirs.push(dirEntry);
		} else if (dirEntry.type == 'file') {
			files.push(dirEntry);
		}
	}

	// update go up directory functionality
	if (currentDir == null) {
		$('.currentDir').empty();
	} else {
		$('.currentDir').html(currentDir.name);
	}

	// clear browser contents
	$('.browser').empty();

	// place dirs first in browser
	for (var dir of dirs) {
		// skip folders containing album art scans
		if (dir.name.toLowerCase() == 'scans') {
			continue;
		}
		$('.browser').append('<div class="row border-top dir"></div>');
		$('.browser .dir').last().append('<div class="col-12 no-overflow no-gutters"><span class="oi oi-folder"></span>&nbsp;&nbsp;&nbsp;' + dir.name + '</div>');
		$('.browser .dir').last().data('dir', dir);
	}
	$('.browser .dir').click(function () {
		var dir = $(this).data('dir');
		//console.log('clicked dir ' + JSON.stringify(dir));
		// show loading message
		$('.browser').hide();
		$('.loading_message').show();
		playlistDirty = true;
		$.get(dir.dirUrl, function (data, status) {
			if (status == 'success') {
				dirStack.push(dir);
				handleDirContents(dir, data);
				// hide loading message
				$('.loading_message').hide();
				$('.browser').show();
			}
		});
		return false;
	});

	// place files after dirs in browser
	for (var file of files) {
		for (var track of file.tracks) {
			var trackNumber = track.track + '';
			if (trackNumber.length == 1) {
				trackNumber = '0' + trackNumber;
			}
			$('.browser').append('<div class="row border-top track"></div>');
			$('.browser .track').last().append('<div class="col-12 col-md-8 no-overflow no-gutters">' + trackNumber + '&nbsp;&nbsp;&nbsp;' + track.title + '</div>');
			$('.browser .track').last().append('<div class="col-3 d-none d-md-block no-overflow">' + track.artist + '</div>');
			$('.browser .track').last().append('<div class="col-1 d-none d-md-block text-right">' + stringifyTime(track.duration) + '</div>');
			$('.browser .track').last().data('track', track);
		}
	}
	$('.browser .track').click(function () {
		// // fix suspended AudioContext on Chrome
		// audioCtx.resume();
		// try to prevent browser sleep
		if (wakeLockEnabled == false) {
			wakeLockEnabled = true;
			// disable on desktop due to high CPU usage
			if (screen.width < 768) {
				noSleep.enable();
				console.log("noSleep enabled");
			}
		}

		var track = $(this).data('track');
		if (playlistDirty) {
			//console.log('clicked track ' + JSON.stringify(track));
			playlist = [];
			var trackUrls = [];
			var playlistIndex = 0;
			$('.browser .track').each(function (index) {
				var t = $(this).data('track');
				playlist.push(t);
				trackUrls.push(t.playUrl);
				if (track === t) {
					playlistIndex = index;
				}
			});
			playlistDirty = false;
			initializePlayer(trackUrls, playlistIndex);
			audioPlay();
		} else {
			player.gotoTrack(track.playUrl);
			audioPlay();
		}

		return false;
	});
}

function initializePlayer(tracks, position) {
	if (player !== null) {
		audioStop();
		player.removeAllTracks();
		player = null;
	}
	console.log('position: ' + position);
	player = new Gapless5({ useWebAudio: false, loop: true, loadLimit: 2, tracks: tracks, startingTrack: position });
	// setup player callbacks
	player.onplay = function () {
		playerPaused = false;
		updateSongInfo();
		$('button.pause').html('<span class="oi oi-media-pause"></span>');
		$('div.progress-bar').addClass('progress-bar-animated');
	}
	player.onpause = function () {
		playerPaused = true;
		$('button.pause').html('<span class="oi oi-media-play"></span>');
		$('div.progress-bar').removeClass('progress-bar-animated');
	}
	player.onstop = function () {
		playerPaused = true;
		$('button.pause').html('<span class="oi oi-media-play"></span>');
		$('div.progress-bar').removeClass('progress-bar-animated');
	}
	player.onnext = function (from_track, to_track) {
		if (repeat) {
			player.gotoTrack(from_track);
			player.cue();
		}
	}
}

function revealElement(element) {
	var headerRect = $('div.sticky-top')[0].getBoundingClientRect();
	var elementRect = element.getBoundingClientRect();
	if (elementRect.top < headerRect.bottom || elementRect.bottom > window.innerHeight) {
		element.scrollIntoView(false);
	}
}

function updateSongInfo() {
	var track = playlist[getPlaylistIndex()];
	// highlight in playlist
	$('.browser .track').removeClass('bg-primary');
	$('.browser .track').each(function () {
		var t = $(this).data('track');
		if (track === t) {
			$(this).addClass('bg-primary');
			revealElement($(this)[0]);
		}
	});
	// change current song information labels
	document.title = track.title;
	$('.currentSong').html(track.title);
	$('.currentArtist').html(track.artist);
}

function audioStop() {
	player.stop();
	player.setPosition(0);
}

function audioPlay() {
	player.cue();
}

function audioPause() {
	if (playerPaused) {
		player.play();
	} else {
		player.pause();
	}
}

function audioSeekBackwards(seconds) {
	if (!playerPaused) {
		var position = player.getPosition();
		position -= 1000 * seconds;
		player.setPosition(position);
	}
}

function audioSeekForwards(seconds) {
	if (!playerPaused) {
		var position = player.getPosition();
		position += 1000 * seconds;
		player.setPosition(position);
	}
}

function audioPrevious() {
	player.prevtrack();
	player.cue();
}

function audioNext() {
	player.next();
	player.cue();
}

function audioRepeat() {
	if (repeat) {
		repeat = false;
		$('button.repeat').css('filter', 'invert(0%)');
	} else {
		repeat = true;
		$('button.repeat').css('filter', 'invert(100%)');
	}
}

function getPlaylistIndex() {
	return player.getIndex();
}