import { Component } from '../../core/Component';
import { AppEvents } from '../../core/EventEmitter';
import { appState, AppStateData } from '../../state/AppState';
import { animateNumber, typewriterEffect } from '../../utils/animations';
import { gcodeCache } from '../../services/GcodeCache';

export class DebugPanel extends Component {
  private tabButtons: NodeListOf<HTMLElement>;
  private logsTab: HTMLElement;
  private performanceTab: HTMLElement;
  private rawTab: HTMLElement;
  private parserLogs: HTMLElement;
  private performanceStats: HTMLElement;
  private rawData: HTMLElement;

  constructor() {
    super('#debugSection');
    
    this.tabButtons = this.element.querySelectorAll('[data-tab]');
    this.logsTab = this.element.querySelector('#logsTab')!;
    this.performanceTab = this.element.querySelector('#performanceTab')!;
    this.rawTab = this.element.querySelector('#rawTab')!;
    this.parserLogs = this.element.querySelector('#parserLogs')!;
    this.performanceStats = this.element.querySelector('#performanceStats')!;
    this.rawData = this.element.querySelector('#rawData')!;
    
    this.attachEventListeners();
    this.addMicroInteractions();
    this.initialize();
  }

  protected render(): void {
    const { debugVisible, debugTab, logs, stats, optimization } = this.state;
    
    // Show/hide debug panel
    this.toggle(debugVisible);
    
    if (debugVisible) {
      // Update active tab
      this.setActiveTab(debugTab);
      
      // Update content based on active tab
      if (debugTab === 'logs') {
        this.updateLogs();
      } else if (debugTab === 'performance') {
        this.updatePerformance();
      } else if (debugTab === 'raw') {
        this.updateRawData();
      }
    }
  }

  protected shouldUpdate(oldState: AppStateData, newState: AppStateData): boolean {
    return (
      oldState.debugVisible !== newState.debugVisible ||
      oldState.debugTab !== newState.debugTab ||
      oldState.logs !== newState.logs ||
      oldState.stats !== newState.stats ||
      oldState.optimization !== newState.optimization
    );
  }

  private attachEventListeners(): void {
    this.tabButtons.forEach(btn => {
      btn.addEventListener('click', () => {
        const tab = btn.getAttribute('data-tab') as 'logs' | 'performance' | 'raw';
        if (tab) {
          appState.setState({ debugTab: tab });
          this.emit(AppEvents.TAB_CHANGE, tab);
        }
      });
    });
  }

  private addMicroInteractions(): void {
    // Add hover glow to tab buttons
    this.tabButtons.forEach((btn) => {
      btn.classList.add('transition-all', 'duration-300');
    });
  }

  private setActiveTab(tab: string): void {
    // Update button styles with smooth transitions
    this.tabButtons.forEach(btn => {
      const isActive = btn.getAttribute('data-tab') === tab;
      if (isActive) {
        btn.classList.add('text-white', 'border-b-2');
        
        // Apply gradient border based on tab
        if (tab === 'logs') {
          btn.classList.add('border-vibrant-pink');
        } else if (tab === 'performance') {
          btn.classList.add('border-vibrant-purple');
        } else {
          btn.classList.add('border-vibrant-blue');
        }
        
        btn.classList.remove('text-white/60', 'hover:text-white', 'border-transparent');
      } else {
        btn.classList.remove('text-white', 'border-b-2', 'border-vibrant-pink', 'border-vibrant-purple', 'border-vibrant-blue');
        btn.classList.add('text-white/60', 'hover:text-white', 'border-transparent');
      }
    });
    
    // Smooth tab transitions
    const tabs = [this.logsTab, this.performanceTab, this.rawTab];
    tabs.forEach((tabEl, index) => {
      const tabName = ['logs', 'performance', 'raw'][index];
      if (tabName === tab) {
        tabEl.classList.remove('hidden');
        tabEl.style.opacity = '0';
        tabEl.style.transform = 'translateY(10px)';
        
        requestAnimationFrame(() => {
          tabEl.style.transition = 'opacity 0.3s ease, transform 0.3s ease';
          tabEl.style.opacity = '1';
          tabEl.style.transform = 'translateY(0)';
        });
      } else {
        tabEl.style.opacity = '0';
        setTimeout(() => {
          tabEl.classList.add('hidden');
        }, 300);
      }
    });
  }

