import {
  ButtonInteraction,
  Collection,
  CommandInteraction,
  Message,
} from "discord.js";
import { Command } from "../commands.interface";

const keys: Collection<string, string> = new Collection<string, string>();
keys.set("ping", "ping");

export default class Info implements Command {
  public description;
  public constructor() {
    this.description = "info commands";
  }
  public async execute(
    message: Message | CommandInteraction,
    command: string,
    args: string
  ): Promise<void> {
    console.log(command);
    if (message.guildId) {
      const commandKey = keys.get(command);
      switch (commandKey) {
        case "ping":
          if (message instanceof Message) await message.channel.send("pong!");
          else await message.reply("pong!");
          return;
      }
    }
  }
  public async handleButtons(
    buttonInteraction: ButtonInteraction
  ): Promise<void> {
    return;
  }
}
