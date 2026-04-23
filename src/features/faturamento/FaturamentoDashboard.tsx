type Props = {
  globalBuffer: ArrayBuffer | null;
  setGlobalBuffer: (buffer: ArrayBuffer | null) => void;
};

export default function FaturamentoDashboard({ globalBuffer }: Props) {
  return (
    <section className="glass-panel p-6">
      <h1 className="text-2xl font-bold mb-3">Faturamento</h1>
      <p className="text-white/80">
        Estrutura publicada com sucesso no GitHub Pages.
      </p>
      <p className="text-white/60 mt-2">
        {globalBuffer
          ? 'Arquivo detectado em memória para futura leitura.'
          : 'Ainda não há planilha carregada automaticamente no repositório.'}
      </p>
    </section>
  );
}
