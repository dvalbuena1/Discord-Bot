import { Message } from "discord.js";

export interface Command {
  description: string;
  execute(message: Message, args: string[]): Promise<void>;
}
