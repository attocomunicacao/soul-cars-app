import { useEffect, useRef, useState } from "react";
import { atualizarVeiculo, type Veiculo } from "./lib/db";
import {
  carregarFotos,
  carregarFotosVitrine,
  importarFotosPadrao,
  salvarCriativo,
  salvarFoto,
  localizarFotosVitrine,
  FOTOS_VITRINE,
  type Slot,
} from "./lib/arquivos";
import { fuelLabel, formatNumber, shortGearbox } from "./lib/des";
import { gravarNaPasta, recortarArquivo } from "./lib/producao";
import { invoke } from "./lib/desktop";

export function Criativos({
  veiculo: v,
  onChange,
  onBack,
  prepararInstagram = false,
  onInstagramPronto,
}: {
  veiculo: Veiculo;
  onChange: (v: Veiculo) => void;
  onBack: () => void;
  prepararInstagram?: boolean;
  onInstagramPronto?: () => void;
}) {
  const frame = useRef<HTMLIFrameElement>(null);
  const atual = useRef(v);
  atual.current = v;
  const exportadosInstagram = useRef(new Set<string>());
  const [aviso, setAviso] = useState("");
  const post = (data: unknown) =>
    frame.current?.contentWindow?.postMessage(
      data,
      location.protocol === "file:" ? "*" : location.origin,
    );
  async function vitrine() {
    if (!v.pasta) throw new Error("Vincule a pasta do veículo.");
    post({ type: "soul:vitrine-cropping", active: true });
    try {
      const { fotos, pastaFotos } = await localizarFotosVitrine(v.pasta);
      for (const f of fotos) {
        if (!f.recorte && f.origem)
          await recortarArquivo(
            f.origem,
            `${pastaFotos}/${f.numero}_sem_fundo.png`,
          );
      }
      post({
        type: "soul:vitrine-photos",
        photos: await carregarFotosVitrine(v.pasta),
      });
    } finally {
      post({ type: "soul:vitrine-cropping", active: false });
    }
  }
  async function receber(event: MessageEvent) {
    if (
      event.source !== frame.current?.contentWindow ||
      (location.protocol !== "file:" && event.origin !== location.origin)
    )
      return;
    const data = event.data;
    try {
      switch (data?.type) {
        case "soul:ready": {
          post({ type: "soul:theme", theme: "light" });
          post({
            type: "soul:vehicle",
            revision: 1,
            fields: {
              titulo: [v.nome, v.ano].filter(Boolean).join(" "),
              subtitulo: v.versao || "",
              "terceiro-titulo": shortGearbox(v.cambio || ""),
              valor: v.preco == null ? "" : formatNumber(v.preco),
              ano: v.ano || "",
              km: v.km == null ? "" : formatNumber(v.km),
              fuel: fuelLabel(v.combustivel || ""),
              cor: v.cor || "",
            },
          });
          if (v.pasta) await importarFotosPadrao(v.id, v.pasta);
          post({
            type: "soul:photos",
            photos: await carregarFotos(v.id),
            ajustes: v.ajustes ? JSON.parse(v.ajustes) : null,
          });
          if (v.pasta)
            post({
              type: "soul:vitrine-photos",
              photos: await carregarFotosVitrine(v.pasta),
            });
          if (prepararInstagram) post({ type: "soul:instagram-export" });
          break;
        }
        case "soul:ajustes": {
          const ajustes = JSON.stringify(data.ajustes);
          await atualizarVeiculo(v.id, { ajustes });
          onChange({ ...atual.current, ajustes });
          break;
        }
        case "soul:back":
          onBack();
          break;
        case "soul:photo":
          if (data.file instanceof File)
            await salvarFoto(v.id, data.slot as Slot, data.file);
          break;
        case "soul:vitrine-crop":
          await vitrine();
          break;
        case "soul:vitrine-photo": {
          if (
            !v.pasta ||
            !FOTOS_VITRINE.includes(data.numero) ||
            !(data.file instanceof File) ||
            data.file.type !== "image/png"
          )
            throw new Error("Foto do carrossel inválida.");
          const { pastaFotos } = await localizarFotosVitrine(v.pasta);
          await gravarNaPasta(
            pastaFotos,
            `${data.numero}_sem_fundo.png`,
            data.file,
          );
          break;
        }
        case "soul:export": {
          if (!(data.blob instanceof Blob))
            throw new Error("Exportação inválida.");
          const caminho = await salvarCriativo(
            [v.nome, v.ano].filter(Boolean).join(" "),
            data.name,
            data.blob,
            v.pasta,
          );
          post({
            type: "soul:export-result",
            ok: true,
            message: `Salvo em ${caminho}`,
          });
          setAviso(`Salvo em ${caminho}`);
          if (
            prepararInstagram &&
            /-(carrossel-[123]|trafego-pago)\.png$/i.test(data.name)
          ) {
            exportadosInstagram.current.add(data.name);
            if (exportadosInstagram.current.size === 4) onInstagramPronto?.();
          }
          if (v.status === "rascunho") {
            await atualizarVeiculo(v.id, { status: "criativos" });
            onChange({ ...atual.current, status: "criativos" });
          }
          break;
        }
        case "soul:instagram-export-error":
          setAviso(
            data.message ||
              "Não foi possível gerar os criativos do Instagram. Confira os campos e as fotos.",
          );
          break;
      }
    } catch (e) {
      setAviso(String(e));
      if (data?.type === "soul:export")
        post({ type: "soul:export-result", ok: false, message: String(e) });
    }
  }
  // O ouvinte é registrado uma vez e chama sempre a versão mais recente de `receber`,
  // que enxerga o veículo e as funções atuais. O tratamento de erro está dentro dela.
  const ultimoReceber = useRef(receber);
  ultimoReceber.current = receber;
  useEffect(() => {
    const aoReceber = (event: MessageEvent) =>
      void ultimoReceber.current(event);
    window.addEventListener("message", aoReceber);
    return () => window.removeEventListener("message", aoReceber);
  }, []);
  return (
    <div className="editor">
      <div className="actions">
        <p role="status">
          {aviso ||
            "Ajustes e fotos são salvos automaticamente. Exporte para CRIATIVO."}
        </p>
      </div>
      <iframe
        ref={frame}
        src="./criativo/index.html?integrated=1&app=1&theme=light"
        title="Editor de criativos SOUL Cars"
      />
    </div>
  );
}
