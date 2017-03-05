var isPlaying = false;
var playlistIndex = -1;

$(document).ready(function () {
	// get root browser contents
	browser_bootstrap();
	// hookup audio player buttons
	$('button.stop').click(audioStop);
	$('button.play').click(audioPlay);
	$('button.pause').click(audioPause);
	$('button.previous').click(audioPrevious);
	$('button.next').click(audioNext);
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
	$('div.playlist').children().remove();
	for (var file of files) {
		$('div.playlist').append('<div>' + file.name + '</div>');
		$('div.playlist').children().last().data('playUrl', file.playUrl);
	}
	$('div.playlist div').dblclick(function () {
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
	isPlaying = false;
}

function audioPlay() {
	audioStop();
	// highlight in playlist
	$('div.playlist div').removeClass('selected');
	$('div.playlist div').eq(playlistIndex).addClass('selected');
	$('div.playlist div').eq(playlistIndex).scrollintoview();
	// load selected song
	$('audio.player').children().remove();
	$('audio.player').append('<source src="' + $('div.playlist div').eq(playlistIndex).data('playUrl') + '" type="audio/mpeg" />');
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
	if ($('div.playlist').children().length == 0) {
		playlistIndex = -1;
		return;
	}
	playlistIndex--;
	if (playlistIndex < 0) {
		playlistIndex = $('div.playlist').children().length - 1;
	}
	audioPlay();
}

function audioNext() {
	audioStop();
	if ($('div.playlist').children().length == 0) {
		playlistIndex = -1;
		return;
	}
	playlistIndex++;
	if (playlistIndex > ($('div.playlist').children().length - 1)) {
		playlistIndex = 0;
	}
	audioPlay();
}
