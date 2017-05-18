var isSeeking = false;
var playlistIndex = 0;
var fileData = null;
var repeat = false;

$(document).ready(function () {
	// get root browser contents
	browser_bootstrap();
	// hookup progress bar
	$('audio.player').on('timeupdate', function () {
		var currentTime = $('audio.player').get(0).currentTime;
		//var fileData = $('table.playlist tbody tr').eq(playlistIndex).data('file');
		//var duration = fileData.duration;
		var duration = $('audio.player').get(0).duration;
		$('div.progress-bar').width(currentTime / duration * 100 + '%');
		// update time display
		$('div.progress-bar').html(stringifyTime(currentTime));
		$('.currentTime').html(fileData.gain + '&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;' + fileData.format + '&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;' + stringifyTime(currentTime) + ' / ' + stringifyTime(duration) + '&nbsp;');
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
	$('button.previous').click(audioPrevious);
	$('button.play').click(audioPlay);
	$('button.pause').click(audioPause);
	$('button.stop').click(audioStop);
	$('button.next').click(audioNext);
	$('button.repeat').click(audioRepeat);
	// keyboard shortcuts
	$(document).keypress(function (e) {
		var key = String.fromCharCode(e.charCode);
		if (key == 'z') {
			$('button.previous').click();
		} else if (key == 'x') {
			$('button.play').click();
		} else if (key == 'c') {
			$('button.pause').click();
		} else if (key == 'v') {
			$('button.stop').click();
		} else if (key == 'b') {
			$('button.next').click();
		}
	});
});

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
			handleDirContents('div.browser', data);
		}
	});
}

function handleDirContents(parent, dirEntries) {
	var dirs = [];
	var files = [];
	for (var dirEntry of dirEntries) {
		if (dirEntry.type == 'dir') {
			dirs.push(dirEntry);
		} else if (dirEntry.type == 'file') {
			files.push(dirEntry);
		}
	}
	handleDirs(parent, dirs);
	handleFiles(files);
}

function handleDirs(parent, dirs) {
	if (dirs.length > 0) {
		$(parent).append('<ul></ul>');
	}
	for (var dir of dirs) {
		$(parent + ' ul').append('<li><span>' + dir.name + '</span></li>');
		$(parent + ' ul li span').last().data('dirUrl', dir.dirUrl);
		$(parent + ' ul li span').last().click(function () {
			var element = this;
			if ($(element).siblings('ul').length > 0) {
				$(element).siblings('ul').remove();
			} else {
				// reset playlistIndex
				playlistIndex = 0;
				// clear playlist
				$('table.playlist tbody tr').remove();
				// show loading message
				$('.playlist_container').hide();
				$('.loading_message').show();
				// get dir contents
				var dirUrl = $(element).data('dirUrl');
				$.get(dirUrl, function (data, status) {
					if (status == 'success') {
						handleDirContents(OptimalSelect.select(element.parentNode), data);
					}
					// hide loading message
					$('.loading_message').hide();
					$('.playlist_container').show();
				});
			}
			return false;
		});
	}
}

function handleFiles(files) {
	for (var file of files) {
		for (var track of file.tracks) {
			//console.log(JSON.stringify(file, null, 4));
			$('table.playlist tbody').append('<tr></tr>');
			$('table.playlist tbody tr').last().append('<td class="trackNum">' + track.track + '</td>');
			$('table.playlist tbody tr').last().append('<td class="title">' + track.title + '</td>');
			$('table.playlist tbody tr').last().append('<td class="artist">' + track.artist + '</td>');
			$('table.playlist tbody tr').last().append('<td class="album">' + track.album + '</td>');
			$('table.playlist tbody tr').last().append('<td class="duration">' + stringifyTime(track.duration) + '</td>');
			$('table.playlist tbody tr').last().data('file', track);
		}
	}
	$('table.playlist tbody tr').click(function () {
		// stop current song
		audioStop();
		// update playlistIndex
		playlistIndex = $(this).index();
		// play song
		audioPlay();
		return false;
	});
}

function audioStop() {
	$('audio.player').get(0).pause();
	$('audio.player').get(0).currentTime = 0;
	$('div.progress-bar').width('0%');
}

function audioPlay() {
	audioStop();
	fileData = $('table.playlist tbody tr').eq(playlistIndex).data('file');
	// highlight in playlist
	$('table.playlist tbody tr').removeClass('info');
	$('table.playlist tbody tr').eq(playlistIndex).addClass('info');
	$('table.playlist tbody tr').eq(playlistIndex).scrollintoview();
	// change current song label
	$('.currentSong').html('&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;' + fileData.title);
	// load selected song
	$('audio.player').children().remove();
	$('audio.player').append('<source src="' + fileData.playUrl + '" type="audio/mpeg" />');
	$('audio.player').get(0).load();
	// start playback
	$('audio.player').get(0).play();
	$('div.progress-bar').addClass('active');
}

function audioPause() {
	if ($('audio.player').get(0).paused) {
		$('audio.player').get(0).play();
		$('div.progress-bar').addClass('active');
	} else {
		$('audio.player').get(0).pause();
		$('div.progress-bar').removeClass('active');
	}
}

function audioPrevious() {
	audioStop();
	if ($('table.playlist tbody tr').length == 0) {
		playlistIndex = 0;
		return;
	}
	playlistIndex--;
	if (playlistIndex < 0) {
		playlistIndex = $('table.playlist tbody tr').length - 1;
	}
	audioPlay();
}

function audioNext() {
	audioStop();
	if ($('table.playlist tbody tr').length == 0) {
		playlistIndex = 0;
		return;
	}
	playlistIndex++;
	if (playlistIndex > ($('table.playlist tbody tr').length - 1)) {
		playlistIndex = 0;
	}
	audioPlay();
}

function audioRepeat() {
	if (repeat) {
		repeat = false;
		$('button.repeat').removeClass('active');
	} else {
		repeat = true;
		$('button.repeat').addClass('active');
	}
}
