import argparse
import asyncio
import errno
import re
import sys
import traceback
import unicodedata
import webbrowser
from datetime import datetime
from pathlib import Path

import aiohttp
import edge_tts
from aiohttp import web
from aiohttp.typedefs import Handler
from edge_tts import communicate
from edge_tts.constants import TRUSTED_CLIENT_TOKEN

BASE = Path(__file__).parent
SAIDAS = BASE / "saidas"
HOST = "127.0.0.1"
PORTA_PADRAO = 3000
LIMITE_NOME = 30
VOZ_PADRAO = "pt-BR-AntonioNeural"
GRUPOS = {"pt-BR": "Português do Brasil", "pt-PT": "Português de Portugal"}
ENDERECO_ANTIGO = "speech.platform.bing.com"
ENDERECO_NOVO = "wss://api.msedgeservices.com/tts/cognitiveservices/websocket/v1?Ocp-Apim-Subscription-Key="
AJUDA = "Se o erro persistir, o serviço pode ter mudado: atualize a biblioteca com `uv lock --upgrade-package edge-tts`."
MENSAGENS_HTTP = {
    404: "Endereço não encontrado. Se o vozeiro foi atualizado, reinicie-o e recarregue a página.",
    405: "Esta ação não existe nesta versão do vozeiro. Reinicie-o e recarregue a página.",
}
VOZES: list[dict] = []
VOZ_PADRAO_INFO = {"nome": VOZ_PADRAO, "genero": "Male", "grupo": GRUPOS["pt-BR"]}


def erro(mensagem: str, status: int) -> web.Response:
    return web.json_response({"erro": mensagem}, status=status)


def explicar(falha: Exception) -> tuple[str, int]:
    if isinstance(falha, edge_tts.exceptions.NoAudioReceived):
        return "O serviço não gerou áudio para esse texto. Ele precisa ter palavras: texto só com pontuação não é narrado.", 422
    if isinstance(falha, edge_tts.exceptions.SkewAdjustmentError):
        return "O relógio do computador parece desajustado e o serviço recusa pedidos assim. Acerte a data e a hora e tente de novo.", 502
    if isinstance(falha, aiohttp.WSServerHandshakeError):
        if falha.status == 429:
            return "O serviço de voz limitou os pedidos por agora. Espere um pouco e tente de novo.", 429
        return f"O serviço de voz recusou a conexão (erro {falha.status}). {AJUDA}", 502
    if isinstance(falha, (aiohttp.ClientConnectionError, TimeoutError)):
        return "Sem conexão com o serviço de voz. Verifique a internet e tente de novo.", 502
    if isinstance(falha, (edge_tts.exceptions.EdgeTTSException, aiohttp.ClientError)):
        return f"O serviço de voz respondeu de um jeito inesperado. {AJUDA}", 502
    if isinstance(falha, PermissionError):
        return "Sem permissão para gravar na pasta `saidas`. Verifique as permissões da pasta.", 500
    if isinstance(falha, OSError) and falha.errno == errno.ENOSPC:
        return "O disco está cheio. Libere espaço, ou exclua áudios do histórico, e tente de novo.", 507
    if isinstance(falha, OSError):
        return f"Não foi possível usar a pasta `saidas` ({falha.strerror}).", 500
    return "Ocorreu um erro inesperado no vozeiro. Os detalhes aparecem no terminal.", 500


@web.middleware
async def traduzir_erros(request: web.Request, handler: Handler) -> web.StreamResponse:
    try:
        return await handler(request)
    except web.HTTPException as falha:
        if falha.status < 400:
            raise
        if falha.status == 403:
            mensagem = f"Acesso recusado. O vozeiro só aceita pedidos feitos pela própria página, em http://{HOST}:{request.app['porta']}."
        else:
            mensagem = MENSAGENS_HTTP.get(falha.status, f"O servidor recusou o pedido (erro {falha.status}).")
        return erro(mensagem, falha.status)
    except Exception as falha:  # noqa: BLE001
        mensagem, status = explicar(falha)
        print(f"Falha em {request.method} {request.path}: {type(falha).__name__}: {falha}", flush=True)
        if status == 500:
            traceback.print_exception(falha)
        return erro(mensagem, status)


