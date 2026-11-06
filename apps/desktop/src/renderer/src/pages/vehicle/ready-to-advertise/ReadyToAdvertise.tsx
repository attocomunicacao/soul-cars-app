/**
 * Aba Pronto para anunciar: checklist de prontidão, cartão da campanha com botões de
 * copiar e registro do anúncio (lembrete de pausa ao vender).
 */
import { useEffect, useMemo, useState } from "react";
import {
  cartaoCampanha,
  checklist,
  dataBr,
  fotoDoAnuncio,
  hoje,
  prontoParaAnunciar,
  type DestinoChecklist,
} from "../../../../../shared/ad-readiness";
import {
  listarAnuncios,
  marcarAnuncioPausado,
  obterConfig,
  registrarAnuncio,
  removerAnuncio,
  type Anuncio,
  type Veiculo,
} from "../../../lib/database";
import { ask, invoke, revealItemInDir } from "../../../lib/desktop-bridge";
import {
  statusProducao,
  type StatusProducao,
} from "../../../lib/production-status";

const ABA_DO_DESTINO: Record<DestinoChecklist, string> = {
  producao: "producao",
  ficha: "ficha",
  criativos: "criativos",
};

const juntar = (pasta: string, ...partes: string[]) =>
  [pasta.replace(/[\\/]+$/, ""), ...partes].join(
    pasta.includes("\\") ? "\\" : "/",
  );

/**
 * "Pronto para anunciar": checklist, cartão da campanha e registro manual do anúncio.
 * O app só prepara e orienta; quem cria e ativa o anúncio no Gerenciador é você.
 */
