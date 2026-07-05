import {
  Component,
  ViewChild,
  ElementRef,
  AfterViewInit,
  signal
} from '@angular/core';

import { Router } from '@angular/router';

import { AuthService } from '../../services/auth';
import { WebrtcService } from '../../services/webrtc-service';

@Component({
  selector: 'app-video-call',
  standalone: true,
  templateUrl: './video-call.html',
  styleUrl: './video-call.css'
})
export class VideoCallComponent implements AfterViewInit {

  @ViewChild('localVideo')
  localVideo!: ElementRef<HTMLVideoElement>;

  @ViewChild('remoteVideo')
  remoteVideo!: ElementRef<HTMLVideoElement>;

  localStream: MediaStream | null = null;

  isMuted = signal(false);
  isCameraOff = signal(false);

  callStatus = signal('Idle');

  roomCount = signal(0);

  roomId = signal('demo-room');

  isSwapped = signal(false);

  isRoomJoined = false;

  isCallConnected = false;

  swapVideos() {
    this.isSwapped.update(v => !v);
  }

  constructor(
    public webrtc: WebrtcService,
    private authService: AuthService,
    private router: Router
  ) {

    this.webrtc.onCallStatusChange = (status: string) => {
      this.callStatus.set(status);
    };

    this.webrtc.onRoomCountChange = (count: number) => {
      this.roomCount.set(count);
    };

    this.webrtc.onRemoteHangup = () => {
      this.endCall(false);
    };

this.webrtc.onConnectionStateChange = (connected) => {
  this.isCallConnected = connected;
};
    this.webrtc.onIncomingCall = async () => {

      try {

        const stream =
          await navigator.mediaDevices.getUserMedia({

            video: true,
            audio: true

          });

        this.localStream = stream;

        this.localVideo.nativeElement.srcObject = stream;

        return stream;

      }
      catch (error) {

        console.error(error);

        return null;

      }

    };

  }

  ngAfterViewInit() {

    this.webrtc.setRemoteVideo(
      this.remoteVideo.nativeElement
    );

  }

  joinRoom() {

    if (this.isRoomJoined) {
      return;
    }

    this.webrtc.joinRoom(this.roomId());

    this.callStatus.set('Waiting for participant...');

    this.isRoomJoined = true;

  }

  async startCall() {

    if (this.roomCount() < 2) {

      this.callStatus.set('Need 2 tabs in the same room');

      return;

    }

    if (this.localStream) {
      return;
    }

    try {

      this.callStatus.set('Calling...');

      this.isCallConnected = true;

      this.webrtc.beginCall();

      const stream =
        await navigator.mediaDevices.getUserMedia({

          video: true,
          audio: true

        });

      this.localStream = stream;

      this.localVideo.nativeElement.srcObject = stream;

      stream.getTracks().forEach(track => {

        this.webrtc.peerConnection.addTrack(
          track,
          stream
        );

      });

      const offer =
        await this.webrtc.peerConnection.createOffer();

      await this.webrtc.peerConnection
        .setLocalDescription(offer);

      this.webrtc.socket.emit(
        'offer',
        offer
      );

    }
    catch (error) {

      this.callStatus.set('Permission Denied');

      console.error(error);

    }

  }

  toggleMute() {

    if (!this.localStream) {
      return;
    }

    this.isMuted.update(muted => !muted);

    const audioEnabled = !this.isMuted();

    this.localStream.getAudioTracks().forEach(track => {

      track.enabled = audioEnabled;

    });

    this.webrtc.peerConnection.getSenders().forEach(sender => {

      if (sender.track?.kind === 'audio') {

        sender.track.enabled = audioEnabled;

      }

    });

  }

  toggleCamera() {

    if (!this.localStream) {
      return;
    }

    this.isCameraOff.update(off => !off);

    const videoEnabled = !this.isCameraOff();

    this.localStream.getVideoTracks().forEach(track => {

      track.enabled = videoEnabled;

    });

    this.webrtc.peerConnection.getSenders().forEach(sender => {

      if (sender.track?.kind === 'video') {

        sender.track.enabled = videoEnabled;

      }

    });

  }

  endCall(notifyPeer = true) {

    this.cleanupCall(notifyPeer);

  }

  private cleanupCall(notifyPeer: boolean) {

    if (notifyPeer) {

      this.webrtc.hangUp();

    }

    this.isCallConnected = false;

    this.isRoomJoined = false;

    if (this.localStream) {

      this.localStream.getTracks().forEach(track => track.stop());

      this.localStream = null;

    }

    this.localVideo.nativeElement.srcObject = null;

    this.remoteVideo.nativeElement.srcObject = null;

    this.webrtc.closeConnection();

    this.callStatus.set('Call Ended');

    this.isMuted.set(false);

    this.isCameraOff.set(false);

  }

  logout() {

    if (this.isCallConnected) {
      return;
    }

    this.authService.logout();

    this.router.navigate(['/login']);

  }

}