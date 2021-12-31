import * as dotenv from "dotenv";
import * as fs from "fs";
global.AbortController = require("abort-controller");
import { Intents, Collection, Client, Message, Interaction } from "discord.js";
import { RESTPostAPIApplicationCommandsJSONBody } from "discord-api-types/v9";
import { Command } from "./commands/commands.interface";
import keys from "./commands/mapKeys";
import axios from "axios";
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
  .reduce((pre, curr) => {
    if (!curr.includes("interface") && !curr.includes("mapKeys")) {
      const isDir = fs.lstatSync(__dirname + "/commands/" + curr).isDirectory();
      if (isDir) {
        pre.push(curr);
        return pre;
      }
    }
    return pre;
  }, [] as Array<string>);

const slashCommands: RESTPostAPIApplicationCommandsJSONBody[] = [];
const loadSlashCommands = async () => {
  try {
    console.log("Started refreshing application (/) commands.");

    // await axios.put(
    //   `https://discord.com/api/v9/applications/${process.env.DISCORD_CLIENT_ID}/guilds/${process.env.GUILD}/commands`,
    //   slashCommands,
    //   {
    //     headers: {
    //       "Content-Type": "application/json",
    //       Authorization: `Bot ${process.env.DISCORD_TOKEN}`,
    //     },
    //   }
    // );

    await axios.put(
      `https://discord.com/api/v9/applications/${process.env.DISCORD_CLIENT_ID}/commands`,
      slashCommands,
      {
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bot ${process.env.DISCORD_TOKEN}`,
        },
      }
    );

    console.log("Successfully reloaded application (/) commands.");
  } catch (error: any) {
    console.error(error);
  }
};
const loadCommands = async () => {
  for (const file of commandFiles) {
    const slashCommandsDir = `${__dirname}/commands/${file}/slashCommands`;
    if (fs.existsSync(slashCommandsDir)) {
      const slashCommandFiles = fs.readdirSync(slashCommandsDir);
      for (const slashFile of slashCommandFiles) {
        const command = await import(
          `./commands/${file}/slashCommands/${slashFile}`
        );
        slashCommands.push(command.default);
      }
    }
    const classCommand = await import(`./commands/${file}/index`);
    commands.set(classCommand.default.name, new classCommand.default());
  }
  loadSlashCommands();
};
loadCommands();
const prefix = "-";
const regexMessage = new RegExp(`${prefix}(\\w+)(\\s.+)?`);

client.on("messageCreate", (message: Message) => {
  if (!regexMessage.test(message.content) || message.author.bot) return;

  const valuesRegex = regexMessage.exec(message.content);
  const command = valuesRegex![1].toLowerCase();
  const args: string | undefined = valuesRegex![2];
  if (command) {
    commands
      .get(keys.get(command) || "")
      ?.execute(message, command, args?.trim());
  }
});

client.on("interactionCreate", (interaction: Interaction) => {
  if (interaction.isButton()) {
    const Id: string[] = interaction.customId.split("?");
    commands.get(Id[0])?.handleButtons(interaction);
  } else if (interaction.isCommand()) {
    commands
      .get(keys.get(interaction.commandName) || "")
      ?.execute(
        interaction,
        interaction.commandName,
        interaction.options.data[0]
          ? String(interaction.options.data[0].value)
          : ""
      );
  }
});

client.on("ready", () => console.log("Ready!"));
client.on("error", console.warn);
client.login(process.env.DISCORD_TOKEN);
