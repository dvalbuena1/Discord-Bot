import { joinVoiceChannel } from "@discordjs/voice";
import {
  ButtonInteraction,
  GuildMember,
  Message,
  MessageActionRow,
  MessageButton,
  MessageEmbed,
  MessageEmbedOptions,
  VoiceChannel,
} from "discord.js";
import Collection from "@discordjs/collection";
import { Command } from "../comands.interface";
import { MusicSubscription } from "./suscription";
import { getTracksFactory } from "./trackFactory";

const keys: Collection<string, string> = new Collection<string, string>();
keys.set("p", "play");
keys.set("play", "play");

keys.set("d", "disconnect");
keys.set("disconnect", "disconnect");

keys.set("n", "next");
keys.set("next", "next");

keys.set("l", "loop");
keys.set("loop", "loop");

keys.set("sh", "shuffle");
keys.set("shuffle", "shuffle");

keys.set("q", "queue");
keys.set("queue", "queue");

keys.set("j", "jump");
keys.set("jump", "jump");

keys.set("r", "remove");
keys.set("remove", "remove");

keys.set("ps", "pause");
keys.set("pause", "pause");

keys.set("b", "back");
keys.set("back", "back");

keys.set("pn", "playnext");
keys.set("playnext", "playnext");

keys.set("cl", "clear");
keys.set("clear", "clear");

const regexButton = /(\w+)\?(\d+)\.(\w+)\$(\d+)/;
export default class Music implements Command {
  public description;
  public mapQueues: Map<string, MusicSubscription>;
  public validButtons: Map<string, string>;

  public constructor() {
    this.mapQueues = new Map();
    this.validButtons = new Map();
    this.description = "play some music";
  }

  public async execute(message: Message, args: string[]): Promise<void> {
    if (message.guildId) {
      const command = keys.get(args.shift() || "");

      switch (command) {
        case "play":
          this.playCommand(message, args, false);
          return;
        case "playnext":
          this.playCommand(message, args, true);
          return;
      }

      const subscription = this.mapQueues.get(message.guildId);
      if (subscription) {
        switch (command) {
          case "next":
            this.nextCommand(message, subscription);
            break;
          case "disconnect":
            this.disconnectCommand(message, subscription);
            break;
          case "loop":
            this.loopCommand(message, subscription);
            break;
          case "shuffle":
            this.shuffleCommand(message, subscription);
            break;
          case "queue":
            this.queueCommand(message, subscription);
            break;
          case "jump":
            this.jumpCommand(message, args, subscription);
            break;
          case "remove":
            this.removeCommand(message, args, subscription);
            break;
          case "pause":
            this.pauseCommand(message, subscription);
            break;
          case "back":
            this.backCommand(message, subscription);
            break;
          case "clear":
            this.clearCommand(message, subscription);
            break;
        }
      } else {
        await this.sendEmbed(message, {
          description: "I'm not in the voice channel right now",
        });
      }
    }
  }

  public async handleButtons(
    buttonInteraction: ButtonInteraction
  ): Promise<void> {
    const regexCustomId = regexButton.exec(buttonInteraction.customId);
    if (regexCustomId) {
      const subscription = this.mapQueues.get(regexCustomId[2]);
      const validCustomId = this.validButtons.get(regexCustomId[3]);
      if (subscription && validCustomId === buttonInteraction.customId) {
        const message = buttonInteraction.message as Message;
        switch (regexCustomId[3]) {
          case "first":
            subscription.firstQueueList();
            break;
          case "next":
            subscription.nextQueueList();
            break;
          case "back":
            subscription.backQueueList();
            break;
          case "last":
            subscription.lastQueueList();
            break;
        }
        await message.edit({
          content: `\`\`\`nim\n${subscription.getQueue()} \`\`\``,
        });
        await buttonInteraction.deferUpdate();
      }
    }
  }

  private async playCommand(
    message: Message,
    args: string[],
    playNext: boolean
  ): Promise<void> {
    if (message.guildId) {
      const text = args.join(" ");
      let subscription = this.mapQueues.get(message.guildId);

      if (subscription && !text && !playNext) {
        if (subscription.play()) await message.react("👌");
        else {
          await this.sendEmbed(message, {
            description: "I'm not on pause right now",
          });
        }
        return;
      }

      if (!subscription) {
        if (
          message.member instanceof GuildMember &&
          message.member.voice.channel
        ) {
          const channel = message.member?.voice?.channel;
          subscription = new MusicSubscription(
            joinVoiceChannel({
              channelId: channel?.id || "",
              guildId: channel?.guild.id || "",
              adapterCreator: channel?.guild.voiceAdapterCreator || Object,
            }),
            async () => {
              subscription?.voiceConnection.destroy();
              this.mapQueues.delete(message.guildId || "");
              await this.sendEmbed(message, {
                description:
                  "I left the voice channel because I was inactive for too long",
              });
            },
            <VoiceChannel>message.member.voice.channel
          );
          subscription.voiceConnection.on("error", console.warn);
          this.mapQueues.set(message.guildId, subscription);
        } else {
          await this.sendEmbed(message, {
            description:
              "You have to be connected to a voice channel before you can use this command!",
          });
          return;
        }
      }

      const tracks = await getTracksFactory(
        text,
        message.channel,
        message.author
      );
      console.log(tracks);
      if (tracks) {
        subscription.enqueue(tracks, playNext);
      } else {
        console.log("Error enqueue");
      }
    }
  }

