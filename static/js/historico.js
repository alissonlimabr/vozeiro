import { pedir } from "./api.js";
import { formatarData, formatarDuracao, formatarTamanho, formatarTitulo } from "./formato.js";
import { alternarAudio, atualizarBotoesDeTocar, pausar, pausarSeEstiverTocando } from "./player.js";
import { $, avisar, bloco, botao, botaoDeExcluir, linha } from "./ui.js";

const POR_PAGINA = 5;

let atual = null;
let anteriores = [];
let visiveis = POR_PAGINA;
let carregamento = 0;
const duracoes = new Map();

const botaoExcluirTudo = botaoDeExcluir(excluirTudo, "Excluir tudo");

function descobrirDuracao(arquivo, url, aoDescobrir) {
  if (duracoes.has(arquivo)) {
    aoDescobrir(duracoes.get(arquivo));
    return;
  }
  const sonda = new Audio();
  sonda.preload = "metadata";
  sonda.addEventListener("loadedmetadata", () => {
    if (!Number.isFinite(sonda.duration)) return;
    duracoes.set(arquivo, sonda.duration);
    aoDescobrir(sonda.duration);
  });
  sonda.src = url;
}

function item(dados, { comExcluir }) {
  const titulo = formatarTitulo(dados.arquivo);
  const url = `/saidas/${encodeURIComponent(dados.arquivo)}`;
  const meta = `${formatarData(dados.criado)} · ${formatarTamanho(dados.tamanho)}`;

  const tocar = botao("", "tocar", () => alternarAudio(url));
  tocar.dataset.url = url;
  tocar.dataset.titulo = titulo;

  const { info, metaEl } = bloco(titulo, meta);
  descobrirDuracao(dados.arquivo, url, (segundos) => {
    metaEl.textContent = `${formatarDuracao(segundos)} · ${meta}`;
  });

  const salvar = document.createElement("a");
  salvar.className = "botao";
  salvar.href = url;
  salvar.download = dados.arquivo;
  salvar.textContent = "Salvar";

  const acoes = document.createElement("div");
  acoes.className = "item-acoes";
  acoes.append(salvar);
  if (comExcluir) acoes.append(botaoDeExcluir(() => excluir(dados.arquivo, url)));

  return linha(tocar, info, acoes);
}

async function excluir(arquivo, url) {
  try {
    pausarSeEstiverTocando(url);
    await pedir(`/api/historico/${encodeURIComponent(arquivo)}`, { method: "DELETE" });
    await carregarHistorico();
  } catch (e) {
    avisar(e.message, true);
  }
}

async function excluirTudo() {
  try {
    pausar();
    await pedir("/api/historico", { method: "DELETE" });
    atual = null;
    visiveis = POR_PAGINA;
    $("resultado").hidden = true;
    await carregarHistorico();
    avisar("Histórico excluído.");
  } catch (e) {
    avisar(e.message, true);
  }
}

export function mostrarResultado(dados) {
  atual = dados.arquivo;
  $("resultado").querySelector("ul").replaceChildren(item(dados, { comExcluir: false }));
  $("resultado").hidden = false;
  atualizarBotoesDeTocar();
}

function desenhar() {
  const mostrados = anteriores.slice(0, visiveis);
  const restantes = anteriores.length - mostrados.length;

  $("total").textContent = anteriores.length
    ? `${restantes ? `${mostrados.length} de ` : ""}${anteriores.length} ${anteriores.length === 1 ? "áudio" : "áudios"}`
    : "";

  if (anteriores.length) {
    $("historico").replaceChildren(...mostrados.map((dados) => item(dados, { comExcluir: true })));
  } else {
    const vazio = document.createElement("li");
    vazio.className = "vazio";
    vazio.textContent = "As narrações anteriores aparecem aqui.";
    $("historico").replaceChildren(vazio);
  }

  $("rodape-historico").hidden = restantes === 0;
  botaoExcluirTudo.hidden = anteriores.length === 0 && !atual;
  atualizarBotoesDeTocar();
}

export async function carregarHistorico() {
  const meu = ++carregamento;
  try {
    const todos = await pedir("/api/historico");
    if (meu !== carregamento) return;
    anteriores = todos.filter((dados) => dados.arquivo !== atual);
    desenhar();
  } catch (e) {
    avisar(e.message, true);
  }
}

export function iniciarHistorico() {
  botaoExcluirTudo.hidden = true;
  document.querySelector(".cabecalho-acoes").append(botaoExcluirTudo);
  $("ver-mais").addEventListener("click", () => {
    visiveis += POR_PAGINA;
    desenhar();
  });
  return carregarHistorico();
}
