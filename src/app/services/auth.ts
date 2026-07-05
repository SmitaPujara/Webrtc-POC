import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';

import { Observable } from 'rxjs';

@Injectable({
  providedIn: 'root'
})
export class AuthService {

  private http = inject(HttpClient);

  private apiUrl = 'http://localhost:3000/api/auth';

  constructor() { }

  register(data: any): Observable<any> {

    return this.http.post(
      `${this.apiUrl}/register`,
      data
    );

  }

  login(data: any): Observable<any> {

    return this.http.post(
      `${this.apiUrl}/login`,
      data
    );

  }

  getProfile(): Observable<any> {

    return this.http.get(
      `${this.apiUrl}/profile`
    );

  }

  logout() {

    localStorage.removeItem('token');

    localStorage.removeItem('user');

  }

  saveToken(token: string) {

    localStorage.setItem(
      'token',
      token
    );

  }

  saveUser(user: any) {

    localStorage.setItem(
      'user',
      JSON.stringify(user)
    );

  }

  getToken(): string | null {

    return localStorage.getItem('token');

  }

  getUser() {

    const user = localStorage.getItem('user');

    return user ? JSON.parse(user) : null;

  }

  isLoggedIn(): boolean {

    return !!localStorage.getItem('token');

  }

}