  private updateLogs(): void {
    const { logs } = this.state;
    
    if (logs.length === 0) {
      this.parserLogs.innerHTML = '<p class="text-gray-500">No logs available</p>';
      return;
    }
    
    const logHtml = logs.map((log, index) => {
      const time = new Date(log.timestamp).toLocaleTimeString();
      const levelColor = log.level === 'error' ? 'text-vibrant-pink' : 
                        log.level === 'warn' ? 'text-vibrant-orange' : 
                        log.level === 'info' ? 'text-vibrant-blue' : 'text-white/70';
      return `<div class="${levelColor} animate-fade-in" style="animation-delay: ${index * 20}ms">
        <span class="text-white/50">[${time}]</span> 
        <span class="font-semibold">[${log.level.toUpperCase()}]</span> 
        ${log.message}
      </div>`;
    }).join('');
    
    this.parserLogs.innerHTML = logHtml;
  }

  private async updatePerformance(): Promise<void> {
    const { stats } = this.state;
    
    if (!stats) {
      this.performanceStats.innerHTML = '<p class="text-gray-500">No performance data available</p>';
      return;
    }
    
    const maxLineNumber = stats.toolChanges.reduce((max, tc) => Math.max(max, tc.lineNumber), 0);
    
    // Get cache metadata
    const cacheMetadata = await gcodeCache.getMetadata();
    const cacheSize = (cacheMetadata.totalSize / 1024).toFixed(1); // Convert to KB
    
    this.performanceStats.innerHTML = `
      <div class="glass rounded-2xl p-6 text-center hover:scale-105 transition-transform animate-scale-in" style="animation-delay: 0ms">
        <div class="text-4xl font-bold gradient-text stat-value" data-value="${stats.parseTime}">0</div>
        <div class="text-sm text-white/60 uppercase tracking-wider mt-2">Parse Time (ms)</div>
      </div>
      <div class="glass rounded-2xl p-6 text-center hover:scale-105 transition-transform animate-scale-in" style="animation-delay: 50ms">
        <div class="text-4xl font-bold gradient-text stat-value" data-value="${maxLineNumber}">0</div>
        <div class="text-sm text-white/60 uppercase tracking-wider mt-2">Lines Processed</div>
      </div>
      <div class="glass rounded-2xl p-6 text-center hover:scale-105 transition-transform animate-scale-in" style="animation-delay: 100ms">
        <div class="text-4xl font-bold gradient-text stat-value" data-value="${stats.parserWarnings.length}">0</div>
        <div class="text-sm text-white/60 uppercase tracking-wider mt-2">Warnings</div>
      </div>
      <div class="glass rounded-2xl p-6 text-center hover:scale-105 transition-transform animate-scale-in" style="animation-delay: 150ms">
        <div class="text-4xl font-bold gradient-text">~${(stats.fileSize / stats.parseTime).toFixed(2)}</div>
        <div class="text-sm text-white/60 uppercase tracking-wider mt-2">KB/ms Parse Speed</div>
      </div>
      <div class="glass rounded-2xl p-6 text-center hover:scale-105 transition-transform animate-scale-in" style="animation-delay: 200ms">
        <div class="text-4xl font-bold gradient-text stat-value" data-value="${cacheMetadata.totalEntries}">0</div>
        <div class="text-sm text-white/60 uppercase tracking-wider mt-2">Cached Files</div>
      </div>
      <div class="glass rounded-2xl p-6 text-center hover:scale-105 transition-transform animate-scale-in" style="animation-delay: 250ms">
        <div class="text-4xl font-bold gradient-text">${cacheSize}</div>
        <div class="text-sm text-white/60 uppercase tracking-wider mt-2">Cache Size (KB)</div>
      </div>
    `;
    
    // Animate the numbers
    setTimeout(() => {
      const statElements = this.performanceStats.querySelectorAll('.stat-value[data-value]');
      statElements.forEach((el) => {
        const value = parseInt(el.getAttribute('data-value') || '0');
        animateNumber(el as HTMLElement, 0, value, 800);
      });
    }, 100);
  }

  private updateRawData(): void {
    const { stats, optimization } = this.state;
    
    if (!stats || !optimization) {
      this.rawData.textContent = 'No data available';
      return;
    }
    
    const data = {
      stats: {
        fileName: stats.fileName,
        fileSize: stats.fileSize,
        totalLayers: stats.totalLayers,
        totalHeight: stats.totalHeight,
        colors: stats.colors,
        toolChanges: stats.toolChanges.length,
        parseTime: stats.parseTime,
      },
      optimization: {
        totalColors: optimization.totalColors,
        requiredSlots: optimization.requiredSlots,
        manualSwaps: optimization.manualSwaps,
        slotAssignments: optimization.slotAssignments,
      },
    };
    
    this.rawData.textContent = JSON.stringify(data, null, 2);
  }
}