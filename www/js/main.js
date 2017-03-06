var isPlaying = false;
var playlistIndex = 0;

$(document).ready(function () {
	// get root browser contents
	browser_bootstrap();
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
			audioPrevious();
		} else if (key == 'x') {
			audioPlay();
		} else if (key == 'c') {
			audioPause();
		} else if (key == 'v') {
			audioStop();
		} else if (key == 'b') {
			audioNext();
		}
	});
});

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
	$(parent).append('<ul></ul>');
	for (var dir of dirs) {
		$(parent + ' ul').append('<li>' + dir.name + '</li>');
		$(parent + ' ul li').last().data('dirUrl', dir.dirUrl);
		$(parent + ' ul li').last().click(function () {
			var element = this;
			if ($(element).children().length > 0) {
				$(element).children().remove();
			} else {
				var dirUrl = $(element).data('dirUrl');
				$.get(dirUrl, function (data, status) {
					if (status == 'success') {
						handleDirContents(OptimalSelect.select(element), data);
					}
				});
			}
			return false;
		});
	}
}

function handleFiles(files) {
	// reset playlistIndex
	playlistIndex = 0;
	
	$('table.playlist tr.data').remove();
	for (var file of files) {
		//console.log(JSON.stringify(file, null, 4));
		$('table.playlist').append('<tr class="data"></tr>');
		$('table.playlist tr.data').last().append('<td>' + file.trackNum + '</td>');
		$('table.playlist tr.data').last().append('<td>' + file.title + '</td>');
		$('table.playlist tr.data').last().append('<td>' + file.artist + '</td>');
		$('table.playlist tr.data').last().append('<td>' + file.album + '</td>');
		$('table.playlist tr.data').last().append('<td>' + file.duration + '</td>');
		$('table.playlist tr.data').last().data('playUrl', file.playUrl);
	}
	$('table.playlist tr.data').dblclick(function () {
		// stop current song
		audioStop();
		// update playlistIndex
		playlistIndex = $(this).index() - 1;
		// play song
		audioPlay();
		return false;
	});
}

function audioStop() {
	$('audio.player').get(0).pause();
	$('audio.player').get(0).currentTime = 0;
	isPlaying = false;
}

function audioPlay() {
	audioStop();
	// highlight in playlist
	$('table.playlist tr.data').removeClass('selected');
	$('table.playlist tr.data').eq(playlistIndex).addClass('selected');
	$('table.playlist tr.data').eq(playlistIndex).scrollintoview();
	// load selected song
	$('audio.player').children().remove();
	$('audio.player').append('<source src="' + $('table.playlist tr.data').eq(playlistIndex).data('playUrl') + '" type="audio/mpeg" />');
	$('audio.player').get(0).load();
	// start playback
	$('audio.player').get(0).play();
	isPlaying = true;
}

function audioPause() {
	if (isPlaying) {
		$('audio.player').get(0).pause();
		isPlaying = false;
	} else {
		$('audio.player').get(0).play();
		isPlaying = true;
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