@web.middleware
async def proteger_acesso(request: web.Request, handler: Handler) -> web.StreamResponse:
    porta = request.app["porta"]
    permitidos = {f"{HOST}:{porta}", f"localhost:{porta}"}
    origem = request.headers.get("Origin")
    if request.host not in permitidos or (origem and origem.removeprefix("http://") not in permitidos):
        raise web.HTTPForbidden
    return await handler(request)


def reservar_destino(texto: str) -> tuple[Path, Path]:
    slug = re.sub(r"[\W_]+", "-", unicodedata.normalize("NFC", texto).lower()).strip("-")
    if len(slug) > LIMITE_NOME:
        slug = slug[:LIMITE_NOME].rsplit("-", 1)[0]
    slug = slug or "audio"
    while True:
        marca = datetime.now().strftime("%Y%m%d-%H%M%S%f")[:-3]
        destino = SAIDAS / f"{marca}-{slug}.mp3"
        parcial = destino.with_suffix(".part")
        if not destino.exists() and not parcial.exists():
            parcial.touch()
            return destino, parcial


def caminho_do_audio(nome: str) -> Path | None:
    caminho = SAIDAS / nome
    if caminho.parent != SAIDAS or caminho.suffix != ".mp3" or not caminho.is_file():
        return None
    return caminho


def descrever(caminho: Path) -> dict:
    info = caminho.stat()
    return {
        "arquivo": caminho.name,
        "tamanho": info.st_size,
        "criado": datetime.fromtimestamp(info.st_mtime).isoformat(timespec="seconds"),
    }


def usar_endereco_novo() -> bool:
    if ENDERECO_ANTIGO not in communicate.WSS_URL:
        return False
    communicate.WSS_URL = ENDERECO_NOVO + TRUSTED_CLIENT_TOKEN
    return True


async def sintetizar(texto: str, voz: str, velocidade: int, destino: Path) -> None:
    async def gerar() -> None:
        await edge_tts.Communicate(texto, voz, rate=f"{velocidade:+d}%").save(str(destino))

    try:
        await gerar()
    except aiohttp.WSServerHandshakeError as falha:
        if falha.status == 429 or not usar_endereco_novo():
            raise
        print(f"O Edge recusou a conexão (erro {falha.status}). Tentando o endereço novo.", flush=True)
        await asyncio.sleep(1.5)
        await gerar()


async def carregar_vozes() -> list[dict]:
    if not VOZES:
        ordem = list(GRUPOS)
        escolhidas = sorted(
            (v for v in await edge_tts.list_voices() if v["Locale"] in GRUPOS),
            key=lambda v: (ordem.index(v["Locale"]), "Multilingual" in v["ShortName"], v["ShortName"]),
        )
        VOZES[:] = [{"nome": v["ShortName"], "genero": v["Gender"], "grupo": GRUPOS[v["Locale"]]} for v in escolhidas]
    return VOZES


async def listar_vozes() -> tuple[list[dict], bool]:
    try:
        return await carregar_vozes(), True
    except (aiohttp.ClientError, edge_tts.exceptions.EdgeTTSException, TimeoutError) as falha:
        print(f"Não foi possível carregar a lista de vozes: {type(falha).__name__}: {falha}", flush=True)
        return [VOZ_PADRAO_INFO], False


async def pagina(_: web.Request) -> web.FileResponse:
    return web.FileResponse(BASE / "static" / "index.html")


async def vozes(_: web.Request) -> web.Response:
    lista, completa = await listar_vozes()
    aviso = None if completa else "Não foi possível carregar a lista de vozes. Só a voz padrão está disponível por enquanto."
    return web.json_response({"padrao": VOZ_PADRAO, "vozes": lista, "aviso": aviso})


async def narrar(request: web.Request) -> web.Response:
    try:
        dados = await request.json()
        texto = str(dados.get("texto", "")).strip()
        voz = str(dados.get("voz", VOZ_PADRAO))
        velocidade = max(-50, min(100, int(dados.get("velocidade", 0))))
    except (ValueError, TypeError, AttributeError):
        return erro("O pedido chegou incompleto ou malformado. Recarregue a página e tente de novo.", 400)

    if not texto:
        return erro("Cole um texto para narrar.", 400)

    destino, parcial = reservar_destino(texto)
    try:
        if voz not in {v["nome"] for v in (await listar_vozes())[0]}:
            return erro("A voz escolhida não está disponível. Recarregue a página e escolha outra.", 400)
        await sintetizar(texto, voz, velocidade, parcial)
        parcial.replace(destino)
    finally:
        parcial.unlink(missing_ok=True)
    return web.json_response(descrever(destino))


