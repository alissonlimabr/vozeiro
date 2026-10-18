export async function pedir(url, opcoes) {
  let resposta;
  try {
    resposta = await fetch(url, opcoes);
  } catch (e) {
    if (e.name === "AbortError") throw e;
    throw new Error("Não consegui falar com o vozeiro. Ele ainda está rodando? Confira o terminal e recarregue a página.");
  }

  if (resposta.status === 204) return null;
  const ehJson = (resposta.headers.get("content-type") ?? "").includes("application/json");
  const corpo = ehJson ? await resposta.json().catch(() => null) : null;
  if (!resposta.ok) {
    throw new Error(corpo?.erro ?? `Resposta inesperada do servidor (erro ${resposta.status}). Reinicie o vozeiro e recarregue a página.`);
  }
  return corpo;
}
