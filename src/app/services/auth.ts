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

    sessionStorage.removeItem('token');

    sessionStorage.removeItem('user');

  }

  saveToken(token: string) {

    sessionStorage.setItem(
      'token',
      token
    );

  }

  saveUser(user: any) {

    sessionStorage.setItem(
      'user',
      JSON.stringify(user)
    );

  }

  getToken(): string | null {

    return sessionStorage.getItem('token');

  }

  getUser() {

    const user = sessionStorage.getItem('user');

    return user ? JSON.parse(user) : null;

  }

  isLoggedIn(): boolean {

    return !!sessionStorage.getItem('token');

  }

}