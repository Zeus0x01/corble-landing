import { DefaultSession } from 'next-auth';

declare module 'next-auth' {
  interface Session {
    user: {
      role: 'ADMIN' | 'MEMBER';
      id: string;
    } & DefaultSession['user'];
  }
}
