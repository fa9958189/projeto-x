# Projeto X

Experimento de visão computacional e arte generativa que permite controlar uma galáxia virtual através dos movimentos da mão.

## Sobre o projeto

O Projeto X transforma a abertura da mão em uma força gravitacional contínua. Uma mão aberta expande a galáxia; ao fechar os dedos, cada estrela é atraída individualmente para o núcleo e entra em um movimento de vórtice. Toda a experiência funciona no navegador, sem backend, banco de dados ou envio das imagens da câmera.

## Tecnologias

- Vite e TypeScript
- Three.js e WebGL
- MediaPipe Tasks Vision (`@mediapipe/tasks-vision`)
- CSS puro
- `THREE.Points`, `BufferGeometry` e shaders GLSL

## Como funciona

```text
Webcam
  ↓
MediaPipe Hand Tracking
  ↓
Hand Landmarks
  ↓
Gesture Analysis
  ↓
Interaction State
  ↓
Three.js
  ↓
Galaxy Particle System
```

O MediaPipe identifica 21 landmarks da mão. A função `getHandOpenness(landmarks)` combina três sinais para cada dedo: comprimento direto em relação à cadeia das articulações, alinhamento entre as falanges e distância da ponta do dedo até a palma. Todas as distâncias são normalizadas pelo comprimento e pela largura da própria palma, reduzindo a influência da distância até a webcam.

O resultado é um valor contínuo entre `0` e `1`, filtrado com suavização exponencial dependente do tempo. Quando a mão desaparece, o estado de interação retorna lentamente a uma abertura neutra.

## Arquitetura

```text
src/
├── camera/
│   └── CameraPreview.ts       # Janela de câmera e overlay opcional de landmarks
├── config/
│   └── constants.ts           # Modelo, performance e configuração de debug
├── galaxy/
│   ├── Galaxy.ts              # Cena, render loop e deformação GPU
│   └── galaxyGenerator.ts     # Geração procedural dos buffers imutáveis
├── hand/
│   ├── HandTracker.ts         # Webcam e inferência MediaPipe
│   ├── handMath.ts            # Operações geométricas normalizadas
│   ├── handOpenness.ts        # Análise contínua da abertura da mão
│   └── smoothing.ts           # Filtro exponencial independente do FPS
├── interaction/
│   └── InteractionState.ts    # Estado desacoplado entre visão e renderização
├── styles/
│   └── main.css
└── main.ts                    # Orquestração da experiência
```

As posições-base das partículas permanecem no `BufferGeometry`. A compressão, a expansão e o vórtice são calculados no vertex shader a partir de uniforms, sem reescrever milhares de posições a cada frame. Essa divisão mantém o gerador procedural independente do material e facilita novas versões dos shaders.

## Como executar

Requisitos: Node.js 20 ou superior e uma webcam.

```bash
npm install
npm run dev
```

Acesse a URL local exibida pelo Vite, clique em **ATIVAR CÂMERA** e permita o acesso. A primeira inicialização baixa o modelo oficial do MediaPipe; nenhuma chave de API é necessária.

Para validar a versão de produção:

```bash
npm run build
npm run preview
```

> O acesso à webcam exige `localhost` ou uma origem HTTPS em produção.

## Controles

- **Abrir a mão:** expande a galáxia.
- **Fechar a mão:** comprime as estrelas em direção ao núcleo.
- **Mover para os lados:** altera sutilmente a rotação horizontal.
- **Mover para cima ou para baixo:** inclina a galáxia suavemente.

Para visualizar os landmarks, altere `DEBUG_HAND_TRACKING` para `true` em `src/config/constants.ts`.

## Próximas funcionalidades

- Calibração opcional por usuário e condições de iluminação.
- MediaPipe em Web Worker com `OffscreenCanvas` quando o suporte for adequado.
- Adaptação dinâmica de qualidade baseada no tempo de frame.
- Materiais e pós-processamento WebGL ainda mais sofisticados.

## Screenshots

_Adicionar capturas da experiência após a publicação._

## Demo

_Adicionar a URL da versão publicada._

## Privacidade

Os frames da webcam são processados localmente no navegador. O projeto não possui servidor e não armazena imagens ou dados biométricos.
