import { Message } from "discord.js";
import { Command } from "../comands.interface";
import { MusicSuscription } from "./suscription";

export default class Music implements Command {
  public description;
  public mapQueues: Map<string, MusicSuscription>;

  public constructor() {
    this.mapQueues = new Map();
    this.description = "play some music";
  }

  public async execute(message: Message, args: string[]): Promise<void> {
    await message.channel.send("prueba");
  }
}
