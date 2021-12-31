import axios from "axios";
import {
  CommandInteraction,
  MessageEmbed,
  TextBasedChannel,
  TextBasedChannels,
  User,
} from "discord.js";
import { getPreview, getTracks } from "spotify-url-info";
import ytpl from "ytpl";
import { Track } from "./track";
enum Site {
  Youtube = 1,
  YoutubePlaylist = 2,
  SpotifyPlaylist = 3,
  SpotifyTrack = 4,
  Invalid = 5,
}
const regexYoutubePlaylist1 =
  /(?:https?:\/\/)?(?:www\.)?(?:youtube\.com\/(?:watch\?v=|watch\?.+&v=))((\w|-){11})(?:&list=)((\w|-){18})(?:\S+)?/;
const regexYoutubePlaylist2 =
  /(?:https?:\/\/)?(?:www\.)?(?:youtube\.com\/(?:playlist\?list=))((\w|-){18})(?:\S+)?/;

const regexYoutube =
  /(?:https?:\/\/)?(?:www\.)?(?:youtu\.be\/|youtube\.com\/(?:embed\/|v\/|watch\?v=|watch\?.+&v=))((\w|-){11})(?:\S+)?/;

const regexSpotifyPlaylist =
  /(?:https?:\/\/)?(?:www\.)?(?:open\.spotify\.com\/playlist\/)(\w{22})(?:\S+)?/;

const regexSpotifyTrack =
  /(?:https?:\/\/)?(?:www\.)?(?:open\.spotify\.com\/track\/)(\w{22})(?:\S+)?/;