export function ReadyToAdvertise({
  veiculo: v,
  irPara,
}: {
  veiculo: Veiculo;
  irPara: (aba: string) => void;
}) {
  const [status, setStatus] = useState<StatusProducao | null>(null);
  const [anuncios, setAnuncios] = useState<Anuncio[]>([]);
  const [modelo, setModelo] = useState("");
  const [copiados, setCopiados] = useState<Record<string, string>>({});
  const [dia, setDia] = useState(hoje());
  const [campanha, setCampanha] = useState("");
  const [erro, setErro] = useState("");
  const [ocupado, setOcupado] = useState(false);

  useEffect(() => {
    if (!v.pasta) return;
    let ativo = true;
    const verificar = () =>
      void statusProducao(v.pasta!)
        .then((s) => ativo && setStatus(s))
        .catch((e) => ativo && setErro(String(e)));
    verificar();
    const timer = setInterval(verificar, 5000);
    return () => {
      ativo = false;
      clearInterval(timer);
    };
  }, [v.pasta]);

  async function recarregar() {
    setAnuncios(await listarAnuncios(v.id));
  }
  useEffect(() => {
    let ativo = true;
    void listarAnuncios(v.id)
      .then((a) => ativo && setAnuncios(a))
      .catch((e) => ativo && setErro(String(e)));
    void obterConfig("campanha_modelo")
      .then((c) => ativo && setModelo(c ?? ""))
      .catch((e) => ativo && setErro(String(e)));
    return () => {
      ativo = false;
    };
  }, [v.id]);

  const cartao = useMemo(() => cartaoCampanha(v.des_md || ""), [v.des_md]);
  useEffect(() => {
    setCampanha((atual) => atual || cartao.nomeCampanha || "");
  }, [cartao.nomeCampanha]);

  const itens = status
    ? checklist({
        nome: v.nome,
        ano: v.ano,
        doc_pdf: status.doc_pdf,
        doc_md: status.doc_md,
        des_md: status.des_md,
        fotos: status.fotos,
        video_final: status.video_final,
        criativos: status.criativos,
      })
    : [];
  const pronto = itens.length > 0 && prontoParaAnunciar(itens);
  const foto = status ? fotoDoAnuncio(status.criativos, v.nome, v.ano) : null;
  const caminhoFoto =
    foto && v.pasta ? juntar(v.pasta, "CRIATIVO", foto) : null;

  async function tarefa(fn: () => Promise<unknown>) {
    setOcupado(true);
    setErro("");
    try {
      await fn();
    } catch (e) {
      setErro(String(e));
    } finally {
      setOcupado(false);
    }
  }
  const copiar = (rotulo: string, texto: string) =>
    tarefa(async () => {
      await invoke("copiar_texto", { texto });
      setCopiados((c) => ({ ...c, [rotulo]: texto }));
    });
  const botaoCopiar = (rotulo: string, texto: string) => (
    <button
      disabled={ocupado}
      className={copiados[rotulo] === texto ? "copiado" : ""}
      onClick={() => void copiar(rotulo, texto)}
    >
      {copiados[rotulo] === texto ? "✓ Copiado" : "Copiar"}
    </button>
  );
  const grupo = (titulo: string, blocos: { label: string; text: string }[]) =>
    blocos.length > 0 && (
      <>
        <h4>{titulo}</h4>
        {blocos.map((b) => (
          <article key={b.label}>
            <div className="actions">
              <strong>{b.label}</strong>
              {botaoCopiar(b.label, b.text)}
            </div>
            <pre>{b.text}</pre>
          </article>
        ))}
      </>
    );

  return (
    <div className="panel">
      <h2>Pronto para anunciar</h2>
      <p>
        O app deixa tudo pronto; você duplica a campanha modelo no Gerenciador
        de Anúncios e ativa. Nada aqui publica ou ativa anúncio.
      </p>
      {erro && (
        <p role="alert" className="notice error">
          {erro}
        </p>
      )}
      {!v.pasta && (
        <p role="alert" className="notice">
          Vincule a pasta do veículo na aba Produção.
        </p>
      )}

      <h3>1 · Checklist</h3>
      <ul>
        {itens.map((i) => (
          <li key={i.id}>
            {i.ok ? "✓" : "○"} <strong>{i.titulo}</strong> · {i.detalhe}{" "}
            {!i.ok && (
              <button onClick={() => irPara(ABA_DO_DESTINO[i.destino])}>
                Resolver
              </button>
            )}
          </li>
        ))}
      </ul>
      <p role="status">
        <strong>
          {pronto
            ? "✓ Tudo pronto para anunciar."
            : "Ainda há itens pendentes."}
        </strong>
      </p>

      <h3>2 · Campanha</h3>
      {!v.des_md ? (
        <p>Gere o DES.md na ficha para ver os textos da campanha.</p>
      ) : (
        <>
          {cartao.nomeCampanha && (
            <article>
              <div className="actions">
                <strong>Nome da campanha</strong>
                {botaoCopiar("Nome da campanha", cartao.nomeCampanha)}
              </div>
              <pre>{cartao.nomeCampanha}</pre>
            </article>
          )}
          {grupo("Textos principais (as 5 lacunas)", cartao.textos)}
          {grupo("Títulos", cartao.titulos)}
          {grupo("Descrições", cartao.descricoes)}
          {grupo("Mensagens do WhatsApp", cartao.mensagens)}
        </>
      )}

      <h4>Arquivos a usar no anúncio</h4>
      <ul>
        <li>
          Foto:{" "}
          {caminhoFoto ? (
            <>
              <code>{foto}</code>{" "}
              <button
                onClick={() =>
                  void revealItemInDir(caminhoFoto).catch((e) =>
                    setErro(String(e)),
                  )
                }
              >
                Abrir pasta
              </button>{" "}
              {botaoCopiar("caminho-foto", caminhoFoto)}
            </>
          ) : (
            "ainda não exportada (aba Criativos)"
          )}
        </li>
      </ul>

      <h4>Passo a passo no Gerenciador de Anúncios</h4>
      <ol>
        <li>
          Duplique a campanha modelo
          {modelo ? (
            <>
              {" "}
              (<strong>{modelo}</strong>)
            </>
          ) : (
            ""
          )}
          .
        </li>
        <li>Troque o criativo da foto pelo arquivo da foto acima.</li>
        <li>
          Troque o criativo do vídeo pelo vídeo final da pasta do veículo.
        </li>
        <li>
          Cole os textos principais, os títulos e as descrições nas lacunas, e o
          nome da campanha.
        </li>
        <li>Confira tudo, ative a campanha e volte aqui para registrar.</li>
      </ol>

      <h3>3 · Registro do anúncio</h3>
      <div className="grid">
        <label>
          Data de criação
          <input
            type="date"
            value={dia}
            onChange={(e) => setDia(e.target.value)}
          />
        </label>
        <label>
          Nome da campanha
          <input
            value={campanha}
            onChange={(e) => setCampanha(e.target.value)}
          />
        </label>
      </div>
      <button
        className="primary"
        disabled={ocupado || !dia || !campanha.trim()}
        onClick={() =>
          void tarefa(async () => {
            await registrarAnuncio({
              veiculo_id: v.id,
              estoque_id: v.estoque_id,
              modelo: v.nome,
              campanha: campanha.trim(),
              criado_dia: dia,
            });
            await recarregar();
          })
        }
      >
        Registrar anúncio criado
      </button>
      {v.estoque_id == null && (
        <p className="notice">
          Este veículo não tem ID do BNDV ligado; o aviso de pausa por venda não
          vai funcionar para ele.
        </p>
      )}
      {anuncios.length > 0 && (
        <ul>
          {anuncios.map((a) => (
            <li key={a.id}>
              {dataBr(a.criado_dia)} · {a.campanha} ·{" "}
              {a.pausado_dia
                ? `pausado em ${dataBr(a.pausado_dia)}`
                : "no ar (aguardando pausa)"}{" "}
              {!a.pausado_dia && (
                <button
                  disabled={ocupado}
                  onClick={() =>
                    void tarefa(async () => {
                      if (
                        !(await ask(
                          "Você já pausou esta campanha no Gerenciador de Anúncios?",
                        ))
                      )
                        return;
                      await marcarAnuncioPausado(a.id, hoje());
                      await recarregar();
                    })
                  }
                >
                  Marcar como pausada
                </button>
              )}{" "}
              <button
                disabled={ocupado}
                onClick={() =>
                  void tarefa(async () => {
                    if (
                      !(await ask(
                        "Remover este registro? O aviso de pausa deixa de existir para ele.",
                      ))
                    )
                      return;
                    await removerAnuncio(a.id);
                    await recarregar();
                  })
                }
              >
                Remover registro
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
