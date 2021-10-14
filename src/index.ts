import * as dotenv from "dotenv";
import * as fs from "fs";
global.AbortController = require("abort-controller");
import { Intents, Collection, Client, Message } from "discord.js";
import { Command } from "./commands/comands.interface";
import keys from "./commands/mapKeys";
dotenv.config();

const client = new Client({
  intents: [
    Intents.FLAGS.GUILD_VOICE_STATES,
    Intents.FLAGS.GUILD_MESSAGES,
    Intents.FLAGS.GUILDS,
  ],
});

const commands = new Collection<string, Command>();
const commandFiles = fs
  .readdirSync(__dirname + "/commands/")
  .filter((file) => !file.includes("interface") && !file.includes("mapKeys"))
  .map((file) => {
    const isDir = fs.lstatSync(__dirname + "/commands/" + file).isDirectory();
    if (isDir) {
      return file + "/index";
    }
    return file;
  });

const loadCommands = async () => {
  for (const file of commandFiles) {
    const classCommand = await import(`./commands/${file}`);
    commands.set(classCommand.default.name, new classCommand.default());
  }
};
loadCommands();
export const prefix = "-";

client.on("messageCreate", (message: Message) => {
  if (!message.content.startsWith(prefix) || message.author.bot) return;

  const args = message.content.slice(prefix.length).split(/ +/);
  let command = args[0].toLowerCase();
  if (command) {
    command = keys.get(command) || "";
    commands.get(command)?.execute(message, args);
  }
});

client.on("ready", () => console.log("Ready!"));
client.on("error", console.warn);
client.login(process.env.TOKEN);
