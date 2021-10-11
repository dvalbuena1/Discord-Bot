import {
  AudioPlayer,
  AudioPlayerStatus,
  AudioResource,
  createAudioPlayer,
  entersState,
  VoiceConnection,
  VoiceConnectionDisconnectReason,
  VoiceConnectionStatus,
} from "@discordjs/voice";
import { VoiceChannel } from "discord.js";
import { promisify } from "util";
import { Track } from "./track";

const wait = promisify(setTimeout);
export class MusicSubscription {
  public readonly voiceConnection: VoiceConnection;
  public readonly audioPlayer: AudioPlayer;
  public readonly voiceChannel: VoiceChannel;
  public leaveChannel: () => void;
  public queueLock = false;
  public readyLock = false;
  public loop = false;
  public queue: Track[];
  public index: number;
  public timeOutIdle: NodeJS.Timeout | undefined;
  public timeOutAlone: NodeJS.Timeout | undefined;
  public constructor(
    voiceConnection: VoiceConnection,
    leaveChannel: () => void,
    voiceChannel: VoiceChannel
  ) {
    this.voiceConnection = voiceConnection;
    this.voiceChannel = voiceChannel;
    this.audioPlayer = createAudioPlayer();
    this.leaveChannel = leaveChannel;
    this.queue = [];
    this.index = 0;
    this.voiceConnection.on("stateChange", async (_, newState) => {
      console.log(newState.status);
      if (newState.status === VoiceConnectionStatus.Disconnected) {
        if (
          newState.reason === VoiceConnectionDisconnectReason.WebSocketClose &&
          newState.closeCode === 4014
        ) {
          /*
                If the WebSocket closed with a 4014 code, this means that we should not manually attempt to reconnect,
                but there is a chance the connection will recover itself if the reason of the disconnect was due to
                switching voice channels. This is also the same code for the bot being kicked from the voice channel,
                so we allow 5 seconds to figure out which scenario it is. If the bot has been kicked, we should destroy
                the voice connection.
            */
          try {
            await entersState(
              this.voiceConnection,
              VoiceConnectionStatus.Connecting,
              5_000
            );
            // Probably moved voice channel
          } catch {
            this.voiceConnection.destroy();
            // Probably removed from voice channel
          }
        } else if (this.voiceConnection.rejoinAttempts < 5) {
          /*
                The disconnect in this case is recoverable, and we also have <5 repeated attempts so we will reconnect.
            */
          await wait((this.voiceConnection.rejoinAttempts + 1) * 5_000);
          this.voiceConnection.rejoin();
        } else {
          /*
                The disconnect in this case may be recoverable, but we have no more remaining attempts - destroy.
            */
          this.voiceConnection.destroy();
        }
      } else if (newState.status === VoiceConnectionStatus.Destroyed) {
        /*
            Once destroyed, stop the subscription
        */
        this.stop();
      } else if (
        !this.readyLock &&
        (newState.status === VoiceConnectionStatus.Connecting ||
          newState.status === VoiceConnectionStatus.Signalling)
      ) {
        /*
                In the Signalling or Connecting states, we set a 20 second time limit for the connection to become ready
                before destroying the voice connection. This stops the voice connection permanently existing in one of these
                states.
            */
        this.readyLock = true;
        try {
          await entersState(
            this.voiceConnection,
            VoiceConnectionStatus.Ready,
            20e3
          );
        } catch {
          if (
            this.voiceConnection.state.status !==
            VoiceConnectionStatus.Destroyed
          )
            this.voiceConnection.destroy();
        } finally {
          this.readyLock = false;
        }
      }
    });

    this.audioPlayer.on("stateChange", (oldState, newState) => {
      if (
        newState.status === AudioPlayerStatus.Idle &&
        oldState.status !== AudioPlayerStatus.Idle
      ) {
        // If the Idle state is entered from a non-Idle state, it means that an audio resource has finished playing.
        // The queue is then processed to start playing the next track, if one is available.
        if (!this.timeOutAlone && voiceChannel.members.size === 1) {
          this.timeOutAlone = setTimeout(this.leaveChannel, 600000);
        } else if (voiceChannel.members.size > 1 && this.timeOutAlone) {
          clearTimeout(this.timeOutAlone);
        }
        void this.processQueue();
      } else if (newState.status === AudioPlayerStatus.Playing) {
        // If the Playing state has been entered, then a new track has started playback.
        (newState.resource as AudioResource<Track>).metadata.onStart();
      }
    });

    this.audioPlayer.on("error", console.error);
    voiceConnection.subscribe(this.audioPlayer);
  }

  public enqueue(track: Track): void {
    this.queue.push(track);
    if (this.audioPlayer.state.status === AudioPlayerStatus.Idle) {
      this.processQueue();
    }
  }

  public next(callback: () => void): void {
    if (this.queue.length === this.index) {
      if (this.audioPlayer.state.status === AudioPlayerStatus.Playing) {
        this.audioPlayer.stop(true);
      } else if (this.audioPlayer.state.status === AudioPlayerStatus.Idle) {
        callback();
      }
    } else {
      this.processQueue();
    }
  }

  public stop(): void {
    this.queueLock = true;
    this.queue = [];
    this.audioPlayer.stop(true);
    this.queueLock = false;
  }

  public loopQueue(): boolean {
    this.loop = !this.loop;
    return this.loop;
  }

  private async processQueue(): Promise<void> {
    // If the queue is locked (already being processed)
    if (this.queueLock) {
      return;
    }

    if (this.queue.length === this.index) {
      if (this.loop) {
        this.index = 0;
      } else if (!this.timeOutAlone) {
        this.timeOutIdle = setTimeout(this.leaveChannel, 600000);
        return;
      }
    }

    clearTimeout(this.timeOutIdle!);

    // Lock the queue to guarantee safe access
    this.queueLock = true;

    // Take the first item from the queue. This is guaranteed to exist due to the non-empty check above.
    const nextTrack = this.queue[this.index];
    console.log(nextTrack);
    try {
      // Attempt to convert the Track into an AudioResource (i.e. start streaming the video)
      const resource = await nextTrack.createAudioResource();
      this.audioPlayer.play(resource);
      this.queueLock = false;
      this.index++;
    } catch (error) {
      // If an error occurred, try the next item of the queue instead
      nextTrack.onError(error as Error);
      this.queueLock = false;
      this.index++;
      return this.processQueue();
    }
  }
}