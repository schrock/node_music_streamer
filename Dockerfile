FROM node:10-slim

# install ffmpeg
RUN echo 'deb http://ftp.debian.org/debian jessie-backports main' >> /etc/apt/sources.list && apt-get update && apt-get install -y ffmpeg

# copy over app files
USER node
RUN mkdir /home/node/app && mkdir /home/node/Music
WORKDIR /home/node/app
ADD . .

# build and run
RUN npm install
CMD npm start
