FROM node:16
WORKDIR /discord-bot
RUN apt-get -y update
RUN apt-get install -y ffmpeg

COPY package*.json ./
RUN npm install
COPY . .

CMD [ "npm", "run","build" ]