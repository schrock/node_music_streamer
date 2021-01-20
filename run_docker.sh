#! /bin/bash

# check args
if [ "$#" -ne 1 ]; then
    echo "Error: must pass in a single argument specifying the music directory."
    exit 1
fi

# clean up prior to build
rm -rf node_modules
docker image prune -f

# build and run docker
IMAGE='node_music_streamer'
docker build -t $IMAGE .
docker run --rm -it -p 8080:8080 -v $1:/home/node/Music $IMAGE
