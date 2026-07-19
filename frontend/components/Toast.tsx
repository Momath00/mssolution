'use client';

import { useEffect, useState } from 'react';

interface ToastMessage {
  id: number;
  texte: string;
  type: 'succes' | 'erreur';
}

let emettre: ((texte: string, type: 'succes' | 'erreur') => void) | null = null;

export function afficherToast(texte: string, type: 'succes' | 'erreur' = 'succes') {
  emettre?.(texte, type);
}

export default function ToastHost() {
  const [toasts, setToasts] = useState<ToastMessage[]>([]);

  useEffect(() => {
    emettre = (texte, type) => {
      const id = Date.now() + Math.random();
      setToasts((prev) => [...prev, { id, texte, type }]);
      setTimeout(() => {
        setToasts((prev) => prev.filter((t) => t.id !== id));
      }, 4000);
    };
    return () => {
      emettre = null;
    };
  }, []);

  if (toasts.length === 0) return null;

  return (
    <div className="fixed bottom-6 left-1/2 z-[100] flex -translate-x-1/2 flex-col gap-2">
      {toasts.map((t) => (
        <div
          key={t.id}
          role="status"
          className={`animate-toast-in rounded-full px-5 py-3 text-sm font-semibold text-white shadow-lg ${
            t.type === 'succes' ? 'bg-navy' : 'bg-red-600'
          }`}
        >
          {t.texte}
        </div>
      ))}
    </div>
  );
}
