import {
  AudioResource,
  createAudioResource,
  demuxProbe,
} from "@discordjs/voice";
import ytdl from "ytdl-core";
import ytsr, { Item, Result, Video } from "ytsr";

interface TrackData {
  url: string;
  title: string;
  onStart: () => void;
  onFinish: () => void;
  onError: (error: Error) => void;
}

export class Track implements TrackData {
  public readonly url: string;
  public readonly title: string;
  public readonly onStart: () => void;
  public readonly onFinish: () => void;
  public readonly onError: (error: Error) => void;

  private constructor({ url, title, onStart, onFinish, onError }: TrackData) {
    this.url = url;
    this.title = title;
    this.onStart = onStart;
    this.onFinish = onFinish;
    this.onError = onError;
  }

  public createAudioResource(): Promise<AudioResource<Track>> {
    return new Promise((resolve, reject) => {
      const stream = ytdl(this.url, { filter: "audioonly", dlChunkSize: 0 });
      const onError = (error: Error) => {
        stream.resume();
        reject(error);
      };
      demuxProbe(stream)
        .then((probe) =>
          resolve(
            createAudioResource(stream, {
              metadata: this,
              inputType: probe.type,
            })
          )
        )
        .catch(onError);
    });
  }

  public static async fromText(
    text: string,
    methods: Pick<Track, "onStart" | "onFinish" | "onError">
  ): Promise<Track | null> {
    const filters = await ytsr.getFilters(text);
    const filter = filters.get("Type")?.get("Video");
    if (filter != null) {
      const info = await ytsr(filter.url!, { limit: 1 });
      const videos = info.items as Video[];
      return new Track({
        url: videos[0].url,
        title: videos[0].title,
        onStart: methods.onStart,
        onFinish: methods.onFinish,
        onError: methods.onError,
      });
    }
    return null;
  }
}
