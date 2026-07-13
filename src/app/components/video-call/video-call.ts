import {
  Component,
  ViewChild,
  ElementRef,
  AfterViewInit,
  signal,
  computed
} from '@angular/core';

import { Router } from '@angular/router';

import { AuthService } from '../../services/auth';
import { WebrtcService, AppUser } from '../../services/webrtc-service';

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

  username = signal('');

  users = signal<AppUser[]>([]);

  // never show yourself in the callable list
  otherUsers = computed(() =>
    this.users().filter(u => u.username !== this.username())
  );

  incomingCallFrom = signal<string | null>(null);

  isSwapped = signal(false);

  isCallConnected = signal(false);

   // true from the moment you press "Call" until it's accepted/failed/cancelled
  isRinging = signal(false);

  // true whenever we're either ringing out or already connected
  inCallFlow = computed(() =>
    this.isRinging() || this.isCallConnected()
  );

  swapVideos() {
    this.isSwapped.update(v => !v);
  }

  constructor(
    public webrtc: WebrtcService,
    private authService: AuthService,
    private router: Router
  ) {

    const storedUser = this.authService.getUser();

    console.log('Stored user:', storedUser);

    const currentUsername =
      storedUser?.username ??
      storedUser?.name ??
      storedUser?.email ??
      '';

    if (!currentUsername) {
      console.warn('No username found — check AuthService.getUser() shape, or log in again.');
    }

    this.username.set(currentUsername);
    this.webrtc.login(currentUsername);

    this.webrtc.onCallStatusChange = (status: string) => {
      this.callStatus.set(status);
    };

    this.webrtc.onUsersListChange = (list: AppUser[]) => {
      this.users.set(list);
    };

    this.webrtc.onIncomingCallRequest = (from: string) => {
      this.incomingCallFrom.set(from);
    };

   this.webrtc.onCallFailed = (reason: string) => {
      this.isRinging.set(false);
      this.callStatus.set(reason);
    };

    this.webrtc.onCallRejected = () => {
      this.isRinging.set(false);
      this.callStatus.set('Call Rejected');
    };

    this.webrtc.onCallCancelled = () => {
      this.incomingCallFrom.set(null);
      this.isRinging.set(false);
      this.callStatus.set('Idle');
    };

    this.webrtc.onRemoteHangup = () => {
      this.endCall(false);
    };

    this.webrtc.onConnectionStateChange = (connected) => {
      this.isCallConnected.set(connected);
    };

    this.webrtc.onGetLocalStream = async () => {

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

  callUser(target: AppUser) {

    if (target.status !== 'ONLINE') {
      return;
    }
    this.isRinging.set(true);
    this.callStatus.set(`Calling ${target.username}...`);

    this.webrtc.callUser(target.username);

  }

  cancelCall() {

    this.webrtc.cancelCall();
    this.isRinging.set(false);
    this.callStatus.set('Idle');

  }
  acceptCall() {

    this.incomingCallFrom.set(null);
    this.webrtc.acceptCall();

  }

  rejectCall() {

    this.incomingCallFrom.set(null);
    this.webrtc.rejectCall();

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

    this.isCallConnected.set(false);

    this.incomingCallFrom.set(null);

    if (this.localStream) {

      this.localStream.getTracks().forEach(track => track.stop());

      this.localStream = null;

    }

    this.localVideo.nativeElement.srcObject = null;

    this.remoteVideo.nativeElement.srcObject = null;

    this.webrtc.closeConnection();

    this.callStatus.set('Idle');

    this.isMuted.set(false);

    this.isCameraOff.set(false);

  }
 
  handleEndButton() {

    if (this.isCallConnected()) {
      this.endCall();
    } else if (this.isRinging()) {
      this.cancelCall();
    }

  }
  canLogout = computed(() =>
  !this.isCallConnected() &&
  !this.isRinging() &&
  !this.incomingCallFrom()
);

  logout() {
if (!this.canLogout()) {
    return;
  }
    this.webrtc.logoutCleanup();
    this.authService.logout();

    this.router.navigate(['/login']);

  }
}