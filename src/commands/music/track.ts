import {
  AudioResource,
  createAudioResource,
  demuxProbe,
} from "@discordjs/voice";
import ytdl from "ytdl-core";
import ytsr, { Item, Result, Video } from "ytsr";

interface TrackData {
  url: string | undefined;
  title: string;
  onStart: () => void;
  onFinish: () => void;
  onError: (error: Error) => void;
}

interface functionsTrack {
  onStart: (track: Track) => void;
  onFinish: (track: Track) => void;
  onError: (track: Track, error: Error) => void;
}

export class Track implements TrackData {
  public url: string | undefined;
  public title: string;
  public readonly onStart: () => void;
  public readonly onFinish: () => void;
  public readonly onError: (error: Error) => void;

  public constructor(
    url: string | undefined,
    title: string,
    { onStart, onFinish, onError }: functionsTrack
  ) {
    this.url = url;
    this.title = title;
    this.onStart = () => onStart(this);
    this.onFinish = () => onFinish(this);
    this.onError = (error) => onError(this, error);
  }

  public createAudioResource(): Promise<AudioResource<Track>> {
    return new Promise((resolve, reject) => {
      const audioResource = () => {
        const stream = ytdl(this.url!, { filter: "audioonly", dlChunkSize: 0 });
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
      };

      if (!this.url) {
        Track.getVideo(this.title).then((video) => {
          this.title = video.title;
          this.url = video.url;
          audioResource();
        });
      } else {
        audioResource();
      }
    });
  }

  private static async getVideo(text: string): Promise<any> {
    const filters = await ytsr.getFilters(text);
    const filter = filters.get("Type")?.get("Video");
    if (filter != null) {
      const info = await ytsr(filter.url!, { limit: 1 });
      const videos = info.items as Video[];
      return { url: videos[0].url, title: videos[0].title };
    }
    return null;
  }

  public static async fromText(
    text: string,
    methods: functionsTrack
  ): Promise<Track | null> {
    const video = await this.getVideo(text);
    return new Track(video.url, video.title, methods);
  }

  public static async fromUrlYoutube(
    url: string,
    methods: functionsTrack
  ): Promise<Track | null> {
    const info = await ytdl.getInfo(url);
    return new Track(
      info.videoDetails.video_url,
      info.videoDetails.title,
      methods
    );
  }
}
