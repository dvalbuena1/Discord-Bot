import { joinVoiceChannel } from "@discordjs/voice";
import {
  GuildMember,
  Message,
  MessageEmbed,
  Sticker,
  TextBasedChannels,
  VoiceChannel,
} from "discord.js";
import Collection from "@discordjs/collection";
import { Command } from "../comands.interface";
import { MusicSubscription } from "./suscription";
import { prefix } from "../../index";
import { Track } from "./track";
import ytpl from "ytpl";

enum Site {
  Youtube = 1,
  YoutubePlaylist = 2,
}

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

      const text = args.join(" ");
      const site: Site | null = this.isUrl(text);
      let track: Track | null | undefined;
      const functionsTrack = {
        onStart() {
          const onStartEmbed = new MessageEmbed()
            .setTitle("Now playing")
            .setDescription(`[${track?.title}](${track?.url})` || "");

          message.channel.send({ embeds: [onStartEmbed] });
        },
        onFinish() {
          console.log("Finish");
        },
        onError(error: Error) {
          const onErrorEmbed = new MessageEmbed()
            .setTitle("An error occurred while playing")
            .setDescription(
              `[${track?.title}](${track?.url}) <br/> ${error.message}` || ""
            );

          message.channel.send({ embeds: [onErrorEmbed] });
        },
      };

      if (!site) {
        console.log("Texto");
        track = await Track.fromText(text, functionsTrack);
      } else if (site === Site.Youtube) {
        console.log("Youtube");
        track = await Track.fromUrlYoutube(text, functionsTrack);
      } else if (site === Site.YoutubePlaylist) {
        console.log("YoutubePlaylist");
        const listId = await ytpl.getPlaylistID(text);
        const tracks = await ytpl(listId);

        const onQueuedEmbed = new MessageEmbed().setDescription(
          `Queued **${tracks.items.length}** tracks` || ""
        );

        await message.channel.send({ embeds: [onQueuedEmbed] });
        for (let index = 0; index < tracks.items.length; index++) {
          const element = tracks.items[index];
          const functionsTrackLoop = {
            onStart() {
              const onStartEmbed = new MessageEmbed()
                .setTitle("Now playing")
                .setDescription(`[${element?.title}](${element?.url})` || "");

              message.channel.send({ embeds: [onStartEmbed] });
            },
            onFinish() {
              console.log("Finish");
            },
            onError(error: Error) {
              const onErrorEmbed = new MessageEmbed()
                .setTitle("An error occurred while playing")
                .setDescription(
                  `[${element?.title}](${element?.url}) <br/> ${error.message}` ||
                    ""
                );

              message.channel.send({ embeds: [onErrorEmbed] });
            },
          };
          track = await Track.fromUrlYoutube(element.url, functionsTrackLoop);
          if (track) {
            subscription.enqueue(track);
          } else {
            console.log("Error enqueue");
          }
        }
        return;
      }

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
        await message.channel.send("I'm not in the voice channel right now");
      }
    }
  }

  private isUrl(text: string): Site | null {
    const regexYoutubePlaylist =
      /(?:https?:\/\/)?(?:www\.)?(?:youtube\.com\/(?:watch\?v=|watch\?.+&v=))((\w|-){11})(?:&list=)((\w|-){18})(?:\S+)?/;
    if (regexYoutubePlaylist.test(text)) {
      return Site.YoutubePlaylist;
    }

    const regexYoutube =
      /(?:https?:\/\/)?(?:www\.)?(?:youtu\.be\/|youtube\.com\/(?:embed\/|v\/|watch\?v=|watch\?.+&v=))((\w|-){11})(?:\S+)?/;
    if (regexYoutube.test(text)) {
      return Site.Youtube;
    }
    return null;
  }
}