  private async nextCommand(
    message: Message,
    subscription: MusicSubscription
  ): Promise<void> {
    if (subscription.next()) {
      await message.react("👌");
    } else {
      await this.sendEmbed(message, {
        description: "No more songs left in the queue",
      });
    }
  }

  private async disconnectCommand(
    message: Message,
    subscription: MusicSubscription
  ): Promise<void> {
    subscription.voiceConnection.destroy();
    this.mapQueues.delete(message.guildId!);
    await message.react("👋");
  }

  private async loopCommand(
    message: Message,
    subscription: MusicSubscription
  ): Promise<void> {
    const loop = subscription.loopQueue();
    if (loop) {
      await this.sendEmbed(message, {
        description: "Now looping the **queue**",
      });
    } else {
      await this.sendEmbed(message, {
        description: "Looping is now **disable**",
      });
    }
  }

  private async shuffleCommand(
    message: Message,
    subscription: MusicSubscription
  ): Promise<void> {
    subscription.shuffleQueue();
    await message.react("🔀");
  }

  private async queueCommand(
    message: Message,
    subscription: MusicSubscription
  ): Promise<void> {
    subscription.resetQueueList();
    const queue = subscription.getQueue();
    if (queue) {
      const timestamp = Date.now();
      const first = new MessageButton()
        .setCustomId(`Music?${message.guildId}.first$${timestamp}`)
        .setLabel("First")
        .setStyle("SECONDARY");
      this.validButtons.set("first", first.customId!);
      const back = new MessageButton()
        .setCustomId(`Music?${message.guildId}.back$${timestamp}`)
        .setLabel("Back")
        .setStyle("SECONDARY");
      this.validButtons.set("back", back.customId!);
      const next = new MessageButton()
        .setCustomId(`Music?${message.guildId}.next$${timestamp}`)
        .setLabel("Next")
        .setStyle("SECONDARY");
      this.validButtons.set("next", next.customId!);
      const last = new MessageButton()
        .setCustomId(`Music?${message.guildId}.last$${timestamp}`)
        .setLabel("Last")
        .setStyle("SECONDARY");
      this.validButtons.set("last", last.customId!);
      const row = new MessageActionRow().addComponents([
        first,
        back,
        next,
        last,
      ]);
      await message.channel.send({
        content: `\`\`\`nim\n${queue} \`\`\``,
        components: [row],
      });
    } else {
      await message.channel.send({
        content: "```nim\nThe queue is empty ;-; ```",
      });
    }
  }

  private async jumpCommand(
    message: Message,
    args: string[],
    subscription: MusicSubscription
  ): Promise<void> {
    const text = args[0];
    const integer = parseInt(text, 10) - 1;

    if (
      !isNaN(integer) &&
      integer < subscription.queue.length &&
      integer >= 0
    ) {
      subscription.jump(integer);
    } else {
      await this.sendEmbed(message, {
        description: "Please enter a valid number!",
        color: "#ff3333",
      });
    }
  }

  private async removeCommand(
    message: Message,
    args: string[],
    subscription: MusicSubscription
  ): Promise<void> {
    const text = args[0];
    const integer = parseInt(text, 10) - 1;

    if (
      !isNaN(integer) &&
      integer < subscription.queue.length &&
      integer >= 0
    ) {
      const error = async () => {
        await this.sendEmbed(message, {
          description: "It is not possible to remove the current song!",
          color: "#ff3333",
        });
      };
      const track = subscription.remove(integer, error);

      if (track) {
        await this.sendEmbed(message, {
          description:
            `Removed [${track.title}](${track.url}) [${track.requestedBy}]` ||
            "",
        });
      }
    } else {
      await this.sendEmbed(message, {
        description: "Please enter a valid number!",
        color: "#ff3333",
      });
    }
  }

  private async pauseCommand(
    message: Message,
    subscription: MusicSubscription
  ): Promise<void> {
    if (subscription.pause()) await message.react("⏸");
    else {
      await this.sendEmbed(message, {
        description: "I'm not playing right now",
      });
    }
  }

  private async backCommand(
    message: Message,
    subscription: MusicSubscription
  ): Promise<void> {
    if (subscription.back()) {
      await message.react("👌");
    } else {
      await this.sendEmbed(message, {
        description: "No previous songs in the queue",
      });
    }
  }

  private async clearCommand(
    message: Message,
    subscription: MusicSubscription
  ): Promise<void> {
    subscription.clear();
    await message.react("👌");
  }

  private async sendEmbed(message: Message, options: MessageEmbedOptions) {
    const embed = new MessageEmbed(options);
    await message.channel.send({ embeds: [embed] });
  }
}
