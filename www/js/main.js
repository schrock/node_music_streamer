$(document).ready(function () {
	// get root files and put in browser div
	$.get('/dir?path=', function (data, status) {
		if (status == 'success') {
			handleDirContents('browser', data);
			//$('#browser').html(data);
		}
	});
});

function handleDirContents(parentId, dirEntries) {
	var dirs = [];
	var files = [];
	for (var dirEntry of dirEntries) {
		if (dirEntry.type == 'dir') {
			dirs.push(dirEntry);
		} else if (dirEntry.type == 'file') {
			files.push(dirEntry);
		}
	}
	handleDirs(parentId, dirs);
	handleFiles(files);
}

function handleDirs(parentId, dirs) {

}

function handleFiles(files) {

}
