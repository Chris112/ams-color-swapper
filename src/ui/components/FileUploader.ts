import { Component } from '../../core/Component';
import { AppEvents } from '../../core/EventEmitter';
import { appState, AppStateData } from '../../state/AppState';
import { addMagneticEffect, addGlowHover } from '../../utils/animations';

export class FileUploader extends Component {
  private dropZone!: HTMLElement;
  private fileInput!: HTMLInputElement;
  private progressBar!: HTMLElement;
  private progressFill!: HTMLElement;
  private progressText!: HTMLElement;

  constructor() {
    super('#uploadSection');

    // Ensure DOM elements exist
    const dropZone = this.element.querySelector('#dropZone');
    const fileInput = this.element.querySelector('#fileInput') as HTMLInputElement;
    const progressBar = this.element.querySelector('#uploadProgress');
    const progressFill = this.element.querySelector('#progressBarFill');
    const progressText = progressBar?.querySelector('p');

    if (!dropZone || !fileInput || !progressBar || !progressFill || !progressText) {
      console.error('FileUploader: Required DOM elements not found');
      return;
    }

    this.dropZone = dropZone as HTMLElement;
    this.fileInput = fileInput;
    this.progressBar = progressBar as HTMLElement;
    this.progressFill = progressFill as HTMLElement;
    this.progressText = progressText as HTMLElement;

    this.attachEventListeners();
    this.addMicroInteractions();
    this.initialize();
  }

  protected render(): void {
    const { view, isLoading, loadingProgress, loadingMessage } = this.state;

    // FileUploader render

    // Show/hide based on view
    this.toggle(view === 'upload');

    // Also hide/show the Why section
    const whySection = document.getElementById('whySection');
    if (whySection) {
      if (view === 'upload') {
        whySection.classList.remove('hidden');
        whySection.removeAttribute('hidden');
      } else {
        whySection.classList.add('hidden');
        whySection.setAttribute('hidden', '');
      }
    }

    // Update progress bar
    if (isLoading && this.progressBar && this.progressFill && this.progressText) {
      this.progressBar.classList.remove('hidden');
      this.progressBar.removeAttribute('hidden');
      this.progressFill.style.width = `${loadingProgress}%`;
      this.progressText.textContent = loadingMessage || '';
    } else if (this.progressBar) {
      this.progressBar.classList.add('hidden');
      this.progressBar.setAttribute('hidden', '');
    }
  }

  protected shouldUpdate(oldState: AppStateData, newState: AppStateData): boolean {
    return (
      oldState.view !== newState.view ||
      oldState.isLoading !== newState.isLoading ||
      oldState.loadingProgress !== newState.loadingProgress ||
      oldState.loadingMessage !== newState.loadingMessage
    );
  }

  private attachEventListeners(): void {
    if (!this.dropZone || !this.fileInput) return;

    // File input
    this.dropZone.addEventListener('click', () => this.fileInput?.click());
    this.fileInput.addEventListener('change', this.handleFileSelect.bind(this));

    // Drag and drop
    this.dropZone.addEventListener('dragover', this.handleDragOver.bind(this));
    this.dropZone.addEventListener('dragleave', this.handleDragLeave.bind(this));
    this.dropZone.addEventListener('drop', this.handleDrop.bind(this));
  }

