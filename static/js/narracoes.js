import { pedir } from "./api.js";
import { formatarVelocidade, resumir } from "./formato.js";
import { $, avisar, bloco, botao, linha } from "./ui.js";

const MAX_SIMULTANEAS = 4;

const fila = [];
let ativos = 0;
let aoConcluir = () => {};

export function iniciarNarracoes(aoConcluirNarracao) {
  aoConcluir = aoConcluirNarracao;
}

function atualizarEmAndamento() {
  $("andamento").hidden = $("andamento").children.length === 0;
}

function encerrar(trabalho) {
  trabalho.linha.remove();
  atualizarEmAndamento();
}

function enfileirar(trabalho) {
  trabalho.controlador = new AbortController();
  trabalho.marcar("Na fila", true);
  fila.push(trabalho);
  processarFila();
}

function cancelar(trabalho) {
  const posicao = fila.indexOf(trabalho);
  if (posicao === -1) {
    trabalho.controlador.abort();
    return;
  }
  fila.splice(posicao, 1);
  encerrar(trabalho);
  avisar("Narração cancelada.");
}

async function executar(trabalho) {
  ativos++;
  trabalho.marcar("Gerando", false);
  try {
    const dados = await pedir("/api/narrar", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ texto: trabalho.texto, voz: trabalho.voz, velocidade: trabalho.velocidade }),
      signal: trabalho.controlador.signal,
    });
    aoConcluir(dados);
    avisar("Narração pronta.");
    encerrar(trabalho);
  } catch (e) {
    if (e.name === "AbortError") {
      avisar("Narração cancelada.");
      encerrar(trabalho);
    } else {
      trabalho.falhar(e.message);
    }
  } finally {
    ativos--;
    processarFila();
  }
}

function processarFila() {
  while (ativos < MAX_SIMULTANEAS && fila.length) executar(fila.shift());
}

export function adicionarNarracao({ texto, voz, rotuloDaVoz, velocidade }) {
  const trabalho = { texto, voz, velocidade };
  const descricao = `${rotuloDaVoz} · ${formatarVelocidade(velocidade)}`;

  const indicador = document.createElement("div");
  const { info, metaEl } = bloco(resumir(texto), "");
  const acoes = document.createElement("div");
  acoes.className = "item-acoes";
  const botaoCancelar = botao("Cancelar", "", () => cancelar(trabalho));

  trabalho.linha = linha(indicador, info, acoes);
  trabalho.marcar = (rotulo, emEspera) => {
    indicador.className = `indicador${emEspera ? " espera" : ""}`;
    metaEl.classList.remove("erro");
    metaEl.textContent = `${descricao} · ${rotulo}`;
    acoes.replaceChildren(botaoCancelar);
  };
  trabalho.falhar = (mensagem) => {
    indicador.className = "indicador falha";
    metaEl.classList.add("erro");
    metaEl.textContent = mensagem;
    acoes.replaceChildren(botao("Tentar de novo", "", () => enfileirar(trabalho)), botao("Descartar", "", () => encerrar(trabalho)));
  };

  $("andamento").append(trabalho.linha);
  atualizarEmAndamento();
  enfileirar(trabalho);
}
