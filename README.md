# vozeiro

Cole um texto e baixe a narração em MP3 com voz neural em português. Roda local, em uma página web simples.

Usa as vozes neurais do Microsoft Edge por meio da biblioteca [edge-tts](https://github.com/rany2/edge-tts). Não precisa de conta, chave de API nem cobrança.

## Requisitos

- [uv](https://docs.astral.sh/uv/getting-started/installation/)
- Conexão com a internet, porque a voz é sintetizada nos servidores da Microsoft

O uv baixa o Python e as dependências sozinho. Não é preciso instalar nada além dele. Testado no macOS e no Ubuntu 24.04 (arm64), com Python 3.14 e 3.15. O Windows não foi testado.

### Instalando o uv

No macOS e no Linux (precisa do `curl`):

```bash
curl -LsSf https://astral.sh/uv/install.sh | sh
```

Abra um novo terminal depois da instalação, ou rode `source $HOME/.local/bin/env`, para o comando `uv` ficar disponível. Outras formas de instalar estão na [documentação do uv](https://docs.astral.sh/uv/getting-started/installation/).

## Como usar

```bash
git clone https://github.com/alissonlimabr/vozeiro.git
cd vozeiro
uv run vozeiro.py
```

A primeira execução baixa o Python e as dependências e leva alguns segundos. As seguintes sobem em menos de um segundo.

O navegador abre em `http://127.0.0.1:3000`. Se ele não abrir sozinho (em SSH ou num container, por exemplo), acesse o endereço manualmente. Cole o texto, escolha a voz e a velocidade e clique em **Narrar**. O áudio aparece na tela para ouvir e salvar.

Para encerrar, pressione `Ctrl+C` no terminal.

### Opções

| Opção | Padrão | O que faz |
|---|---|---|
| `--porta` | `3000` | Porta do servidor. Use quando a 3000 estiver ocupada |
| `-h`, `--help` | | Mostra as opções |

```bash
uv run vozeiro.py --porta 3001
```

Ao subir, o terminal mostra o endereço em uso (`Vozeiro em http://127.0.0.1:3001`).

### Várias narrações ao mesmo tempo

Você pode enviar outro texto sem esperar o anterior terminar. Até 4 narrações são geradas em paralelo, e as demais ficam na fila. Cada uma aparece em andamento, com o botão **Cancelar**: o servidor interrompe a síntese e descarta o arquivo parcial.

### Textos longos

Não há limite de caracteres no vozeiro. O tempo cresce com o tamanho: cerca de 40 segundos para 5.000 caracteres, 80 segundos para 20.000 e 100 segundos para 60.000 (um áudio de 20 MB). Nos testes, o Edge aceitou esses textos e 20 pedidos simultâneos sem recusar.

## Histórico

Cada narração gerada é salva na pasta `saidas/`, com o começo do texto no nome do arquivo. A mais recente fica em destaque, e as anteriores aparecem no histórico, 5 por vez (**Ver mais** mostra outras 5), com player, duração, **Salvar** (baixa uma cópia pelo navegador) e **Excluir**, que pede uma segunda confirmação. **Excluir tudo**, no cabeçalho do histórico, esvazia a pasta inteira, incluindo a narração em destaque, também com confirmação. A pasta não é versionada.

## Vozes

A lista é buscada na hora, então acompanha o que o Edge oferece:

- **Português do Brasil:** Antonio, Francisca e Thalita. A Thalita é multilíngue e pode falar português com sotaque estrangeiro.
- **Português de Portugal:** Duarte e Raquel.

O Edge só oferece essas três vozes em pt-BR. As vozes multilíngues de outros idiomas não são listadas porque tendem a ler português com sotaque.

## Se o Edge parar de responder

O serviço não é oficial e já mudou de endereço antes. Não existe chave de API do usuário: a biblioteca usa um token público embutido nela (`TRUSTED_CLIENT_TOKEN`). O vozeiro lida com uma quebra de compatibilidade em três camadas:

1. Se o serviço recusar a conexão no endereço padrão da biblioteca (erro 403, por exemplo), ele tenta uma vez o endereço alternativo (`api.msedgeservices.com`, com o token da própria biblioteca) e passa a usá-lo até você reiniciar. O erro 429, de limite de pedidos, não dispara a troca.
2. Se continuar falhando, a narração mostra o erro com o comando para atualizar a biblioteca, que é de onde costuma vir a correção:

```bash
uv lock --upgrade-package edge-tts
```

3. Se só a lista de vozes falhar (ela usa outro endereço), a página avisa e as narrações seguem com a voz padrão, Antonio.

Não há motor de voz reserva: se o serviço mudar de um jeito que a biblioteca ainda não acompanha, a geração para até sair uma versão nova do edge-tts. Os áudios já gerados continuam no histórico.

### Quando a narração não funciona

1. Leia a mensagem na narração e o detalhe no terminal onde o vozeiro está rodando. Falhas de conexão, de limite de pedidos (429) e de relógio têm solução simples, na tabela de mensagens abaixo.
2. Se for erro 403 ou "respondeu de um jeito inesperado", atualize a biblioteca e reinicie o vozeiro:

   ```bash
   uv lock --upgrade-package edge-tts
   uv run vozeiro.py
   ```

3. Se já estiver na versão mais recente e continuar falhando, procure uma correção nas issues e nos commits do [edge-tts](https://github.com/rany2/edge-tts). Se ela estiver no GitHub e ainda não tiver sido publicada, instale direto de lá (precisa do `git`):

   ```bash
   uv add "edge-tts @ git+https://github.com/rany2/edge-tts"
   ```

   Para voltar à versão publicada:

   ```bash
   uv remove edge-tts && uv add edge-tts
   ```

4. Se ainda não houver correção, não há o que configurar: o token e o protocolo ficam dentro da biblioteca. A exceção é o endereço alternativo, a constante `ENDERECO_NOVO` em `vozeiro.py`. Espere uma nova versão e repita o passo 2.

## Mensagens de erro

Quando uma narração falha, o erro aparece na própria narração, com **Tentar de novo** e **Descartar**. As mensagens e o que fazer:

| Mensagem | Causa | O que fazer |
|---|---|---|
| Sem conexão com o serviço de voz | Sem internet ou rede bloqueando o serviço | Verifique a conexão e tente de novo |
| O serviço de voz recusou a conexão (erro 403) | A Microsoft mudou o serviço | Atualize o edge-tts (comando acima) |
| O serviço de voz limitou os pedidos | Muitos pedidos seguidos (erro 429) | Espere um pouco e tente de novo |
| O relógio do computador parece desajustado | Data e hora fora do lugar | Acerte o relógio do sistema |
| O serviço não gerou áudio para esse texto | Texto só com pontuação, sem palavras | Escreva um texto com palavras |
| Sem permissão para gravar / disco cheio | Problema na pasta `saidas/` | Verifique permissões e espaço em disco |
| Não consegui falar com o vozeiro | O servidor parou | Veja o terminal e rode `uv run vozeiro.py` de novo |
| Reinicie o vozeiro e recarregue a página | Página e servidor de versões diferentes (acontece depois de atualizar o código) | Reinicie o vozeiro |

## Estrutura

```
vozeiro.py            servidor (aiohttp), integração com o edge-tts e tradução de erros
static/
  index.html          marcação da página
  css/style.css       estilos
  js/main.js          liga formulário, histórico e fila
  js/narracoes.js     fila de narrações em paralelo, cancelar e tentar de novo
  js/historico.js     histórico, paginação, exclusão e narração em destaque
  js/vozes.js         lista de vozes agrupada
  js/player.js        reprodução de áudio
  js/api.js           requisições e tratamento de erros do servidor
  js/ui.js            funções auxiliares de interface
  js/formato.js       formatação de datas, tamanhos e textos
saidas/               áudios gerados (não versionada)
```

Os arquivos JavaScript são módulos nativos do navegador, então não há etapa de build.

## Limites e privacidade

- O texto é enviado à Microsoft para gerar o áudio. Evite dados sensíveis.
- O edge-tts usa um endpoint não documentado pela Microsoft, sem SLA, que pode mudar ou parar sem aviso. Por isso o projeto é pensado para uso local e pessoal, e não para hospedar como serviço público. Leia os termos de uso da Microsoft antes de usar de forma comercial.
- O servidor só escuta em `127.0.0.1` e só aceita pedidos feitos pela própria página (confere `Host` e `Origin`), então outros sites abertos no navegador não conseguem usá-lo.
- O edge-tts é distribuído sob LGPLv3.
