import { avisar } from "./ui.js";

const ICONE_TOCAR = '<svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><path d="M8 5v14l11-7z"/></svg>';
const ICONE_PAUSAR = '<svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><path d="M6 5h4v14H6zM14 5h4v14h-4z"/></svg>';

const player = new Audio();

export function atualizarBotoesDeTocar() {
  document.querySelectorAll("button.tocar").forEach((b) => {
    const tocando = b.dataset.url === player.getAttribute("src") && !player.paused;
    b.innerHTML = tocando ? ICONE_PAUSAR : ICONE_TOCAR;
    b.setAttribute("aria-label", `${tocando ? "Pausar" : "Ouvir"} ${b.dataset.titulo}`);
  });
}

export function alternarAudio(url) {
  if (player.getAttribute("src") === url && !player.paused) {
    player.pause();
    return;
  }
  if (player.getAttribute("src") !== url) player.src = url;
  player.play().catch(() => {});
}

export const pausar = () => player.pause();

export function pausarSeEstiverTocando(url) {
  if (player.getAttribute("src") === url) player.pause();
}

["play", "pause", "ended"].forEach((evento) => player.addEventListener(evento, atualizarBotoesDeTocar));
player.addEventListener("error", () => {
  avisar("Não foi possível reproduzir esse áudio. O arquivo pode ter sido excluído ou estar incompleto.", true);
  atualizarBotoesDeTocar();
});
