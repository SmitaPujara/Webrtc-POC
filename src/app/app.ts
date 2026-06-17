import { Component, signal } from '@angular/core';
import { RouterOutlet } from '@angular/router';
import { VideoCallComponent } from './components/video-call/video-call';

@Component({
  selector: 'app-root',
  imports: [VideoCallComponent],
  templateUrl: './app.html',
  styleUrl: './app.css'
})
export class App {
  protected readonly title = signal('webrtc-demo');
}
