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
  selector: 'app-register',
  standalone: true,
  imports: [
    CommonModule,
    ReactiveFormsModule,
    RouterLink
  ],
  templateUrl: './register.html',
  styleUrl: './register.css'
})
export class Register {

  private fb = inject(FormBuilder);
  private authService = inject(AuthService);
  private router = inject(Router);

  submitted = false;

  errorMessage = '';
  successMessage = '';
registerForm = this.fb.group({

  username: [
    '',
    [
      Validators.required,
      Validators.minLength(3),
      Validators.pattern(/^[A-Za-z ]+$/)
    ]
  ],

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
      Validators.pattern(
        /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[@$!%*?&])[A-Za-z\d@$!%*?&]{8,}$/
      )
    ]
  ]

});

  register() {

    this.submitted = true;

    this.errorMessage = '';
    this.successMessage = '';

    if (this.registerForm.invalid) {
      return;
    }

    this.authService.register(this.registerForm.value).subscribe({

      next: (response: any) => {

        this.successMessage = response.message;

        alert('Registration Successful');

        this.registerForm.reset();

        setTimeout(() => {

          this.router.navigate(['/login']);

        }, 1000);

      },

      error: (error) => {

        this.errorMessage =
          error.error?.message || 'Registration failed';

      }

    });

  }
  

}