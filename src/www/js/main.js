var playlist = [];
var playlistIndex = 0;

var isSeeking = false;
var repeat = false;

var analyser;
var bufferLength;
var dataArray;

$(document).ready(function () {
	// get root browser contents
	browser_bootstrap();
	// hookup progress bar
	$('audio.player').on('timeupdate', function () {
		var currentTime = $('audio.player').get(0).currentTime;
		var duration = $('audio.player').get(0).duration;
		$('div.progress-bar').width(currentTime / duration * 100 + '%');
		// update time display
		$('div.progress-bar').html(stringifyTime(currentTime));
		$('.currentTime').html(playlist[playlistIndex].replaygainAlbum + '&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;' + playlist[playlistIndex].format + '&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;' + stringifyTime(currentTime) + ' / ' + stringifyTime(duration) + '&nbsp;');
	});
	$('div.progress').click(function (e) {
		isSeeking = true;
		var duration = $('audio.player').get(0).duration;
		if (duration > 0) {
			var selectedX = e.pageX - $(this).offset().left;
			var maxX = $(this).width();
			var targetTimeFraction = selectedX / maxX;
			var targetTime = duration * targetTimeFraction;
			$('audio.player').get(0).currentTime = targetTime;
		}
		return false;
	});
	// automatic track change at end of current song
	$('audio.player').on('ended', function () {
		if (repeat) {
			audioPlay();
		} else {
			audioNext();
		}
	});
	// automatic track change due to inaccurate duration calculation 
	$('audio.player').on('play playing', function () {
		isSeeking = false;
	});
	$('audio.player').on('waiting', function () {
		var currentTime = $('audio.player').get(0).currentTime;
		if (currentTime > 0 && !isSeeking) {
			if (repeat) {
				audioPlay();
			} else {
				audioNext();
			}
		}
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
			$('button.previous').click();
			return false;
		} else if (key == 'x') {
			$('button.play').click();
			return false;
		} else if (key == 'c') {
			$('button.pause').click();
			return false;
		} else if (key == 'v') {
			$('button.stop').click();
			return false;
		} else if (key == 'b') {
			$('button.next').click();
			return false;
		} else if (key == 'ArrowLeft') {
			audioSeekBackwards(5);
			return false;
		} else if (key == 'ArrowRight') {
			audioSeekForwards(5);
			return false;
		}
	});

	// Web Audio API stuff
	var audioCtx = new (window.AudioContext || window.webkitAudioContext)();
	var myAudio = document.querySelector('audio.player');
	var source = audioCtx.createMediaElementSource(myAudio);
	analyser = audioCtx.createAnalyser();
	analyser.fftSize = 2048;
	bufferLength = analyser.frequencyBinCount;
	dataArray = new Uint8Array(bufferLength);
	source.connect(analyser);
	analyser.connect(audioCtx.destination);
	drawWaveform();
});

function drawWaveform() {
	// draw at browser request/refresh rate
	drawVisual = requestAnimationFrame(drawWaveform);

	var canvas = document.querySelector('canvas.waveform');
	var canvasCtx = canvas.getContext('2d');

	// make internal width and height match css width and height
	var canvasStyle = window.getComputedStyle(canvas);
	canvas.width = canvasStyle.width.substring(0, canvasStyle.width.indexOf('px'));
	canvas.height = canvasStyle.height.substring(0, canvasStyle.height.indexOf('px'));

	// clear canvas
	canvasCtx.fillStyle = window.getComputedStyle(document.body).backgroundColor;
	canvasCtx.fillRect(0, 0, canvas.width, canvas.height);

	// copy current audio frequency data into array
	analyser.getByteTimeDomainData(dataArray);

	// draw waveform
	canvasCtx.lineWidth = 1;
	canvasCtx.strokeStyle = window.getComputedStyle(document.body).color;
	canvasCtx.beginPath();
	var sliceWidth = canvas.width * 1.0 / bufferLength;
	var x = 0;
	for (var i = 0; i < bufferLength; i++) {
		var v = dataArray[i] / 128.0;
		var y = v * canvas.height / 2;
		if (i === 0) {
			canvasCtx.moveTo(x, y);
		} else {
			canvasCtx.lineTo(x, y);
		}
		x += sliceWidth;
	}
	canvasCtx.lineTo(canvas.width, canvas.height / 2);
	canvasCtx.stroke();
}

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

