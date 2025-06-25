import { EXAMPLE_FILES, ExampleFile } from '../../config/exampleFiles';

export interface ExamplePanelEvents {
  exampleSelected: (filename: string, name: string) => void;
}

export class ExamplePanel {
  private examples: ExampleFile[] = EXAMPLE_FILES;
  private isVisible = false;
  private container: HTMLElement;

  constructor(container: HTMLElement) {
    this.container = container;
    this.render();
  }

  public toggle(): void {
    this.isVisible = !this.isVisible;
    this.render();
  }

  public hide(): void {
    this.isVisible = false;
    this.render();
  }

  private async loadExample(filename: string, name: string): Promise<void> {
    try {
      const response = await fetch(`./examples/${filename}`);
      if (!response.ok) {
        throw new Error(`Failed to load ${filename}`);
      }

      const gcodeContent = await response.text();

      // Create a synthetic file object with a fixed lastModified time for consistent caching
      const file = new File([gcodeContent], filename, {
        type: 'text/plain',
        lastModified: 1640995200000, // Fixed timestamp: Jan 1, 2022
      });

      // No longer emit event - file input change event handles everything

      // Trigger file input change event to integrate with existing file handling
      const fileInput = document.getElementById('fileInput') as HTMLInputElement;
      if (fileInput) {
        // Create a new FileList with our synthetic file
        const dataTransfer = new DataTransfer();
        dataTransfer.items.add(file);
        fileInput.files = dataTransfer.files;

        // Trigger change event
        const event = new Event('change', { bubbles: true });
        fileInput.dispatchEvent(event);
      }

      this.hide();
    } catch (error) {
      console.error('Failed to load example:', error);
      alert(`Failed to load example: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  private render(): void {
    if (!this.isVisible) {
      this.container.innerHTML = '';
      return;
    }

    this.container.innerHTML = `
      <div class="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
        <div class="bg-gray-800 rounded-lg p-6 max-w-2xl w-full mx-4 max-h-[80vh] overflow-y-auto">
          <div class="flex justify-between items-center mb-4">
            <h2 class="text-xl font-bold text-white">Try Example G-code Files</h2>
            <button id="close-examples" class="text-gray-400 hover:text-white text-2xl">&times;</button>
          </div>
          
          <p class="text-gray-300 mb-6">
            Don't have a G-code file? Try one of these examples to see the AMS Color Swapper in action.
          </p>
          
          <div class="grid gap-4">
            ${this.examples
              .map(
                (example) => `
              <div class="bg-gray-700 rounded-lg overflow-hidden hover:bg-gray-600 cursor-pointer transition-all hover:scale-[1.02]"
                   data-filename="${example.filename}" data-name="${example.name}">
                <div class="flex gap-4">
                  <!-- Image Column -->
                  <div class="w-48 h-48 flex-shrink-0 relative overflow-hidden" style="background: linear-gradient(135deg, ${example.placeholderColor}22, ${example.placeholderColor}44);">
                    ${
                      example.imageUrl
                        ? `
                      <img src="${example.imageUrl}" 
                           alt="${example.name}"
                           class="absolute inset-0 w-full h-full object-cover"
                           loading="lazy"
                           onerror="this.style.display='none'">
                    `
                        : ''
                    }
                    <div class="absolute inset-0 flex flex-col items-center justify-center ${example.imageUrl ? 'opacity-0 hover:opacity-100 transition-opacity bg-black/50' : ''}">
                      <div class="w-20 h-20 rounded-full flex items-center justify-center mb-2" style="background-color: ${example.placeholderColor}">
                        <svg class="w-12 h-12 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4"></path>
                        </svg>
                      </div>
                      <span class="text-white font-medium text-sm">${example.name.split(' ').pop()}</span>
                    </div>
                  </div>
                  
                  <!-- Content Column -->
                  <div class="flex-1 p-4">
                    <div class="flex justify-between items-start mb-2">
                      <h3 class="text-white font-semibold text-lg">${example.name}</h3>
                      <span class="text-xs bg-blue-600 text-white px-2 py-1 rounded">${example.colors} colors</span>
                    </div>
                    <p class="text-gray-300 text-sm mb-3">${example.description}</p>
                    <div class="flex items-center gap-3 text-xs text-gray-400 mb-3">
                      <span>Size: ${example.size}</span>
                      <span>•</span>
                      <span>by ${example.author}</span>
                    </div>
                    <div class="flex justify-between items-center">
                      <a href="${example.modelUrl}" 
                         target="_blank" 
                         rel="noopener noreferrer"
                         class="text-gray-400 hover:text-white text-sm inline-flex items-center gap-1"
                         onclick="event.stopPropagation()">
                        View on MakerWorld
                        <svg class="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14"></path>
                        </svg>
                      </a>
                      <button class="text-blue-400 hover:text-blue-300 text-sm font-medium">
                        Load Example →
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            `
              )
              .join('')}
          </div>
        </div>
      </div>
    `;

    // Add event listeners
    const closeButton = this.container.querySelector('#close-examples');
    closeButton?.addEventListener('click', () => this.hide());

    // Add click handlers for examples
    this.container.querySelectorAll('[data-filename]').forEach((element) => {
      element.addEventListener('click', () => {
        const filename = element.getAttribute('data-filename')!;
        const name = element.getAttribute('data-name')!;
        this.loadExample(filename, name);
      });
    });

    // Close on outside click
    const overlay = this.container.querySelector('.fixed');
    overlay?.addEventListener('click', (e) => {
      if (e.target === overlay) {
        this.hide();
      }
    });
  }
}
