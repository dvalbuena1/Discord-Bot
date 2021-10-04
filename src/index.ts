import * as dotenv from "dotenv";
import * as fs from "fs";
import { Intents, Collection, Client, Message } from "discord.js";
import { Command } from "./commands/comands.interface";
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
  .readdirSync(__dirname + "\\commands\\")
  .filter((file) => file.endsWith(".ts") && !file.includes("interface"));

for (const file of commandFiles) {
  // eslint-disable-next-line @typescript-eslint/no-var-requires
  const command = require(`./commands/${file}`);
  commands.set(command.name, command);
}

const prefix = ">";
client.on("messageCreate", (message: Message) => {
  if (!message.content.startsWith(prefix) || message.author.bot) return;

  const args = message.content.slice(prefix.length).split(/ +/);
  const command = args.shift()?.toLowerCase();
  if (command) {
    commands.get(command)?.execute(message, args);
  }
});

client.on("ready", () => console.log("Ready!"));
client.on("error", console.warn);
client.login(process.env.TOKEN);
