'use client';

interface Props {
  titre: string;
  message: string;
  enCours?: boolean;
  onConfirm: () => void;
  onCancel: () => void;
}

export default function ConfirmDialog({ titre, message, enCours, onConfirm, onCancel }: Props) {
  return (
    <div
      className="animate-backdrop-in fixed inset-0 z-[200] flex items-center justify-center bg-black/40 p-4 backdrop-blur-[2px]"
      onClick={onCancel}
    >
      <div
        className="animate-modal-pop w-full max-w-sm rounded-2xl bg-white p-6 shadow-2xl"
        role="alertdialog"
        aria-modal="true"
        onClick={(e) => e.stopPropagation()}
      >
        <h2 className="text-lg font-bold text-navy">{titre}</h2>
        <p className="mt-2 text-sm text-black/60">{message}</p>
        <div className="mt-6 flex justify-end gap-3">
          <button
            type="button"
            onClick={onCancel}
            className="rounded-full px-4 py-2 text-sm font-semibold text-black/50 transition-all hover:bg-black/5 active:scale-95"
          >
            Annuler
          </button>
          <button
            type="button"
            onClick={onConfirm}
            disabled={enCours}
            className="rounded-full bg-red-600 px-4 py-2 text-sm font-semibold text-white transition-all hover:opacity-90 hover:shadow-md active:scale-95 disabled:opacity-60 disabled:active:scale-100"
          >
            {enCours ? 'Suppression…' : 'Supprimer'}
          </button>
        </div>
      </div>
    </div>
  );
}
