import { Command } from "./comands.interface";
const play: Command = {
  name: "play",
  description: "play a song",
  async execute(message, args) {
    await message.channel.send("Test");
  },
};
module.exports = play;
