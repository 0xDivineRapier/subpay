import type { NextAuthOptions } from 'next-auth';
import CredentialsProvider from 'next-auth/providers/credentials';
import bcrypt from 'bcrypt';

// In production: query operators table. For MVP: env-based credentials.
export const authOptions: NextAuthOptions = {
  providers: [
    CredentialsProvider({
      name: 'credentials',
      credentials: {
        email: { label: 'Email', type: 'email' },
        password: { label: 'Password', type: 'password' },
      },
      async authorize(credentials) {
        if (!credentials?.email || !credentials?.password) return null;

        const adminEmail = process.env['ADMIN_EMAIL'];
        const adminPasswordHash = process.env['ADMIN_PASSWORD_HASH'];

        if (!adminEmail || !adminPasswordHash) return null;
        if (credentials.email !== adminEmail) return null;

        const valid = await bcrypt.compare(credentials.password, adminPasswordHash);
        if (!valid) return null;

        return {
          id: 'operator-1',
          email: credentials.email,
          name: 'Operator',
        };
      },
    }),
  ],
  session: { strategy: 'jwt' },
  pages: { signIn: '/auth/login' },
  callbacks: {
    async jwt({ token, user }) {
      if (user) token['operatorId'] = user.id;
      return token;
    },
    async session({ session, token }) {
      if (session.user) {
        (session.user as { operatorId?: string }).operatorId = token['operatorId'] as string;
      }
      return session;
    },
  },
};
