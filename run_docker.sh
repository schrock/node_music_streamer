#! /bin/bash

# check args
if [ "$#" -ne 1 ]; then
    echo "Error: must pass in a single argument specifying the music directory."
    exit 1
fi

# exit upon error
set -e
# echo commands
set -x

# clean up prior to build
rm -rf node_modules

# build and run docker
IMAGE='node_music_streamer'
docker build -t $IMAGE .
docker image prune -f
docker run --rm -it -p 8080:8080 -p 8443:8443 -v $1:/root/music $IMAGE
