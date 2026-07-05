import { Injectable, NgZone } from '@angular/core';
import { io, Socket } from 'socket.io-client';

@Injectable({
  providedIn: 'root'
})
export class WebrtcService {

  public socket!: Socket;

  public peerConnection!: RTCPeerConnection;
  private remoteVideo!: HTMLVideoElement;
  private pendingIceCandidates: RTCIceCandidateInit[] = [];
  private roomId = 'demo-room';
  isRoomJoined = false;
  isCallConnected = false;

  public onCallStatusChange:
    ((status: string) => void) | null = null;

  public onRoomCountChange:
    ((count: number) => void) | null = null;

  public onIncomingCall:
    (() => Promise<MediaStream | null>) | null = null;

  public onRemoteHangup: (() => void) | null = null;

  public onConnectionStateChange:
  ((connected: boolean) => void) | null = null;

  private isInCall = false;
  private isNegotiating = false;
  private isCaller = false;

  constructor(private ngZone: NgZone) {

    this.socket = io('http://localhost:3000');

    this.createPeerConnection();
    this.registerEvents();
    this.joinRoom(this.roomId);
  }

  joinRoom(roomId: string) {
    this.roomId = roomId;
    this.socket.emit('join-room', roomId);
  }

  private updateCallStatus(status: string) {
    this.ngZone.run(() => {
      this.onCallStatusChange?.(status);
    });
  }

  private updateRoomCount(count: number) {
    this.ngZone.run(() => {
      this.onRoomCountChange?.(count);
    });
  }

  private async addIceCandidate(
    candidate: RTCIceCandidateInit
  ) {
    if (!this.peerConnection.remoteDescription) {
      this.pendingIceCandidates.push(candidate);
      return;
    }

    await this.peerConnection.addIceCandidate(
      new RTCIceCandidate(candidate)
    );
  }

  private async flushPendingIceCandidates() {
    const candidates = this.pendingIceCandidates;
    this.pendingIceCandidates = [];

    for (const candidate of candidates) {
      try {
        await this.peerConnection.addIceCandidate(
          new RTCIceCandidate(candidate)
        );
      } catch (error) {
        console.error(error);
      }
    }
  }

  setRemoteVideo(
    videoElement: HTMLVideoElement
  ) {
    this.remoteVideo = videoElement;
  }

  createPeerConnection() {

    this.peerConnection =
      new RTCPeerConnection({
        iceServers: [
          {
            urls:
              'stun:stun.l.google.com:19302'
          }
        ]
      });

    this.peerConnection.onconnectionstatechange = () => {

  console.log(
    'Connection State:',
    this.peerConnection.connectionState
  );

  switch (this.peerConnection.connectionState) {

    case 'connecting':

      this.updateCallStatus('Connecting...');
      break;

   case 'connected':

  this.isInCall = true;
  this.isNegotiating = false;

  this.updateCallStatus('Connected');

  this.ngZone.run(() => {
    this.onConnectionStateChange?.(true);
  });

  break;

    case 'disconnected':
case 'failed':

  this.ngZone.run(() => {
    this.onConnectionStateChange?.(false);
  });

  if (this.isInCall || this.isNegotiating) {

    this.resetCallState();

    this.ngZone.run(() => {
      this.onRemoteHangup?.();
    });

  }

  break;

    case 'closed':

  this.ngZone.run(() => {
    this.onConnectionStateChange?.(false);
  });

  break;
}

};

    this.peerConnection.onicecandidate =
      (event) => {

        if (event.candidate) {

          this.socket.emit(
            'ice-candidate',
            event.candidate
          );
        }
      };

    this.peerConnection.ontrack =
      (event) => {

        if (this.remoteVideo && event.streams[0]) {

          this.remoteVideo.srcObject =
            event.streams[0];
        }
      };
  }

  registerEvents() {

    this.socket.on('connect', () => {
      console.log(
        'Connected:',
        this.socket.id
      );
      this.joinRoom(this.roomId);
    });

    this.socket.on('room-count', (count: number) => {
      this.updateRoomCount(count);
    });

    this.socket.on(
      'offer',
      async (offer) => {
        if (this.isCaller || this.isNegotiating || this.isInCall) {
          return;
        }

        try {
          this.isNegotiating = true;
          this.updateCallStatus('Incoming call...');

          const localStream = await this.onIncomingCall?.();
          if (localStream) {
            localStream.getTracks().forEach(track => {
              this.peerConnection.addTrack(track, localStream);
            });
          }

          await this.peerConnection.setRemoteDescription(
            new RTCSessionDescription(offer)
          );

          const answer =
            await this.peerConnection.createAnswer();

          await this.peerConnection.setLocalDescription(answer);

          await this.flushPendingIceCandidates();

          this.socket.emit('answer', answer);
        } catch (error) {
          console.error(error);
          this.resetCallState();
          this.updateCallStatus('Call Failed');
        }
      }
    );

    this.socket.on(
      'answer',
      async (answer) => {
        if (!this.isCaller) {
          return;
        }

        try {
          await this.peerConnection.setRemoteDescription(
            new RTCSessionDescription(answer)
          );

          await this.flushPendingIceCandidates();
        } catch (error) {
          console.error(error);
          this.resetCallState();
          this.updateCallStatus('Call Failed');
        }
      }
    );

    this.socket.on(
      'ice-candidate',
      async (candidate) => {
        try {
          await this.addIceCandidate(candidate);
        } catch (error) {
          console.error(error);
        }
      }
    );

    this.socket.on('hangup', () => {
      if (!this.isInCall && !this.isNegotiating) {
        return;
      }

      this.resetCallState();
      this.ngZone.run(() => {
        this.onRemoteHangup?.();
      });
    });
  }

  beginCall() {
    this.isCaller = true;
    this.isNegotiating = true;
  }

  hangUp() {
    this.resetCallState();
    this.socket.emit('hangup');
  }

  private resetCallState() {
    this.isInCall = false;
    this.isNegotiating = false;
    this.isCaller = false;
  }

  closeConnection() {

    this.peerConnection
      .getSenders()
      .forEach(sender => {

        sender.track?.stop();
      });

    this.peerConnection.close();

    this.pendingIceCandidates = [];
    this.resetCallState();
    this.createPeerConnection();
  }
}
