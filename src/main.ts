import './styles/main.css';
import { CameraPreview } from './camera/CameraPreview';
import { Galaxy } from './galaxy/Galaxy';
import type { HandTracker, HandTrackerStatus } from './hand/HandTracker';
import { InteractionState, type InteractionSnapshot } from './interaction/InteractionState';

class ProjetoXApp {
  private readonly interaction = new InteractionState();
  private readonly cameraPreview = new CameraPreview();
  private readonly galaxy: Galaxy;
  private tracker: HandTracker | null = null;
  private readonly intro: HTMLElement;
  private readonly activateButton: HTMLButtonElement;
  private readonly introError: HTMLElement;
  private readonly trackingStatus: HTMLElement;
  private readonly statusCopy: HTMLElement;
  private readonly gestureHint: HTMLElement;
  private readonly gestureHintCopy: HTMLElement;
  private readonly handRoles: HTMLElement;
  private readonly rightRole: HTMLElement;
  private readonly leftRole: HTMLElement;
  private readonly rightRoleState: HTMLElement;
  private readonly leftRoleState: HTMLElement;
  private trackingReady = false;
  private lastUiUpdate = -Infinity;

  public constructor() {
    const galaxyRoot = this.getElement<HTMLElement>('galaxy-root');
    this.intro = this.getElement<HTMLElement>('intro');
    this.activateButton = this.getElement<HTMLButtonElement>('activate-camera');
    this.introError = this.getElement<HTMLElement>('intro-error');
    this.trackingStatus = this.getElement<HTMLElement>('tracking-status');
    this.statusCopy = this.getElement<HTMLElement>('status-copy');
    this.gestureHint = this.getElement<HTMLElement>('gesture-hint');
    this.gestureHintCopy = this.getElement<HTMLElement>('gesture-hint-copy');
    this.handRoles = this.getElement<HTMLElement>('hand-roles');
    this.rightRole = this.getElement<HTMLElement>('right-role');
    this.leftRole = this.getElement<HTMLElement>('left-role');
    this.rightRoleState = this.getElement<HTMLElement>('right-role-state');
    this.leftRoleState = this.getElement<HTMLElement>('left-role-state');

    this.galaxy = new Galaxy(galaxyRoot);
    this.activateButton.addEventListener('click', () => void this.activate());
    this.galaxy.start((deltaSeconds, timestampMs) => {
      this.tracker?.update(timestampMs);
      const state = this.interaction.update(deltaSeconds, timestampMs);
      this.updateInterface(state, timestampMs);
      return state;
    });

    window.addEventListener('pagehide', () => this.tracker?.stop(), { once: true });
  }

  private async activate(): Promise<void> {
    this.activateButton.disabled = true;
    this.introError.textContent = '';

    try {
      if (!this.tracker) {
        this.handleTrackerStatus('loading-model');
        const { HandTracker: HandTrackerImplementation } = await import('./hand/HandTracker');
        this.tracker = new HandTrackerImplementation({
          video: this.cameraPreview.videoElement,
          onStatusChange: (status) => this.handleTrackerStatus(status),
          onFrame: (frame) => {
            this.interaction.ingest(frame, performance.now());
            this.cameraPreview.update(frame);
          },
        });
      }
      await this.tracker.start();
      this.cameraPreview.setActive(true);
      this.trackingReady = true;
      this.intro.classList.add('is-dismissed');
      this.gestureHint.classList.add('is-visible');
      this.handRoles.classList.add('is-visible');
    } catch {
      if (!this.tracker) this.handleTrackerStatus('error');
      this.activateButton.disabled = false;
    }
  }