const regexAnyUrl =
  /^(?:https?:\/\/)?(?:www\.)?[-a-zA-Z0-9@:%._+~#=]{1,256}\.[a-zA-Z0-9()]{1,6}\b(?:[-a-zA-Z0-9()@:%_+.~#?&/=]*)/;

const isUrl = (text: string): Site | null => {
  if (regexYoutubePlaylist1.test(text) || regexYoutubePlaylist2.test(text)) {
    return Site.YoutubePlaylist;
  }

  if (regexYoutube.test(text)) {
    return Site.Youtube;
  }

  if (regexSpotifyPlaylist.test(text)) {
    return Site.SpotifyPlaylist;
  }

  if (regexSpotifyTrack.test(text)) {
    return Site.SpotifyTrack;
  }

  if (regexAnyUrl.test(text)) {
    return Site.Invalid;
  }
  return null;
};

const replyTo = async (
  channel: TextBasedChannels | CommandInteraction,
  res: any
) => {
  if (channel instanceof CommandInteraction) await channel.editReply(res);
  else await channel.send(res);
};

export const getTracksFactory = async (
  text: string,
  channel: TextBasedChannels | CommandInteraction,
  requestBy: User
): Promise<Array<Track> | null> => {
  const site: Site | null = isUrl(text);
  const tracks: Array<Track> = [];
  const functionsTrack = {
    onStart(track: Track) {
      const onStartEmbed = new MessageEmbed()
        .setTitle("Now playing")
        .setDescription(
          `[${track?.title}](${track?.url}) [${track.requestedBy}]` || ""
        )
        .setThumbnail(track.thumbnail!);

      const res = { embeds: [onStartEmbed] };
      if (channel instanceof CommandInteraction) channel.channel?.send(res);
      else channel.send(res);
    },
    onFinish(track: Track) {
      console.log("Finish");
    },
    onError(track: Track, error: Error) {
      const onErrorEmbed = new MessageEmbed()
        .setTitle("An error occurred while playing")
        .setDescription(
          `[${track?.title}](${track?.url}) \n ${error.message}` || ""
        )
        .setColor("#ff3333");
      const res = { embeds: [onErrorEmbed] };
      if (channel instanceof CommandInteraction) channel.channel?.send(res);
      else channel.send(res);
    },
  };

  if (site === Site.Invalid) {
    const onErrorEmbed = new MessageEmbed()
      .setTitle("Invalid URL")
      .setDescription(
        "Try with Youtube Videos, Youtube or Spotify Playlist or just text"
      )
      .setColor("#ff3333");
    const res = { embeds: [onErrorEmbed] };
    if (channel instanceof CommandInteraction) channel.reply(res);
    else channel.send(res);
    return null;
  } else if (!site) {
    console.log("Text");
    const resTrack = await Track.fromText(
      text,
      functionsTrack,
      requestBy.toString()
    );
    if (resTrack) {
      const queuedEmbed = new MessageEmbed().setDescription(
        `Queued [${resTrack?.title}](${resTrack?.url}) [${resTrack.requestedBy}]` ||
          ""
      );
      replyTo(channel, { embeds: [queuedEmbed] });

      return [resTrack];
    } else {
      const onErrorEmbed = new MessageEmbed()
        .setTitle("Invalid text")
        .setDescription(
          "Invalid text to do a search, please try again with a different text"
        )
        .setColor("#ff3333");

      replyTo(channel, { embeds: [onErrorEmbed] });
      return null;
    }
  } else if (site === Site.Youtube) {
    console.log("Youtube");
    const resTrack = await Track.fromUrlYoutube(
      text,
      functionsTrack,
      requestBy.toString()
    );

    const queuedEmbed = new MessageEmbed().setDescription(
      `Queued [${resTrack?.title}](${resTrack?.url}) [${resTrack?.requestedBy}]` ||
        ""
    );
    replyTo(channel, { embeds: [queuedEmbed] });

    return resTrack ? [resTrack] : null;
  } else if (site === Site.YoutubePlaylist) {
    console.log("YoutubePlaylist");
    const listId = await ytpl.getPlaylistID(text);
    let tracksResult: ytpl.Result;
    try {
      tracksResult = await ytpl(listId);
    } catch (error) {
      const onErrorEmbed = new MessageEmbed()
        .setTitle("An error occurred while playing")
        .setDescription(`${(error as Error).message}` || "")
        .setColor("#ff3333");

      replyTo(channel, { embeds: [onErrorEmbed] });
      return null;
    }

    for (let index = 0; index < tracksResult.items.length; index++) {
      const element = tracksResult.items[index];
      const track = new Track(
        element.url,
        element?.title,
        element.bestThumbnail.url || undefined,
        requestBy.toString(),
        functionsTrack
      );
      tracks.push(track);
    }
    const onQueuedEmbed = new MessageEmbed().setDescription(
      `Queued **${tracksResult.items.length}** tracks` || ""
    );

    replyTo(channel, { embeds: [onQueuedEmbed] });
    return tracks;
  } else if (site === Site.SpotifyPlaylist) {
    //
    // **The commented text is the way to use the Spotify API and retrieve the information**
    //

    // const idPlaylist = regexSpotifyPlaylist.exec(text)![1];

    // const encode = Buffer.from(
    //   `${process.env.CLIENT_ID_SPOTIFY}:${process.env.CLIENT_SECRET_SPOTIFY}`
    // ).toString("base64");
    try {
      //   const params = new URLSearchParams();
      //   params.append("grant_type", "client_credentials");
      //   const resAuth = await axios.post(
      //     "https://accounts.spotify.com/api/token",
      //     params,
      //     {
      //       headers: {
      //         Authorization: `Basic ${encode}`,
      //         "Content-Type": "application/x-www-form-urlencoded",
      //       },
      //     }
      //   );
      //   const bearer = (resAuth.data as any).access_token;

      //   const resPlaylist = await axios.get(
      //     `https://api.spotify.com/v1/playlists/${idPlaylist}`,
      //     {
      //       headers: {
      //         Authorization: `Bearer ${bearer}`,
      //       },
      //       params: {
      //         fields: "tracks(items(track(name, artists(name))))",
      //       },
      //     }
      //   );

      //   for (
      //     let index = 0;
      //     index < (resPlaylist.data as any).tracks.items.length;
      //     index++
      //   ) {
      //     const element = (resPlaylist.data as any).tracks.items[index];
      //     const artists = (element.track.artists as Array<any>)
      //       .map((e) => e.name)
      //       .join(", ");

      //     const track = new Track(
      //       undefined,
      //       `${element.track.name} - ${artists}`,
      //       undefined,
      //       requestBy.toString(),
      //       functionsTrack
      //     );
      //     tracks.push(track);
      //   }
      //   const onQueuedEmbed = new MessageEmbed().setDescription(
      //     `Queued **${(resPlaylist.data as any).tracks.items.length}** tracks`
      //   );

      const resPlaylist = await getTracks(text);
      for (let index = 0; index < resPlaylist.length; index++) {
        const element = resPlaylist[index];
        const artists = element.artists!.map((e) => e.name).join(", ");

        const track = new Track(
          undefined,
          `${element.name} - ${artists}`,
          undefined,
          requestBy.toString(),
          functionsTrack
        );
        tracks.push(track);
      }
      const onQueuedEmbed = new MessageEmbed().setDescription(
        `Queued **${resPlaylist.length}** tracks`
      );
      replyTo(channel, { embeds: [onQueuedEmbed] });
      return tracks;
    } catch (error) {
      console.log("Error Spotify");
    }
  } else if (site === Site.SpotifyTrack) {
    //
    // **The commented text is the way to use the Spotify API and retrieve the information**
    //

    // const idTrack = regexSpotifyTrack.exec(text)![1];

    // const encode = Buffer.from(
    //   `${process.env.CLIENT_ID_SPOTIFY}:${process.env.CLIENT_SECRET_SPOTIFY}`
    // ).toString("base64");
    try {
      //   const params = new URLSearchParams();
      //   params.append("grant_type", "client_credentials");
      //   const resAuth = await axios.post(
      //     "https://accounts.spotify.com/api/token",
      //     params,
      //     {
      //       headers: {
      //         Authorization: `Basic ${encode}`,
      //         "Content-Type": "application/x-www-form-urlencoded",
      //       },
      //     }
      //   );
      //   const bearer = (resAuth.data as any).access_token;

      //   const resTrack: any = await axios.get(
      //     `https://api.spotify.com/v1/tracks/${idTrack}`,
      //     {
      //       headers: {
      //         Authorization: `Bearer ${bearer}`,
      //       },
      //     }
      //   );
      //   const artists = (resTrack.data.artists as Array<any>)
      //     .map((e) => e.name)
      //     .join(", ");

      //   const track = new Track(
      //     undefined,
      //     `${resTrack.data.name} - ${artists}`,
      //     undefined,
      //     requestBy.toString(),
      //     functionsTrack
      //   );

      const resTrack = await getPreview(text);
      const artists = resTrack.artist;
      const track = new Track(
        undefined,
        `${resTrack.title} - ${artists}`,
        undefined,
        requestBy.toString(),
        functionsTrack
      );

      const queuedEmbed = new MessageEmbed().setDescription(
        `Queued [${track?.title}](${text}) [${track.requestedBy}]` || ""
      );
      replyTo(channel, { embeds: [queuedEmbed] });

      return [track];
    } catch (error) {
      console.log("Error Spotify");
    }
  }

  return null;
};
