import { Message } from "discord.js";
import { Command } from "./comands.interface";

export default class Ping implements Command {
  public description;
  public constructor() {
    this.description = "ping the bot";
  }
  public async execute(message: Message, args: string[]): Promise<void> {
    await message.channel.send("pong!");
  }
}
