# Discord Bot

Music bot with the possibility to add new cool features!

## Features

- Scalable to add new categories and features easily 🛫
- Works in multiple servers at the same time 💻
- YouTube and Spotify support 📼
- Slash Commands and text commands support 🤖

## Dependencies

- **Node 14** and why not node 16.6.0 or higher? as specified by Discord.js 13. [The answer](https://github.com/dvalbuena1/Discord-Bot/issues/1)
- [discord.js](https://github.com/discordjs/discord.js)
- [@discordjs/voice](https://github.com/discordjs/voice) handle voice request
- [@discordjs/opus](https://github.com/discordjs/opus) required by @discordjs/voice
- [ytdl-core](https://github.com/fent/node-ytdl-core) to get info of YouTube videos
- [FFmpeg](https://ffmpeg.org/) to encode the stream
- [spotify-url-info](https://github.com/microlinkhq/spotify-url-info) to get Spotify info without the official API
  This library limits 100 tracks per playlist. In case you want to use the Spotify API just uncomment the code in the `src/commands/music/trackFactory.ts` and add these two variables to the `.env`: `CLIENT_ID_SPOTIFY` and `CLIENT_SECRET_SPOTIFY`

## Commands

| Name                                       |                 Description                 |     Options |
| :----------------------------------------- | :-----------------------------------------: | ----------: |
| **/back**, **-b** or **-back**             |         Skips to the previous song          |             |
| **/clear**, **-cl** or **-clear**          |      Removes all tracks from the queue      |             |
| **/disconnect**, **-d** or **-disconnect** | Disconnects the bot from your voice channel |             |
| **/jump**, **-j** or **-jump**             |          Jump to a specific track           | \<position> |
| **/loop**, **-l** or **-loop**             |          Changes the looping mode           |             |
| **/next**, **-n** or **-next**             |           Skips to the next song            |             |
| **/pause**, **-ps** or **-pause**          |              Pause the player               |             |
| **/play**, **-p** or **-play**             |      Play a song in your voice channel      |    \<input> |
| **/playnext**, **-pn** or **-playnext**    |       Queue a song immediately after        |    \<input> |
| **/queue**, **-q** or **-queue**           |  Displays the current queue of the tracks   |             |
| **/remove**, **-r** or **-remove**         |         Removes the specific track          | \<position> |
| **/shuffle**, **-sh** or **-shuffle**      |             Shuffles the queue              |             |
| **/unpause**, **-unps** or **-unpause**    |             Resumes the player              |             |
| **/ping** or **-ping**                     |                Pings the bot                |             |

## Installation

### Manual

- Install [FFMPEG](https://ffmpeg.org)
- Clone the repository. (`git clone https://github.com/dvalbuena1/Discord-Bot`)
- Rename the `.env.example` as `.env` and fill it
  - `DISCORD_CLIENT_ID` the client id of your Discord Bot
  - `DISCORD_TOKEN` the client secret of your Discord Bot
- Install the dependencies. (`npm install`)
- Run the bot! (`npm run build`)

### Docker

- Rename the `.env.example` as `.env` and fill it
- Execute the next lines

```sh
docker build --pull --rm -f "Dockerfile" -t discordbot:latest "."
docker run -d discordbot
```
