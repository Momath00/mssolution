'use client';

import { useRef } from 'react';

// Incline légèrement son contenu en 3D selon la position de la souris.
// Les valeurs sont écrites directement dans le style pour éviter un rendu
// React à chaque mouvement ; rien ne se passe au toucher ni sans souris.

const ANGLE_MAX = 7;

export default function Inclinaison({ children }: { children: React.ReactNode }) {
  const ref = useRef<HTMLDivElement>(null);

  function onPointerMove(e: React.PointerEvent<HTMLDivElement>) {
    const el = ref.current;
    if (!el || e.pointerType !== 'mouse') return;
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;
    const r = el.getBoundingClientRect();
    const x = (e.clientX - r.left) / r.width - 0.5;
    const y = (e.clientY - r.top) / r.height - 0.5;
    el.style.transform = `rotateX(${(-y * ANGLE_MAX).toFixed(2)}deg) rotateY(${(x * ANGLE_MAX).toFixed(2)}deg)`;
  }

  function onPointerLeave() {
    if (ref.current) ref.current.style.transform = '';
  }

  return (
    <div className="[perspective:1200px]" onPointerMove={onPointerMove} onPointerLeave={onPointerLeave}>
      <div ref={ref} className="transition-transform duration-300 ease-out [transform-style:preserve-3d] will-change-transform">
        {children}
      </div>
    </div>
  );
}
