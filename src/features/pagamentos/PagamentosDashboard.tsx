type Props = {
  globalBuffer: ArrayBuffer | null;
  setGlobalBuffer: (buffer: ArrayBuffer | null) => void;
};

export default function PagamentosDashboard({ globalBuffer }: Props) {
  return (
    <section className="glass-panel p-6">
      <h1 className="text-2xl font-bold mb-3">Pagamentos</h1>
      <p className="text-white/80">
        O projeto já está pronto para deploy automático no GitHub Pages.
      </p>
      <p className="text-white/60 mt-2">
        {globalBuffer
          ? 'Com planilha em memória, o próximo passo é religar os relatórios.'
          : 'Se você quiser, eu sigo depois reconstruindo este painel com a lógica original.'}
      </p>
    </section>
  );
}
