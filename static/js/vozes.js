import { pedir } from "./api.js";
import { $, avisar } from "./ui.js";

function rotuloDaVoz(voz) {
  const nome = voz.nome.split("-").slice(2).join("-").replace("Neural", "");
  const multilingue = nome.includes("Multilingual");
  const detalhes = [voz.genero === "Male" ? "masculina" : "feminina", ...(multilingue ? ["pode ter sotaque"] : [])];
  return `${nome.replace("Multilingual", " Multilingual")} (${detalhes.join(", ")})`;
}

export async function carregarVozes() {
  const seletor = $("voz");
  try {
    const { padrao, vozes, aviso } = await pedir("/api/vozes");
    const escolhida = vozes.some((v) => v.nome === seletor.value) ? seletor.value : padrao;
    const grupos = new Map();
    for (const voz of vozes) {
      if (!grupos.has(voz.grupo)) {
        const grupo = document.createElement("optgroup");
        grupo.label = voz.grupo;
        grupos.set(voz.grupo, grupo);
      }
      const opcao = new Option(rotuloDaVoz(voz), voz.nome);
      opcao.selected = voz.nome === escolhida;
      grupos.get(voz.grupo).append(opcao);
    }
    seletor.replaceChildren(...grupos.values());
    if (aviso) avisar(aviso, true);
  } catch (e) {
    avisar(e.message, true);
  }
}
