import { formatarNumero, formatarVelocidade } from "./formato.js";
import { carregarHistorico, iniciarHistorico, mostrarResultado } from "./historico.js";
import { adicionarNarracao, iniciarNarracoes } from "./narracoes.js";
import { $, avisar } from "./ui.js";
import { carregarVozes } from "./vozes.js";

const formulario = $("formulario");
const texto = $("texto");
const voz = $("voz");
const velocidade = $("velocidade");

function atualizarContador() {
  $("contador").textContent = `${formatarNumero(texto.value.length)} caracteres`;
}

iniciarNarracoes((dados) => {
  mostrarResultado(dados);
  carregarHistorico();
});

texto.addEventListener("input", atualizarContador);
texto.addEventListener("keydown", (e) => {
  if ((e.metaKey || e.ctrlKey) && e.key === "Enter") formulario.requestSubmit();
});

velocidade.addEventListener("input", () => {
  $("velocidade-valor").textContent = formatarVelocidade(Number(velocidade.value));
});

formulario.addEventListener("submit", (evento) => {
  evento.preventDefault();
  if (!texto.value.trim()) {
    avisar("Cole um texto para narrar.", true);
    return;
  }
  avisar("");
  adicionarNarracao({
    texto: texto.value,
    voz: voz.value,
    rotuloDaVoz: voz.selectedOptions[0].text.split(" (")[0],
    velocidade: Number(velocidade.value),
  });
});

atualizarContador();
carregarVozes();
iniciarHistorico();
