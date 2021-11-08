import axios from "axios";
import { MessageEmbed, TextBasedChannels, User } from "discord.js";
import ytpl from "ytpl";
import { Track } from "./track";
enum Site {
  Youtube = 1,
  YoutubePlaylist = 2,
  SpotifyPlaylist = 3,
  Invalid = 4,
}
const regexYoutubePlaylist1 =
  /(?:https?:\/\/)?(?:www\.)?(?:youtube\.com\/(?:watch\?v=|watch\?.+&v=))((\w|-){11})(?:&list=)((\w|-){18})(?:\S+)?/;
const regexYoutubePlaylist2 =
  /(?:https?:\/\/)?(?:www\.)?(?:youtube\.com\/(?:playlist\?list=))((\w|-){18})(?:\S+)?/;

const regexYoutube =
  /(?:https?:\/\/)?(?:www\.)?(?:youtu\.be\/|youtube\.com\/(?:embed\/|v\/|watch\?v=|watch\?.+&v=))((\w|-){11})(?:\S+)?/;

const regexSpotify =
  /(?:https?:\/\/)?(?:www\.)?(?:open\.spotify\.com\/playlist\/)(\w{22})(?:\S+)?/;

const regexAnyUrl =
  /^(?:https?:\/\/)?(?:www\.)?[-a-zA-Z0-9@:%._+~#=]{1,256}\.[a-zA-Z0-9()]{1,6}\b(?:[-a-zA-Z0-9()@:%_+.~#?&/=]*)/;

const isUrl = (text: string): Site | null => {
  if (regexYoutubePlaylist1.test(text) || regexYoutubePlaylist2.test(text)) {
    return Site.YoutubePlaylist;
  }

  if (regexYoutube.test(text)) {
    return Site.Youtube;
  }

  if (regexSpotify.test(text)) {
    return Site.SpotifyPlaylist;
  }

  if (regexAnyUrl.test(text)) {
    return Site.Invalid;
  }
  return null;
};

export const getTracks = async (
  text: string,
  channel: TextBasedChannels,
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

      channel.send({ embeds: [onStartEmbed] });
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

      channel.send({ embeds: [onErrorEmbed] });
    },
  };

  if (site === Site.Invalid) {
    const onErrorEmbed = new MessageEmbed()
      .setTitle("Invalid URL")
      .setDescription(
        "Try with Youtube Videos, Youtube or Spotify Playlist or just text"
      )
      .setColor("#ff3333");

    channel.send({ embeds: [onErrorEmbed] });
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

      channel.send({ embeds: [queuedEmbed] });
      return [resTrack];
    } else {
      const onErrorEmbed = new MessageEmbed()
        .setTitle("Invalid text")
        .setDescription(
          "Invalid text to do a search, please try again with a different text"
        )
        .setColor("#ff3333");

      channel.send({ embeds: [onErrorEmbed] });
      return null;
    }
  } else if (site === Site.Youtube) {
    console.log("Youtube");
    const resTrack = await Track.fromUrlYoutube(
      text,
      functionsTrack,
      requestBy.toString()
    );

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

      channel.send({ embeds: [onErrorEmbed] });
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

    await channel.send({ embeds: [onQueuedEmbed] });
    return tracks;
  } else if (site === Site.SpotifyPlaylist) {
    const idPlaylist = regexSpotify.exec(text)![1];

    const encode = Buffer.from(
      `${process.env.CLIENT_ID_SPOTIFY}:${process.env.CLIENT_SECRET_SPOTIFY}`
    ).toString("base64");
    try {
      const params = new URLSearchParams();
      params.append("grant_type", "client_credentials");
      const resAuth = await axios.post(
        "https://accounts.spotify.com/api/token",
        params,
        {
          headers: {
            Authorization: `Basic ${encode}`,
            "Content-Type": "application/x-www-form-urlencoded",
          },
        }
      );
      const bearer = (resAuth.data as any).access_token;

      const resPlaylist = await axios.get(
        `https://api.spotify.com/v1/playlists/${idPlaylist}`,
        {
          headers: {
            Authorization: `Bearer ${bearer}`,
          },
          params: {
            fields: "tracks(items(track(name, artists(name))))",
          },
        }
      );

      for (
        let index = 0;
        index < (resPlaylist.data as any).tracks.items.length;
        index++
      ) {
        const element = (resPlaylist.data as any).tracks.items[index];
        const artists = (element.track.artists as Array<any>)
          .map((e) => e.name)
          .join(", ");

        const track = new Track(
          undefined,
          `${element.track.name} - ${artists}`,
          undefined,
          requestBy.toString(),
          functionsTrack
        );
        tracks.push(track);
      }
      const onQueuedEmbed = new MessageEmbed().setDescription(
        `Queued **${(resPlaylist.data as any).tracks.items.length}** tracks`
      );

      await channel.send({ embeds: [onQueuedEmbed] });
      return tracks;
    } catch (error) {
      console.log("Error Spotify");
    }
  }

  return null;
};
