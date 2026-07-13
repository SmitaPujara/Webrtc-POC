import { Injectable, NgZone } from '@angular/core';
import { io, Socket } from 'socket.io-client';

export interface AppUser {
  username: string;
  status: 'ONLINE' | 'RINGING' | 'BUSY';
}

@Injectable({
  providedIn: 'root'
})
export class WebrtcService {

  public socket!: Socket;

  public peerConnection!: RTCPeerConnection;
  private remoteVideo!: HTMLVideoElement;
  private pendingIceCandidates: RTCIceCandidateInit[] = [];

  public username = '';
  public remoteUsername: string | null = null;

  private isInCall = false;
  private isNegotiating = false;
  private isCaller = false;

  public onCallStatusChange:
    ((status: string) => void) | null = null;

  public onUsersListChange:
    ((users: AppUser[]) => void) | null = null;

  public onIncomingCallRequest:
    ((from: string) => void) | null = null;

  public onGetLocalStream:
    (() => Promise<MediaStream | null>) | null = null;

  public onCallFailed:
    ((reason: string) => void) | null = null;

  public onCallRejected:
    (() => void) | null = null;

    public onCallCancelled:
    (() => void) | null = null;

  public onRemoteHangup: (() => void) | null = null;

  public onConnectionStateChange:
    ((connected: boolean) => void) | null = null;

  constructor(private ngZone: NgZone) {

    this.socket = io('http://localhost:3000');

    this.createPeerConnection();
    this.registerEvents();
  }

 login(username: string) {
  this.username = username;
  if (!this.socket.connected) {
    this.socket.connect();   // 👈 add this
  }
  this.socket.emit('login', username);
}
  callUser(to: string) {
    this.remoteUsername = to;
    this.isCaller = true;

    this.updateCallStatus('Ringing...');

    this.socket.emit('call-user', { to });
  }

   cancelCall() {
    this.socket.emit('cancel-call');
    this.resetCallState();
    this.updateCallStatus('Idle');
  }

  acceptCall() {
    this.socket.emit('accept-call');
    this.updateCallStatus('Connecting...');
  }

  rejectCall() {
    this.socket.emit('reject-call');
    this.resetCallState();
    this.updateCallStatus('Idle');
  }

  private updateCallStatus(status: string) {
    this.ngZone.run(() => {
      this.onCallStatusChange?.(status);
    });
  }

  private updateUsersList(users: AppUser[]) {
    this.ngZone.run(() => {
      this.onUsersListChange?.(users);
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

      if (this.username) {
        this.socket.emit('login', this.username);
      }
    });

    this.socket.on('users-list', (list: AppUser[]) => {
      console.log('USERS LIST RECEIVED:', list);
      this.updateUsersList(list);
    });

    this.socket.on('call-failed', (reason: string) => {
      this.resetCallState();
      this.updateCallStatus('Idle');

      this.ngZone.run(() => {
        this.onCallFailed?.(reason);
      });
    });

    this.socket.on('incoming-call', ({ from }: { from: string }) => {

      if (this.isInCall || this.isNegotiating) {
        return;
      }

      this.remoteUsername = from;
      this.isCaller = false;

      this.updateCallStatus(`Incoming call from ${from}`);

      this.ngZone.run(() => {
        this.onIncomingCallRequest?.(from);
      });
    });

    this.socket.on('call-accepted', async () => {

      if (!this.isCaller) {
        return;
      }

      try {
        this.isNegotiating = true;
        this.updateCallStatus('Connecting...');

        const localStream = await this.onGetLocalStream?.();

        if (localStream) {
          localStream.getTracks().forEach(track => {
            this.peerConnection.addTrack(track, localStream);
          });
        }

        const offer =
          await this.peerConnection.createOffer();

        await this.peerConnection.setLocalDescription(offer);

        this.socket.emit('offer', offer);

      } catch (error) {
        console.error(error);
        this.resetCallState();
        this.updateCallStatus('Call Failed');
      }
    });

    this.socket.on('call-rejected', () => {
      this.resetCallState();
      this.updateCallStatus('Call Rejected');

      this.ngZone.run(() => {
        this.onCallRejected?.();
      });
    });
    this.socket.on('call-cancelled', () => {          // 👈 ADD THIS BLOCK
  this.resetCallState();
  this.updateCallStatus('Idle');

  this.ngZone.run(() => {
    this.onCallCancelled?.();
  });
});

    this.socket.on(
      'offer',
      async (offer) => {
        if (this.isCaller || this.isInCall) {
          return;
        }

        try {
          this.isNegotiating = true;
          this.updateCallStatus('Connecting...');

          const localStream = await this.onGetLocalStream?.();
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

  hangUp() {
    this.resetCallState();
    this.socket.emit('hangup');
  }

  private resetCallState() {
    this.isInCall = false;
    this.isNegotiating = false;
    this.isCaller = false;
    this.remoteUsername = null;
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
  logoutCleanup() {
    this.resetCallState();
  // Close peer connection
  if (this.peerConnection) {
    this.peerConnection.close();
  }
  // Disconnect socket
  if (this.socket) {
    this.socket.disconnect();
  }

}
}