function browser_bootstrap() {
	$.get('/dir?path=', function (data, status) {
		if (status == 'success') {
			handleDirContents(null, data);
		}
	});
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
		$('.currentDir').html('/');
	} else {
		$('.currentDir').html(currentDir.name);
	}

	// clear browser contents
	$('.browser').empty();

	// place dirs first in browser
	for (var dir of dirs) {
		$('.browser').append('<div class="row dir"></div>');
		$('.browser .dir').last().append('<div class="col">' + dir.name + '</div>');
		$('.browser .dir').last().data('dir', dir);
	}
	$('.browser .dir').click(function () {
		var dir = $(this).data('dir');
		//console.log('clicked dir ' + JSON.stringify(dir));
		// show loading message
		$('.browser').hide();
		$('.loading_message').show();
		$.get(dir.dirUrl, function (data, status) {
			if (status == 'success') {
				handleDirContents(dir, data);
			}
			// hide loading message
			$('.loading_message').hide();
			$('.browser').show();
		});
		return false;
	});

	// place files after dirs in browser
	for (var file of files) {
		for (var track of file.tracks) {
			$('.browser').append('<div class="row track"></div>');
			$('.browser .track').last().append('<div class="col-1">' + track.track + '</div>');
			$('.browser .track').last().append('<div class="col-10">' + track.title + '</div>');
			$('.browser .track').last().append('<div class="col-1">' + stringifyTime(track.duration) + '</div>');
			$('.browser .track').last().data('track', track);
		}
	}
	$('.browser .track').click(function () {
		var track = $(this).data('track');
		//console.log('clicked track ' + JSON.stringify(track));
		playlist = [];
		playlistIndex = 0;
		$('.browser .track').each(function (index) {
			var t = $(this).data('track');
			playlist.push(t);
			if (track === t) {
				playlistIndex = index;
			}
		});
		audioPlay();
		return false;
	});
}

function upDir() {

}

function audioStop() {
	$('audio.player').get(0).pause();
	$('audio.player').get(0).currentTime = 0;
	$('div.progress-bar').removeClass('progress-bar-animated');
	$('div.progress-bar').width('0%');
}

function audioPlay() {
	audioStop();
	var track = playlist[playlistIndex];
	// highlight in playlist
	$('.browser .track').removeClass('bg-primary');
	$('.browser .track').each(function () {
		var t = $(this).data('track');
		if (track === t) {
			$(this).addClass('bg-primary');
			$(this).scrollintoview();
		}
	});
	// change current song label
	$('.currentSong').html(track.title);
	// load song
	$('audio.player').empty();
	$('audio.player').append('<source src="' + track.playUrl + '" type="audio/mpeg" />');
	$('audio.player').get(0).load();
	// start playback
	$('audio.player').get(0).play();
	$('div.progress-bar').addClass('progress-bar-animated');
}

function audioPause() {
	if ($('audio.player').get(0).paused) {
		$('audio.player').get(0).play();
		$('div.progress-bar').addClass('progress-bar-animated');
	} else {
		$('audio.player').get(0).pause();
		$('div.progress-bar').removeClass('progress-bar-animated');
	}
}

function audioSeekBackwards(seconds) {
	if (!$('audio.player').get(0).paused) {
		isSeeking = true;
		$('audio.player').get(0).currentTime -= seconds;
	}
}

function audioSeekForwards(seconds) {
	if (!$('audio.player').get(0).paused) {
		isSeeking = true;
		$('audio.player').get(0).currentTime += seconds;
	}
}

function audioPrevious() {
	audioStop();
	if (playlist.length == 0) {
		return;
	}
	playlistIndex--;
	if (playlistIndex < 0) {
		playlistIndex = playlist.length - 1;
	}
	audioPlay();
}

function audioNext() {
	audioStop();
	if (playlist.length == 0) {
		return;
	}
	playlistIndex++;
	if (playlistIndex > (playlist.length - 1)) {
		playlistIndex = 0;
	}
	audioPlay();
}

function audioRepeat() {
	if (repeat) {
		repeat = false;
		$('button.repeat').removeClass('active');
		// $('button.repeat').css('filter', 'invert(0%)');
	} else {
		repeat = true;
		$('button.repeat').addClass('active');
		// $('button.repeat').css('filter', 'invert(100%)');
	}
}
