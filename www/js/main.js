var isSeeking = false;
var playlistIndex = 0;
var fileData = null;

$(document).ready(function () {
	// hide loading message by default
	//$('div.loading_message').hide();
	// get root browser contents
	browser_bootstrap();
	// hookup progress bar
	$('audio.player').on('timeupdate', function () {
		var currentTime = $('audio.player').get(0).currentTime;
		//var fileData = $('table.playlist tr.data').eq(playlistIndex).data('file');
		//var duration = fileData.duration;
		var duration = $('audio.player').get(0).duration;
		$('div.progress').stop(true, true).animate({ 'width': currentTime / duration * 100 + '%' }, 250, 'linear');
		// update time display
		$('span.time').html(fileData.format + '&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;' + stringifyTime(currentTime) + ' / ' + stringifyTime(duration));
	});
	$('div.progress_range').click(function (e) {
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
		audioNext();
	});
	// automatic track change due to inaccurate duration calculation 
	$('audio.player').on('play playing', function () {
		isSeeking = false;
	});
	$('audio.player').on('waiting', function () {
		var currentTime = $('audio.player').get(0).currentTime;
		if (currentTime > 0 && !isSeeking) {
			audioNext();
		}
	});
	// hookup audio player buttons
	$('button.previous').click(audioPrevious);
	$('button.play').click(audioPlay);
	$('button.pause').click(audioPause);
	$('button.stop').click(audioStop);
	$('button.next').click(audioNext);
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
				$('table.playlist tr.data').remove();
				// show loading message
				$('div.playlist').hide();
				$('div.loading_message').show();
				// get dir contents
				var dirUrl = $(element).data('dirUrl');
				$.get(dirUrl, function (data, status) {
					if (status == 'success') {
						handleDirContents(OptimalSelect.select(element.parentNode), data);
					}
					// hide loading message
					$('div.loading_message').hide();
					$('div.playlist').show();
				});
			}
			return false;
		});
	}
	$('li span').hover(
		function () {
			$(this).addClass('hover');
		}, function () {
			$(this).removeClass('hover');
		}
	);
}

function handleFiles(files) {
	for (var file of files) {
		for (var track of file.tracks) {
			//console.log(JSON.stringify(file, null, 4));
			$('table.playlist').append('<tr class="data"></tr>');
			$('table.playlist tr.data').last().append('<td>' + track.track + '</td>');
			$('table.playlist tr.data').last().append('<td>' + track.title + '</td>');
			$('table.playlist tr.data').last().append('<td>' + track.artist + '</td>');
			$('table.playlist tr.data').last().append('<td>' + track.album + '</td>');
			$('table.playlist tr.data').last().append('<td>' + stringifyTime(track.duration) + '</td>');
			$('table.playlist tr.data').last().data('file', track);
		}
	}
	$('table.playlist tr.data').click(function () {
		// stop current song
		audioStop();
		// update playlistIndex
		playlistIndex = $(this).index() - 1;
		// play song
		audioPlay();
		return false;
	});
	$('table.playlist tr.data').hover(
		function () {
			$(this).addClass('hover');
		}, function () {
			$(this).removeClass('hover');
		}
	);
}

function audioStop() {
	$('audio.player').get(0).pause();
	$('audio.player').get(0).currentTime = 0;
	$('div.progress').stop(true, true);
	$('div.progress').width('0px');
}

function audioPlay() {
	audioStop();
	fileData = $('table.playlist tr.data').eq(playlistIndex).data('file');
	// highlight in playlist
	$('table.playlist tr.data').removeClass('info');
	$('table.playlist tr.data').eq(playlistIndex).addClass('info');
	$('table.playlist tr.data').eq(playlistIndex).scrollintoview();
	// change current song label
	$('span.currentSong').html('&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;' + fileData.title);
	// load selected song
	$('audio.player').children().remove();
	$('audio.player').append('<source src="' + fileData.playUrl + '" type="audio/mpeg" />');
	$('audio.player').get(0).load();
	// start playback
	$('audio.player').get(0).play();
}

function audioPause() {
	if ($('audio.player').get(0).paused) {
		$('audio.player').get(0).play();
	} else {
		$('audio.player').get(0).pause();
	}
}

function audioPrevious() {
	audioStop();
	if ($('table.playlist tr.data').length == 0) {
		playlistIndex = 0;
		return;
	}
	playlistIndex--;
	if (playlistIndex < 0) {
		playlistIndex = $('table.playlist tr.data').length - 1;
	}
	audioPlay();
}

function audioNext() {
	audioStop();
	if ($('table.playlist tr.data').length == 0) {
		playlistIndex = 0;
		return;
	}
	playlistIndex++;
	if (playlistIndex > ($('table.playlist tr.data').length - 1)) {
		playlistIndex = 0;
	}
	audioPlay();
}
