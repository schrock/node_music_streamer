FROM node:14.15.4-buster-slim

# install ffmpeg, copy over app files
RUN apt-get update && apt-get install -y ffmpeg && mkdir /root/app && mkdir /root/music
WORKDIR /root/app
ADD . .

# build and run
RUN npm install
CMD npm start