  private handleTrackerStatus(status: HandTrackerStatus): void {
    const labels: Record<HandTrackerStatus, string> = {
      idle: 'STANDBY',
      'loading-model': 'LOADING MODEL',
      'requesting-camera': 'AWAITING CAMERA',
      ready: 'ACTIVE',
      'permission-denied': 'ACCESS DENIED',
      'camera-unavailable': 'CAMERA UNAVAILABLE',
      error: 'SYSTEM ERROR',
    };

    this.statusCopy.textContent = labels[status];
    this.trackingStatus.dataset.state = status;

    if (status === 'loading-model') {
      this.activateButton.querySelector('span')!.textContent = 'CARREGANDO MODELO';
    } else if (status === 'requesting-camera') {
      this.activateButton.querySelector('span')!.textContent = 'AUTORIZE A CÂMERA';
    } else if (status === 'ready') {
      this.activateButton.querySelector('span')!.textContent = 'CÂMERA ATIVA';
    } else if (status === 'permission-denied') {
      this.showActivationError('Permissão negada. Libere o acesso à câmera e tente novamente.');
    } else if (status === 'camera-unavailable') {
      this.showActivationError('Nenhuma câmera disponível ou ela está sendo usada por outro aplicativo.');
    } else if (status === 'error') {
      this.showActivationError('Não foi possível iniciar o rastreamento. Verifique sua conexão e tente novamente.');
    }
  }

  private showActivationError(message: string): void {
    this.introError.textContent = message;
    this.activateButton.querySelector('span')!.textContent = 'TENTAR NOVAMENTE';
  }

  private updateInterface(interaction: InteractionSnapshot, timestampMs: number): void {
    if (!this.trackingReady || timestampMs - this.lastUiUpdate < 100) return;
    this.lastUiUpdate = timestampMs;

    const { right, left, handCount } = interaction;
    this.rightRole.dataset.active = String(right.detected);
    this.leftRole.dataset.active = String(left.detected);
    this.rightRoleState.textContent = right.detected
      ? `FIELD ${Math.round(right.openness * 100).toString().padStart(2, '0')}%`
      : 'WAITING';
    this.leftRoleState.textContent = left.detected
      ? `SOL ${Math.round(left.openness * 100).toString().padStart(2, '0')}% · Z ${Math.round(interaction.zoom * 100).toString().padStart(2, '0')}%`
      : 'WAITING';

    if (handCount > 0) {
      this.statusCopy.textContent = handCount === 2
        ? 'DUAL ACTIVE'
        : right.detected
          ? 'RIGHT ACTIVE'
          : 'LEFT ACTIVE';
      this.trackingStatus.dataset.state = 'ready';
      this.gestureHint.classList.add('has-hand');

      if (right.detected && left.detected) {
        this.gestureHintCopy.textContent = left.openness < 0.18
          ? 'Abra a mão esquerda para restaurar o sol'
          : interaction.zoom > 0.55
            ? 'Foco solar ativo · mova a mão esquerda para explorar'
            : 'Feche a esquerda para encolher · faça pinça para aproximar o sol';
      } else if (right.detected) {
        this.gestureHintCopy.textContent = right.openness < 0.35
          ? 'Abra a mão direita para expandir'
          : 'Feche a mão direita · levante a esquerda para revelar o sol';
      } else {
        this.gestureHintCopy.textContent = left.openness < 0.18
          ? 'Sol recolhido · abra a mão esquerda para restaurar'
          : 'Sol ativo · feche para recolher ou faça pinça para aproximar';
      }
    } else {
      this.statusCopy.textContent = 'SEARCHING';
      this.trackingStatus.dataset.state = 'searching';
      this.gestureHintCopy.textContent = 'Mão direita: matéria · mão esquerda: sol e lente';
      this.gestureHint.classList.remove('has-hand');
    }
  }

  private getElement<T extends HTMLElement>(id: string): T {
    const element = document.getElementById(id);
    if (!element) throw new Error(`Missing required element #${id}`);
    return element as T;
  }
}

try {
  new ProjetoXApp();
} catch (error: unknown) {
  console.error('Projeto X failed to initialize:', error);
  document.body.classList.add('fatal-error');
  const introError = document.getElementById('intro-error');
  if (introError) introError.textContent = 'WebGL não está disponível neste dispositivo.';
}
