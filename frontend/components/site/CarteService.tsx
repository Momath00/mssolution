import { Icone } from '@/components/Icone';

interface Props {
  titre: string;
  description: string;
  icone: string;
}

export default function CarteService({ titre, description, icone }: Props) {
  return (
    <div className="group h-full rounded-2xl bg-[#f7f6f3] p-7 transition-all duration-300 hover:-translate-y-1 hover:bg-[#f1efea]">
      <div className="grid h-11 w-11 place-items-center rounded-xl bg-white text-navy shadow-sm ring-1 ring-black/5 transition-colors duration-300 group-hover:text-accent">
        <Icone d={icone} className="h-5 w-5" />
      </div>
      <h3 className="mt-5 text-lg font-semibold text-navy">{titre}</h3>
      <p className="mt-2 text-sm leading-relaxed text-black/55">{description}</p>
    </div>
  );
}
