type Props = {
  globalBuffer: ArrayBuffer | null;
  setGlobalBuffer: (buffer: ArrayBuffer | null) => void;
};

export default function DespesasDashboard({ globalBuffer }: Props) {
  return (
    <section className="glass-panel p-6">
      <h1 className="text-2xl font-bold mb-3">Despesas</h1>
      <p className="text-white/80">
        A base do projeto foi publicada e ajustada para o GitHub Pages.
      </p>
      <p className="text-white/60 mt-2">
        {globalBuffer
          ? 'Há dados carregados para futura integração.'
          : 'Posso continuar depois com a lógica completa deste painel.'}
      </p>
    </section>
  );
}
