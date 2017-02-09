const fs = require('fs');
const express = require('express');
const app = express();

app.get('/', function(req, res) {
	var files = fs.readdirSync('.');
	console.log(files);
	res.send(files);
});

app.listen(3000, function() {
  console.log('Example app listening on port 3000!');
});

