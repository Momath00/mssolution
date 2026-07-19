'use client';

import Image from 'next/image';
import { useRouter } from 'next/navigation';
import { useState } from 'react';

import { apiUrlClient } from '@/lib/api';

export default function LoginPage() {
  const router = useRouter();
  const [erreur, setErreur] = useState<string | null>(null);
  const [enCours, setEnCours] = useState(false);

  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setEnCours(true);
    setErreur(null);
    const form = e.currentTarget;
    const username = (form.elements.namedItem('username') as HTMLInputElement)
      .value;
    const password = (form.elements.namedItem('password') as HTMLInputElement)
      .value;

    try {
      const res = await fetch(apiUrlClient('/api/auth/token/'), {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username, password }),
      });
      if (!res.ok) {
        setErreur('Nom d\'utilisateur ou mot de passe invalide.');
        return;
      }
      router.push('/dashboard');
      router.refresh();
    } catch {
      setErreur('Impossible de joindre le serveur.');
    } finally {
      setEnCours(false);
    }
  }

  return (
    <div className="flex flex-1 items-center justify-center bg-white px-6 py-16">
      <div className="w-full max-w-md rounded-2xl bg-white p-8 shadow-xl">
        <div className="bg-navy -mx-8 -mt-8 mb-8 flex flex-col items-center rounded-t-2xl px-8 py-8 text-center">
          <Image
            src="/logo-icon-trimmed.png"
            alt="MS Solution Informatique"
            width={56}
            height={56}
            priority
          />
          <h1 className="mt-4 text-2xl font-bold text-white">Connexion</h1>
          <p className="mt-1 text-sm text-white/60">
            Accès réservé à l&apos;administration de MS Solution Informatique.
          </p>
        </div>

        <form onSubmit={onSubmit} className="mt-8 flex flex-col gap-4">
          <div>
            <label
              htmlFor="username"
              className="mb-1 block text-sm font-medium text-navy"
            >
              Nom d&apos;utilisateur
            </label>
            <input
              id="username"
              name="username"
              required
              autoComplete="username"
              className="w-full rounded-lg border border-black/25 px-4 py-2 text-sm focus:border-navy focus:outline-none"
            />
          </div>
          <div>
            <label
              htmlFor="password"
              className="mb-1 block text-sm font-medium text-navy"
            >
              Mot de passe
            </label>
            <input
              id="password"
              name="password"
              type="password"
              required
              autoComplete="current-password"
              className="w-full rounded-lg border border-black/25 px-4 py-2 text-sm focus:border-navy focus:outline-none"
            />
          </div>

          {erreur && <p className="text-sm text-red-600">{erreur}</p>}

          <button
            type="submit"
            disabled={enCours}
            className="mt-2 rounded-full bg-accent px-6 py-3 text-sm font-semibold text-white hover:opacity-90 disabled:opacity-60"
          >
            {enCours ? 'Connexion…' : 'Se connecter'}
          </button>
        </form>
      </div>
    </div>
  );
}
