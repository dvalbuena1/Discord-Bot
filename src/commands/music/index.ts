import { joinVoiceChannel } from "@discordjs/voice";
import {
  ButtonInteraction,
  GuildMember,
  Message,
  MessageActionRow,
  MessageButton,
  MessageEmbed,
  VoiceChannel,
} from "discord.js";
import Collection from "@discordjs/collection";
import { Command } from "../comands.interface";
import { MusicSubscription } from "./suscription";
import { getTracks } from "./factoryTrack";

const keys: Collection<string, string> = new Collection<string, string>();
keys.set("p", "play");
keys.set("play", "play");

keys.set("d", "disconnect");
keys.set("disconnect", "disconnect");

keys.set("n", "next");
keys.set("next", "next");

keys.set("l", "loop");
keys.set("loop", "loop");

keys.set("s", "shuffle");
keys.set("shuffle", "shuffle");

keys.set("q", "queue");
keys.set("queue", "queue");

keys.set("j", "jump");
keys.set("jump", "jump");

keys.set("r", "remove");
keys.set("remove", "remove");

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
    const command = keys.get(args.shift() || "");

    switch (command) {
      case "play":
        this.playCommand(message, args);
        break;
      case "next":
        this.nextCommand(message);
        break;
      case "disconnect":
        this.disconnectCommand(message);
        break;
      case "loop":
        this.loopCommand(message);
        break;
      case "shuffle":
        this.shuffleCommand(message);
        break;
      case "queue":
        this.queueCommand(message);
        break;
      case "jump":
        this.jumpCommand(message, args);
        break;
      case "remove":
        this.removeCommand(message, args);
        break;
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

  private async playCommand(message: Message, args: string[]): Promise<void> {
    if (message.guildId) {
      const text = args.join(" ");
      const tracks = await getTracks(text, message.channel, message.author);
      if (tracks) {
        let subscription = this.mapQueues.get(message.guildId);
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
                const idleEmbed = new MessageEmbed().setDescription(
                  "I left the voice channel because I was inactive for too long"
                );
                await message.channel.send({ embeds: [idleEmbed] });
              },
              <VoiceChannel>message.member.voice.channel
            );
            subscription.voiceConnection.on("error", console.warn);
            this.mapQueues.set(message.guildId, subscription);
          } else {
            const connectedEmbed = new MessageEmbed().setDescription(
              "You have to be connected to a voice channel before you can use this command!"
            );
            await message.channel.send({ embeds: [connectedEmbed] });
            return;
          }
        }

        for (const track of tracks) {
          subscription.enqueue(track);
        }
      } else {
        console.log("Error enqueue");
      }
    }
  }

  private async nextCommand(message: Message): Promise<void> {
    if (message.guildId) {
      const subscription = this.mapQueues.get(message.guildId);
      if (subscription) {
        subscription.next(async () => {
          const endQueueEmbed = new MessageEmbed().setDescription(
            "No more songs left in the queue"
          );
          await message.react("👌");
          await message.channel.send({ embeds: [endQueueEmbed] });
        });
      } else {
        const notVoiceChannelEmbed = new MessageEmbed().setDescription(
          "I'm not in the voice channel right now"
        );

        await message.channel.send({ embeds: [notVoiceChannelEmbed] });
      }
    }
  }

  private async disconnectCommand(message: Message): Promise<void> {
    if (message.guildId) {
      const subscription = this.mapQueues.get(message.guildId);
      if (subscription) {
        subscription.voiceConnection.destroy();
        this.mapQueues.delete(message.guildId);
        await message.react("👋");
      } else {
        const notVoiceChannelEmbed = new MessageEmbed().setDescription(
          "I'm not in the voice channel right now"
        );

        await message.channel.send({ embeds: [notVoiceChannelEmbed] });
      }
    }
  }

  private async loopCommand(message: Message): Promise<void> {
    if (message.guildId) {
      const subscription = this.mapQueues.get(message.guildId);
      if (subscription) {
        const loop = subscription.loopQueue();
        if (loop) {
          const loopOnEmbed = new MessageEmbed().setDescription(
            "Now looping the **queue**"
          );

          await message.channel.send({ embeds: [loopOnEmbed] });
        } else {
          const loopOnEmbed = new MessageEmbed().setDescription(
            "Looping is now **disable**"
          );

          await message.channel.send({ embeds: [loopOnEmbed] });
        }
      } else {
        const notVoiceChannelEmbed = new MessageEmbed().setDescription(
          "I'm not in the voice channel right now"
        );

        await message.channel.send({ embeds: [notVoiceChannelEmbed] });
      }
    }
  }

  private async shuffleCommand(message: Message): Promise<void> {
    if (message.guildId) {
      const subscription = this.mapQueues.get(message.guildId);
      if (subscription) {
        subscription.shuffleQueue();
        await message.react("🔀");
      } else {
        const notVoiceChannelEmbed = new MessageEmbed().setDescription(
          "I'm not in the voice channel right now"
        );

        await message.channel.send({ embeds: [notVoiceChannelEmbed] });
      }
    }
  }

  private async queueCommand(message: Message): Promise<void> {
    if (message.guildId) {
      const subscription = this.mapQueues.get(message.guildId);
      if (subscription) {
        subscription.resetQueueList();
        const queue = subscription.getQueue();
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
        const notVoiceChannelEmbed = new MessageEmbed().setDescription(
          "I'm not in the voice channel right now"
        );

        await message.channel.send({ embeds: [notVoiceChannelEmbed] });
      }
    }
  }

  private async jumpCommand(message: Message, args: string[]): Promise<void> {
    if (message.guildId) {
      const subscription = this.mapQueues.get(message.guildId);
      if (subscription) {
        const text = args[0];
        const integer = parseInt(text, 10) - 1;

        if (
          !isNaN(integer) &&
          integer < subscription.queue.length &&
          integer >= 0
        ) {
          subscription.jump(integer);
        } else {
          const isNaNChannelEmbed = new MessageEmbed()
            .setDescription("Please enter a valid number!")
            .setColor("#ff3333");

          await message.channel.send({ embeds: [isNaNChannelEmbed] });
        }
      } else {
        const notVoiceChannelEmbed = new MessageEmbed().setDescription(
          "I'm not in the voice channel right now"
        );

        await message.channel.send({ embeds: [notVoiceChannelEmbed] });
      }
    }
  }

  private async removeCommand(message: Message, args: string[]): Promise<void> {
    if (message.guildId) {
      const subscription = this.mapQueues.get(message.guildId);
      if (subscription) {
        const text = args[0];
        const integer = parseInt(text, 10) - 1;

        if (
          !isNaN(integer) &&
          integer < subscription.queue.length &&
          integer >= 0
        ) {
          const error = async () => {
            const isActualIndexChannelEmbed = new MessageEmbed()
              .setDescription("It is not possible to remove the current song!")
              .setColor("#ff3333");

            await message.channel.send({ embeds: [isActualIndexChannelEmbed] });
          };
          const track = subscription.remove(integer, error);

          if (track) {
            const removedEmbed = new MessageEmbed().setDescription(
              `Removed [${track.title}](${track.url}) [${track.requestedBy}]` ||
                ""
            );

            await message.channel.send({ embeds: [removedEmbed] });
          }
        } else {
          const isNaNChannelEmbed = new MessageEmbed()
            .setDescription("Please enter a valid number!")
            .setColor("#ff3333");

          await message.channel.send({ embeds: [isNaNChannelEmbed] });
        }
      } else {
        const notVoiceChannelEmbed = new MessageEmbed().setDescription(
          "I'm not in the voice channel right now"
        );

        await message.channel.send({ embeds: [notVoiceChannelEmbed] });
      }
    }
  }
}
