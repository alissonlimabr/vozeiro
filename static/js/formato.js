export const formatarNumero = (n) => n.toLocaleString("pt-BR");

export const formatarTamanho = (bytes) =>
  bytes >= 1048576 ? `${(bytes / 1048576).toFixed(1)} MB` : `${Math.max(1, Math.round(bytes / 1024))} KB`;

export const formatarData = (iso) => new Date(iso).toLocaleString("pt-BR", { dateStyle: "short", timeStyle: "short" });

export const formatarVelocidade = (n) => (n === 0 ? "Normal" : `${n > 0 ? "+" : ""}${n}%`);

export function formatarDuracao(segundos) {
  const total = Math.round(segundos);
  return `${Math.floor(total / 60)}:${String(total % 60).padStart(2, "0")}`;
}

export function formatarTitulo(arquivo) {
  const base = arquivo.replace(/^\d{8}-\d{6}\d*-/, "").replace(/\.mp3$/, "").replaceAll("-", " ");
  return base.charAt(0).toUpperCase() + base.slice(1);
}

export function resumir(conteudo) {
  const limpo = conteudo.trim().replace(/\s+/g, " ");
  return limpo.length > 48 ? `${limpo.slice(0, 48).trimEnd()}…` : limpo;
}