  private addMicroInteractions(): void {
    if (!this.dropZone) return;

    // Add magnetic effect to button
    const button = this.dropZone.querySelector('button');
    if (button) {
      addMagneticEffect(button as HTMLElement, 0.4);
      addGlowHover(button as HTMLElement, 'pink');
    }

    // Add smooth transition for icon
    const icon = this.dropZone.querySelector('svg');
    if (icon) {
      icon.classList.add('transition-all', 'duration-300');
    }

    // Track mouse state for border animation
    let isMouseInside = false;

    // Add border animation on mouse enter/leave
    this.dropZone.addEventListener('mouseenter', (e) => {
      isMouseInside = true;
      this.dropZone!.classList.add('border-active');
      this.dropZone!.style.boxShadow = '0 0 15px rgba(255, 0, 110, 0.2)';
      this.dropZone!.style.transition = 'transform 0.2s ease, box-shadow 0.3s ease';
    });

    this.dropZone.addEventListener('mouseleave', (e) => {
      isMouseInside = false;
      this.dropZone!.classList.remove('border-active');
      this.dropZone!.style.transform = '';
      this.dropZone!.style.boxShadow = '';
    });

    // Add mouse tracking for gradient glow and 3D tilt
    this.dropZone.addEventListener('mousemove', (e) => {
      if (!isMouseInside) {
        this.dropZone!.classList.add('border-active');
        isMouseInside = true;
      }

      const rect = this.dropZone!.getBoundingClientRect();
      const x = ((e.clientX - rect.left) / rect.width) * 100;
      const y = ((e.clientY - rect.top) / rect.height) * 100;

      // Set gradient position
      this.dropZone!.style.setProperty('--mouse-x', `${x}%`);
      this.dropZone!.style.setProperty('--mouse-y', `${y}%`);

      // Add 3D tilt effect
      const xPercent = (x / 100 - 0.5) * 2; // -1 to 1
      const yPercent = (y / 100 - 0.5) * 2; // -1 to 1
      const maxTilt = 10;
      const xDeg = xPercent * maxTilt;
      const yDeg = yPercent * maxTilt;

      this.dropZone!.style.transform = `perspective(1000px) rotateY(${xDeg}deg) rotateX(${-yDeg}deg) scale(1.02)`;
    });
  }

  private handleFileSelect(event: Event): void {
    const input = event.target as HTMLInputElement;
    if (input.files && input.files[0]) {
      this.processFile(input.files[0]);
      // Reset the input value so the same file can be selected again
      input.value = '';
    }
  }

  private handleDragOver(event: DragEvent): void {
    event.preventDefault();
    if (this.dropZone) {
      this.dropZone.classList.add('drag-over');
      // Add haptic feedback for mobile if supported
      if ('vibrate' in navigator) {
        navigator.vibrate(10);
      }
    }
  }

  private handleDragLeave(event: DragEvent): void {
    event.preventDefault();
    if (this.dropZone) {
      this.dropZone.classList.remove('drag-over');
    }
  }

  private handleDrop(event: DragEvent): void {
    event.preventDefault();
    if (this.dropZone) {
      this.dropZone.classList.remove('drag-over');
    }

    if (!event.dataTransfer) return;

    const files = Array.from(event.dataTransfer.files);
    const gcodeFile = files.find((f) => this.isValidGcodeFile(f));

    if (gcodeFile) {
      // Add success animation
      this.dropZone.style.animation = 'pulse-glow 0.6s ease-out';
      setTimeout(() => {
        if (this.dropZone) {
          this.dropZone.style.animation = '';
        }
      }, 600);
      this.processFile(gcodeFile);
    } else {
      // Add error shake animation
      this.dropZone.style.animation = 'shake 0.5s ease-in-out';
      setTimeout(() => {
        if (this.dropZone) {
          this.dropZone.style.animation = '';
        }
      }, 500);
      alert('Please drop a valid G-code file (.gcode, .gco, .g)');
    }
  }

  private isValidGcodeFile(file: File): boolean {
    const validExtensions = ['.gcode', '.gco', '.g'];
    const ext = file.name.toLowerCase().substring(file.name.lastIndexOf('.'));
    return validExtensions.includes(ext);
  }

  private processFile(file: File): void {
    if (!this.isValidGcodeFile(file)) {
      alert('Please select a valid G-code file');
      return;
    }

    if (file.size > 200 * 1024 * 1024) {
      alert('File size exceeds 200MB limit');
      return;
    }

    appState.setState({ currentFile: file });
    this.emit(AppEvents.FILE_SELECTED, file);
  }

  protected cleanup(): void {
    // Reset file input on cleanup
    if (this.fileInput) {
      this.fileInput.value = '';
    }
  }
}
