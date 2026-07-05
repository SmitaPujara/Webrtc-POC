import { Component, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router, RouterLink } from '@angular/router';
import {
  FormBuilder,
  ReactiveFormsModule,
  Validators
} from '@angular/forms';

import { AuthService } from '../../services/auth';

@Component({
  selector: 'app-login',
  standalone: true,
  imports: [
    CommonModule,
    ReactiveFormsModule,
    RouterLink
  ],
  templateUrl: './login.html',
  styleUrl: './login.css'
})
export class Login {

  private fb = inject(FormBuilder);
  private authService = inject(AuthService);
  private router = inject(Router);

  submitted = false;

  errorMessage = '';

  loginForm = this.fb.group({

    email: [
      '',
      [
        Validators.required,
        Validators.email
      ]
    ],

    password: [
      '',
      [
        Validators.required,
        Validators.minLength(6)
      ]
    ]

  });

  login() {

  this.submitted = true;

  this.errorMessage = '';

  if (this.loginForm.invalid) {
    return;
  }

  this.authService.login(this.loginForm.value).subscribe({

    next: (response: any) => {

      this.authService.saveToken(response.token);

      this.authService.saveUser(response.user);

      this.router.navigate(['/video-call']);

    },

    error: (error: any) => {

  console.log('Status:', error.status);
  console.log('Error:', error);
  console.log('Backend Response:', error.error);

  this.errorMessage =
    error.error?.message || 'Login failed';

  alert(this.errorMessage);

}

  });

}

}