import { ButtonInteraction, CommandInteraction, Message } from "discord.js";

export interface Command {
  description: string;
  execute(
    message: Message | CommandInteraction,
    command: string,
    args: string
  ): Promise<void>;
  handleButtons(buttonInteraction: ButtonInteraction): Promise<void>;
}
