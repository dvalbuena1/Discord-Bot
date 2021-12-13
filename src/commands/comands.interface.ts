import { ButtonInteraction, Message } from "discord.js";

export interface Command {
  description: string;
  execute(message: Message, args: string[]): Promise<void>;
  handleButtons(buttonInteraction: ButtonInteraction): Promise<void>;
}
