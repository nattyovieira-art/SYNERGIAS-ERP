import * as modulo from './vendor/transformers.min.js'

let transcritor = null
let processando = false
let pendente = null
let maiorSequenciaConcluida = 0

async function carregarTranscritor() {
  if (transcritor) return transcritor

  self.postMessage({
    tipo: 'status',
    mensagem: 'Preparando reconhecimento da SYA. Na primeira vez, aguarde o modelo de voz carregar...',
  })

  modulo.env.allowLocalModels = false
  modulo.env.useBrowserCache = true
  modulo.env.backends.onnx.wasm.wasmPaths = '/sya-transformers/'

  transcritor = await modulo.pipeline(
    'automatic-speech-recognition',
    'Xenova/whisper-base',
    {
      quantized: true,
      progress_callback: (progresso) => {
        if (progresso?.status === 'progress' && Number.isFinite(progresso.progress)) {
          const percentual = Math.max(0, Math.min(100, Math.round(progresso.progress)))
          self.postMessage({
            tipo: 'status',
            mensagem: `Preparando voz da SYA... ${percentual}%`,
          })
        }
      },
    }
  )

  return transcritor
}

function guardarPendente(dados) {
  if (pendente?.tipo === 'transcrever-final' && dados.tipo !== 'transcrever-final') return

  if (!pendente || dados.tipo === 'transcrever-final' || dados.sequencia >= pendente.sequencia) {
    pendente = dados
  }
}

async function executarTranscricao(dados) {
  if (processando) {
    guardarPendente(dados)
    return
  }

  processando = true

  try {
    const pipelineVoz = await carregarTranscritor()
    const final = dados.tipo === 'transcrever-final'

    if (final) {
      self.postMessage({ tipo: 'status', mensagem: 'Finalizando o que você falou...' })
    }

    const resultado = await pipelineVoz(dados.audio, {
      language: 'portuguese',
      task: 'transcribe',
      chunk_length_s: final ? 20 : 12,
      stride_length_s: final ? 3 : 2,
    })

    const texto = Array.isArray(resultado)
      ? resultado.map((item) => item?.text || '').join(' ')
      : resultado?.text || ''

    maiorSequenciaConcluida = Math.max(maiorSequenciaConcluida, Number(dados.sequencia) || 0)

    self.postMessage({
      tipo: final ? 'resultado' : 'parcial',
      texto: String(texto).trim(),
      sequencia: dados.sequencia,
    })
  } catch (erro) {
    console.error('SYA transcription error', erro)
    self.postMessage({
      tipo: 'erro',
      mensagem: 'Não consegui carregar o reconhecimento de voz da SYA. Verifique a internet na primeira utilização e tente novamente.',
    })
  } finally {
    processando = false

    const proximo = pendente
    pendente = null

    if (proximo && Number(proximo.sequencia || 0) > maiorSequenciaConcluida) {
      void executarTranscricao(proximo)
    }
  }
}

self.onmessage = (event) => {
  const dados = event.data
  if (!dados || !['transcrever-parcial', 'transcrever-final'].includes(dados.tipo)) return
  void executarTranscricao(dados)
}
