import { joinVoiceChannel } from "@discordjs/voice";
import { GuildMember, Message, MessageEmbed, VoiceChannel } from "discord.js";
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
export default class Music implements Command {
  public description;
  public mapQueues: Map<string, MusicSubscription>;

  public constructor() {
    this.mapQueues = new Map();
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
    }
  }

  private async playCommand(message: Message, args: string[]): Promise<void> {
    if (message.guildId) {
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

      const text = args.join(" ");
      const tracks = await getTracks(text, message.channel);

      if (tracks) {
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
          await message.channel.send({ embeds: [endQueueEmbed] });
        });
      } else {
        const notVoiceChannelEmbed = new MessageEmbed().setDescription(
          "I'm not in the voice channel right now"
        );

        message.channel.send({ embeds: [notVoiceChannelEmbed] });
      }
    }
  }

  private async disconnectCommand(message: Message): Promise<void> {
    if (message.guildId) {
      const subscription = this.mapQueues.get(message.guildId);
      if (subscription) {
        subscription.voiceConnection.destroy();
        this.mapQueues.delete(message.guildId);
      } else {
        const notVoiceChannelEmbed = new MessageEmbed().setDescription(
          "I'm not in the voice channel right now"
        );

        message.channel.send({ embeds: [notVoiceChannelEmbed] });
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

          message.channel.send({ embeds: [loopOnEmbed] });
        } else {
          const loopOnEmbed = new MessageEmbed().setDescription(
            "Looping is now **disable**"
          );

          message.channel.send({ embeds: [loopOnEmbed] });
        }
      } else {
        const notVoiceChannelEmbed = new MessageEmbed().setDescription(
          "I'm not in the voice channel right now"
        );

        message.channel.send({ embeds: [notVoiceChannelEmbed] });
      }
    }
  }
}