$(document).ready(function () {
	// get root browser contents
	browser_bootstrap();
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
			var dirUrl = $(element).data('dirUrl');
			$.get(dirUrl, function (data, status) {
				if (status == 'success') {
					console.log(data);
					handleDirContents(OptimalSelect.select(element), data);
				}
			});
		});
	}
}

function handleFiles(files) {

}