async def historico(_: web.Request) -> web.Response:
    arquivos = sorted(SAIDAS.glob("*.mp3"), key=lambda p: p.stat().st_mtime, reverse=True)
    return web.json_response([descrever(p) for p in arquivos])


async def baixar(request: web.Request) -> web.StreamResponse:
    caminho = caminho_do_audio(request.match_info["arquivo"])
    if caminho is None:
        return erro("Esse áudio não existe mais. Ele pode ter sido excluído.", 404)
    return web.FileResponse(caminho)


async def excluir_tudo(_: web.Request) -> web.Response:
    for caminho in SAIDAS.glob("*.mp3"):
        caminho.unlink(missing_ok=True)
    return web.Response(status=204)


async def excluir(request: web.Request) -> web.Response:
    caminho = caminho_do_audio(request.match_info["arquivo"])
    if caminho is None:
        return erro("Esse áudio não existe mais. Ele pode ter sido excluído.", 404)
    caminho.unlink(missing_ok=True)
    return web.Response(status=204)


async def aquecer_vozes(app: web.Application) -> None:
    app["aquecimento"] = asyncio.create_task(listar_vozes())


async def revalidar(_: web.Request, resposta: web.StreamResponse) -> None:
    resposta.headers["Cache-Control"] = "no-cache"


async def abrir_navegador(app: web.Application) -> None:
    asyncio.get_running_loop().call_later(0.5, webbrowser.open, f"http://{HOST}:{app['porta']}")


def porta_valida(valor: str) -> int:
    try:
        porta = int(valor)
    except ValueError:
        raise argparse.ArgumentTypeError("informe um número inteiro") from None
    if not 1 <= porta <= 65535:
        raise argparse.ArgumentTypeError("a porta deve estar entre 1 e 65535")
    return porta


def ler_argumentos() -> argparse.Namespace:
    parser = argparse.ArgumentParser(description="Narração em MP3 com voz neural, em uma página web local.", add_help=False)
    opcoes = parser.add_argument_group("opções")
    opcoes.add_argument("-h", "--help", action="help", help="mostra esta mensagem e sai")
    opcoes.add_argument("--porta", type=porta_valida, default=PORTA_PADRAO, metavar="PORTA", help=f"porta do servidor (padrão: {PORTA_PADRAO})")
    return parser.parse_args()


def main() -> None:
    porta = ler_argumentos().porta
    SAIDAS.mkdir(exist_ok=True)
    for parcial in SAIDAS.glob("*.part"):
        parcial.unlink(missing_ok=True)
    app = web.Application(middlewares=[traduzir_erros, proteger_acesso], client_max_size=0)
    app["porta"] = porta
    app.on_startup.extend([aquecer_vozes, abrir_navegador])
    app.on_response_prepare.append(revalidar)
    app.add_routes(
        [
            web.get("/", pagina),
            web.static("/static", BASE / "static"),
            web.get("/api/vozes", vozes),
            web.post("/api/narrar", narrar),
            web.get("/api/historico", historico),
            web.get("/saidas/{arquivo}", baixar),
            web.delete("/api/historico", excluir_tudo),
            web.delete("/api/historico/{arquivo}", excluir),
        ]
    )
    try:
        web.run_app(
            app,
            host=HOST,
            port=porta,
            handler_cancellation=True,
            print=lambda _: print(f"Vozeiro em http://{HOST}:{porta}. Pressione Ctrl+C para encerrar.", flush=True),
        )
    except OSError as falha:
        if falha.errno != errno.EADDRINUSE:
            raise
        outra = porta + 1 if porta < 65535 else porta - 1
        sys.exit(f"A porta {porta} já está em uso. Feche o outro programa ou escolha outra: uv run vozeiro.py --porta {outra}")


if __name__ == "__main__":
    main()
