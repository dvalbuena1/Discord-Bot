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
  public readonly leaveChannel: () => void;
  public queue: Track[];
  public index: number;
  private timeOutIdle: NodeJS.Timeout | undefined;
  private timeOutAlone: NodeJS.Timeout | undefined;
  private readyLock = false;
  private queueLock = false;
  private loop = false;
  private limitQueue = 10;
  private offsetQueue = 0;
  private maxPage = 0;

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
      } else if (
        newState.status === AudioPlayerStatus.Playing &&
        oldState.status !== AudioPlayerStatus.Paused
      ) {
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

  public next(): boolean {
    if (!this.loop && this.queue.length === this.index) {
      if (this.audioPlayer.state.status === AudioPlayerStatus.Playing) {
        this.audioPlayer.stop(true);
      } else if (this.audioPlayer.state.status === AudioPlayerStatus.Idle) {
        return false;
      }
    } else {
      this.processQueue();
    }
    return true;
  }

  public back(): boolean {
    if (this.index === 0) {
      return false;
    }

    if (1 !== this.index) {
      if (this.audioPlayer.state.status === AudioPlayerStatus.Playing) {
        this.index -= 2;
        this.processQueue();
      } else if (this.audioPlayer.state.status === AudioPlayerStatus.Idle) {
        this.index--;
        this.processQueue();
      }
    } else {
      if (this.loop) {
        this.index = this.queue.length - 1;
        this.processQueue();
      } else {
        if (this.audioPlayer.state.status === AudioPlayerStatus.Playing) {
          return false;
        } else if (this.audioPlayer.state.status === AudioPlayerStatus.Idle) {
          this.index--;
          this.processQueue();
        }
      }
    }
    return true;
  }

  public stop(): void {
    this.queueLock = true;
    this.queue = [];
    this.audioPlayer.stop(true);
    if (this.timeOutIdle) clearTimeout(this.timeOutIdle);
    this.queueLock = false;
  }

  public loopQueue(): boolean {
    this.loop = !this.loop;
    return this.loop;
  }

  public shuffleQueue(): void {
    this.queueLock = true;
    for (let index = this.index; index < this.queue.length; index++) {
      const randomFloat = Math.random();
      const randomPos =
        Math.floor(randomFloat * (this.queue.length - this.index)) + this.index;
      [this.queue[index], this.queue[randomPos]] = [
        this.queue[randomPos],
        this.queue[index],
      ];
    }
    this.queueLock = false;
  }

  public getQueue(): string {
    let resQueue = "";
    if (this.queue.length !== 0) {
      const indexStart = this.limitQueue * this.offsetQueue;
      let countLoop = 0;
      for (
        let index = indexStart;
        index < indexStart + this.limitQueue && index < this.queue.length;
        index++
      ) {
        const element = this.queue[index];
        const concat = `${index + 1}) ${
          element.title.length > 38
            ? element.title.slice(0, 37) + "…"
            : element.title + " ".repeat(38 - element.title.length)
        } ${element.duration ? element.duration : ""} \n`;
        if (
          this.index - 1 === index &&
          this.audioPlayer.state.status === AudioPlayerStatus.Playing
        ) {
          resQueue += "     ⬐ current track \n";
          resQueue += concat;
          resQueue += "     ⬑ current track \n";
        } else {
          resQueue += concat;
        }
        countLoop++;
      }
      if (countLoop < this.limitQueue)
        resQueue += "\n".repeat(this.limitQueue - countLoop);
      if (this.offsetQueue === this.maxPage) {
        resQueue += "\n\n  This is the end of the queue!";
      } else {
        const remaining = this.queue.length - indexStart - this.limitQueue;
        resQueue += `\n\n  ${remaining} more track(s)`;
      }
    }
    return resQueue;
  }

  public resetQueueList(): void {
    this.offsetQueue = Math.ceil(this.index / this.limitQueue) - 1;
    this.maxPage = Math.ceil(this.queue.length / this.limitQueue) - 1;
  }
  public firstQueueList(): void {
    this.offsetQueue = 0;
  }
  public backQueueList(): void {
    this.offsetQueue--;
    if (this.offsetQueue < 0) this.offsetQueue = 0;
  }
  public nextQueueList(): void {
    this.offsetQueue++;
    if (this.offsetQueue > this.maxPage) this.offsetQueue = this.maxPage;
  }
  public lastQueueList(): void {
    this.offsetQueue = this.maxPage;
  }

  public jump(newIndex: number): void {
    this.index = newIndex;
    this.processQueue();
  }

  public remove(index: number, callback: () => void): Track | null {
    if (
      this.audioPlayer.state.status === AudioPlayerStatus.Playing &&
      index === this.index - 1
    ) {
      callback();
      return null;
    }

    this.queueLock = true;
    const removed = this.queue.splice(index, 1)[0];
    if (index < this.index) this.index = this.index - 1;
    this.queueLock = false;

    return removed;
  }

  public pause(): boolean {
    return this.audioPlayer.pause();
  }
  public play(): boolean {
    return this.audioPlayer.unpause();
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
        this.audioPlayer.stop(true);
        this.timeOutIdle = setTimeout(this.leaveChannel, 600000);
        return;
      }
    }

    clearTimeout(this.timeOutIdle!);

    // Lock the queue to guarantee safe access
    this.queueLock = true;

    // Take the first item from the queue. This is guaranteed to exist due to the non-empty check above.
    const nextTrack = this.queue[this.index];
    try {
      // Attempt to convert the Track into an AudioResource (i.e. start streaming the video)
      const resource = await nextTrack.createAudioResource();
      console.log(nextTrack);
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
