import { joinVoiceChannel } from "@discordjs/voice";
import { GuildMember, Message, MessageEmbed, VoiceChannel } from "discord.js";
import Collection from "@discordjs/collection";
import { Command } from "../comands.interface";
import { MusicSubscription } from "./suscription";
import { prefix } from "../../index";
import { Track } from "./track";

const keys: Collection<string, string> = new Collection<string, string>();
keys.set("p", "play");
keys.set("play", "play");

keys.set("d", "disconnect");
keys.set("disconnect", "disconnect");

keys.set("n", "next");
keys.set("next", "next");
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
              await message.channel.send(
                "I left the voice channel because I was inactive for too long"
              );
            },
            <VoiceChannel>message.member.voice.channel
          );
          subscription.voiceConnection.on("error", console.warn);
          this.mapQueues.set(message.guildId, subscription);
        } else {
          await message.channel.send(
            "You have to be connected to a voice channel before you can use this command!"
          );
          return;
        }
      }

      const text = args[args.length - 1].includes(prefix)
        ? args.slice(0, args.length - 1).join(" ")
        : args.join(" ");
      const track = await Track.fromText(text, {
        onStart() {
          const onStartEmbed = new MessageEmbed()
            .setTitle("Now playing")
            .setDescription(`[${track?.title}](${track?.url})` || "");

          message.channel.send({ embeds: [onStartEmbed] });
        },
        onFinish() {
          console.log("Finish");
        },
        onError() {
          console.log("Error");
        },
      });
      if (track) {
        subscription.enqueue(track);
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
          await message.channel.send("No more songs in the queue");
        });
      } else {
        await message.channel.send("I'm not in the voice channel right now");
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
        await message.channel.send("I'm not in the voice channel right now");
      }
    }
  }
}
