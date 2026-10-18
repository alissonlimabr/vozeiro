const CONFIRMACAO_MS = 3000;

export const $ = (id) => document.getElementById(id);

export function avisar(mensagem, ehErro = false) {
  const status = $("status");
  status.textContent = mensagem;
  status.classList.toggle("erro", ehErro);
}

export function linha(...filhos) {
  const li = document.createElement("li");
  li.append(...filhos);
  return li;
}

export function bloco(titulo, meta) {
  const tituloEl = document.createElement("div");
  tituloEl.className = "titulo";
  tituloEl.textContent = titulo;
  const metaEl = document.createElement("div");
  metaEl.className = "meta";
  metaEl.textContent = meta;
  const info = document.createElement("div");
  info.style.minWidth = "0";
  info.append(tituloEl, metaEl);
  return { info, metaEl };
}

export function botao(rotulo, classe, aoClicar) {
  const b = document.createElement("button");
  b.type = "button";
  b.className = classe;
  b.textContent = rotulo;
  b.onclick = aoClicar;
  return b;
}

export function botaoDeExcluir(aoConfirmar, rotulo = "Excluir") {
  let cronometro = null;
  const restaurar = () => {
    clearTimeout(cronometro);
    cronometro = null;
    b.textContent = rotulo;
    b.classList.remove("confirmando");
  };
  const b = botao(rotulo, "perigo", () => {
    if (cronometro) {
      restaurar();
      aoConfirmar();
      return;
    }
    b.textContent = "Confirmar";
    b.classList.add("confirmando");
    cronometro = setTimeout(restaurar, CONFIRMACAO_MS);
  });
  return b;
}
