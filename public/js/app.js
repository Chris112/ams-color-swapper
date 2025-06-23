class GcodeAnalyzer {
    constructor() {
        this.currentFile = null;
        this.analysisResult = null;
        this.initializeElements();
        this.attachEventListeners();
    }

    initializeElements() {
        this.dropZone = document.getElementById('dropZone');
        this.fileInput = document.getElementById('fileInput');
        this.uploadProgress = document.getElementById('uploadProgress');
        this.uploadSection = document.getElementById('uploadSection');
        this.resultsSection = document.getElementById('resultsSection');
        this.debugSection = document.getElementById('debugSection');
        this.exportBtn = document.getElementById('exportBtn');
        this.newFileBtn = document.getElementById('newFileBtn');
        this.toggleDebugBtn = document.getElementById('toggleDebugBtn');
    }

    attachEventListeners() {
        this.dropZone.addEventListener('click', () => this.fileInput.click());
        this.fileInput.addEventListener('change', (e) => this.handleFileSelect(e.target.files[0]));
        
        this.dropZone.addEventListener('dragover', this.handleDragOver.bind(this));
        this.dropZone.addEventListener('dragleave', this.handleDragLeave.bind(this));
        this.dropZone.addEventListener('drop', this.handleDrop.bind(this));
        
        this.exportBtn.addEventListener('click', () => this.exportResults());
        this.newFileBtn.addEventListener('click', () => this.resetAnalyzer());
        this.toggleDebugBtn.addEventListener('click', () => this.toggleDebug());
        
        document.querySelectorAll('.tab-btn').forEach(btn => {
            btn.addEventListener('click', (e) => this.switchTab(e.target.dataset.tab));
        });
    }

    handleDragOver(e) {
        e.preventDefault();
        this.dropZone.classList.add('dragover');
    }

    handleDragLeave(e) {
        e.preventDefault();
        this.dropZone.classList.remove('dragover');
    }

    handleDrop(e) {
        e.preventDefault();
        this.dropZone.classList.remove('dragover');
        
        const files = Array.from(e.dataTransfer.files);
        const gcodeFile = files.find(f => this.isValidGcodeFile(f));
        
        if (gcodeFile) {
            this.handleFileSelect(gcodeFile);
        } else {
            alert('Please drop a valid G-code file (.gcode, .gco, .g)');
        }
    }

    isValidGcodeFile(file) {
        const validExtensions = ['.gcode', '.gco', '.g'];
        const ext = file.name.toLowerCase().substring(file.name.lastIndexOf('.'));
        return validExtensions.includes(ext);
    }

    async handleFileSelect(file) {
        if (!file || !this.isValidGcodeFile(file)) {
            alert('Please select a valid G-code file');
            return;
        }

        this.currentFile = file;
        this.showUploadProgress();
        
        try {
            const fileData = await this.uploadFile(file);
            await this.analyzeFile(fileData.file.id);
        } catch (error) {
            console.error('Error:', error);
            alert('Failed to process file: ' + error.message);
            this.resetAnalyzer();
        }
    }

    showUploadProgress() {
        this.uploadProgress.style.display = 'block';
        const progressFill = this.uploadProgress.querySelector('.progress-fill');
        progressFill.style.width = '0%';
        
        let progress = 0;
        const interval = setInterval(() => {
            progress += Math.random() * 30;
            if (progress > 90) {
                clearInterval(interval);
                progress = 90;
            }
            progressFill.style.width = progress + '%';
        }, 200);
    }

    async uploadFile(file) {
        const formData = new FormData();
        formData.append('gcode', file);
        
        const response = await fetch('/api/upload', {
            method: 'POST',
            body: formData
        });
        
        if (!response.ok) {
            throw new Error('Upload failed');
        }
        
        return response.json();
    }

    async analyzeFile(fileId) {
        const progressFill = this.uploadProgress.querySelector('.progress-fill');
        progressFill.style.width = '95%';
        this.uploadProgress.querySelector('.progress-text').textContent = 'Analyzing...';
        
        const response = await fetch(`/api/analyze/${fileId}`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({ optimize: true })
        });
        
        if (!response.ok) {
            throw new Error('Analysis failed');
        }
        
        this.analysisResult = await response.json();
        progressFill.style.width = '100%';
        
        setTimeout(() => {
            this.displayResults();
        }, 500);
    }

    displayResults() {
        this.uploadSection.style.display = 'none';
        this.resultsSection.style.display = 'block';
        
        this.displayFileStats();
        this.displayColorStats();
        this.displayOptimization();
        this.displaySwapInstructions();
        this.displayDebugInfo();
        this.drawColorTimeline();
    }

    displayFileStats() {
        const stats = this.analysisResult.stats;
        const statsHtml = `
            <div class="stat-item">
                <span class="stat-label">File Name</span>
                <span class="stat-value">${stats.fileName}</span>
            </div>
            <div class="stat-item">
                <span class="stat-label">File Size</span>
                <span class="stat-value">${this.formatFileSize(stats.fileSize)}</span>
            </div>
            <div class="stat-item">
                <span class="stat-label">Slicer</span>
                <span class="stat-value">${stats.slicerInfo ? `${stats.slicerInfo.software} v${stats.slicerInfo.version}` : 'Unknown'}</span>
            </div>
            <div class="stat-item">
                <span class="stat-label">Total Layers</span>
                <span class="stat-value">${stats.totalLayers}</span>
            </div>
            <div class="stat-item">
                <span class="stat-label">Total Height</span>
                <span class="stat-value">${stats.totalHeight ? stats.totalHeight.toFixed(2) + 'mm' : 'Unknown'}</span>
            </div>
            <div class="stat-item">
                <span class="stat-label">Colors Used</span>
                <span class="stat-value">${stats.colors.length}</span>
            </div>
            <div class="stat-item">
                <span class="stat-label">Tool Changes</span>
                <span class="stat-value">${stats.toolChanges.length}</span>
            </div>
            <div class="stat-item">
                <span class="stat-label">Parse Time</span>
                <span class="stat-value">${stats.parseTime}ms</span>
            </div>
        `;
        
        document.getElementById('fileStats').innerHTML = statsHtml;
    }

    displayColorStats() {
        const colors = this.analysisResult.stats.colors;
        let colorHtml = '';
        
        colors.forEach(color => {
            colorHtml += `
                <div class="color-item">
                    <div class="color-swatch" style="background-color: ${color.hexColor}"></div>
                    <div class="color-info">
                        <div class="color-name">${color.name || color.id}</div>
                        <div class="color-details">
                            Layers ${color.firstLayer}-${color.lastLayer} 
                            (${color.layerCount} layers, ${color.usagePercentage ? color.usagePercentage.toFixed(1) : '0.0'}%)
                        </div>
                    </div>
                </div>
            `;
        });
        
        document.getElementById('colorStats').innerHTML = colorHtml;
    }

    displayOptimization() {
        const opt = this.analysisResult.optimization;
        if (!opt) return;
        
        let optHtml = `
            <div class="stat-item">
                <span class="stat-label">Total Colors</span>
                <span class="stat-value">${opt.totalColors}</span>
            </div>
            <div class="stat-item">
                <span class="stat-label">Required AMS Slots</span>
                <span class="stat-value">${opt.requiredSlots}</span>
            </div>
            <div class="stat-item">
                <span class="stat-label">Manual Swaps Needed</span>
                <span class="stat-value">${opt.manualSwaps.length}</span>
            </div>
            <div class="stat-item">
                <span class="stat-label">Estimated Time Saved</span>
                <span class="stat-value">${Math.round(opt.estimatedTimeSaved / 60)} minutes</span>
            </div>
        `;
        
        optHtml += '<h3 style="margin-top: 20px; margin-bottom: 12px;">Slot Assignments</h3>';
        
        opt.slotAssignments.forEach(slot => {
            optHtml += `
                <div class="slot-assignment">
                    <div class="slot-header">AMS Slot ${slot.slot} ${slot.isPermanent ? '(Permanent)' : '(Shared)'}</div>
                    <div class="slot-colors">
                        ${slot.colors.map(c => {
                            const color = this.analysisResult.stats.colors.find(col => col.id === c);
                            return `<span class="color-tag">
                                <span class="color-swatch" style="background-color: ${color.hexColor}; width: 16px; height: 16px; display: inline-block; border-radius: 2px;"></span>
                                ${color.name || color.id}
                            </span>`;
                        }).join('')}
                    </div>
                </div>
            `;
        });
        
        document.getElementById('optimizationResults').innerHTML = optHtml;
    }

    displaySwapInstructions() {
        const swaps = this.analysisResult.optimization?.manualSwaps || [];
        
        if (swaps.length === 0) {
            document.getElementById('swapInstructions').innerHTML = `
                <div class="no-swaps-message">
                    <div class="no-swaps-icon">✅</div>
                    <h3>No Manual Swaps Required!</h3>
                    <p>Your print is optimized perfectly for the available AMS slots.</p>
                </div>
            `;
            return;
        }
        
        let swapHtml = `
            <div class="swap-overview">
                <h3>📋 ${swaps.length} Manual Swap${swaps.length > 1 ? 's' : ''} Required</h3>
                <p>Follow these steps to complete your multi-color print</p>
            </div>
        `;
        
        swaps.forEach((swap, index) => {
            const fromColor = this.analysisResult.stats.colors.find(c => c.id === swap.fromColor);
            const toColor = this.analysisResult.stats.colors.find(c => c.id === swap.toColor);
            
            swapHtml += `
                <div class="swap-item">
                    <div class="swap-step-number">${index + 1}</div>
                    
                    <div class="swap-timing">
                        <svg class="swap-timing-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor">
                            <rect x="3" y="4" width="18" height="18" rx="2" ry="2"></rect>
                            <line x1="16" y1="2" x2="16" y2="6"></line>
                            <line x1="8" y1="2" x2="8" y2="6"></line>
                            <line x1="3" y1="10" x2="21" y2="10"></line>
                        </svg>
                        Layer ${swap.atLayer}
                    </div>
                    
                    <div class="swap-content">
                        <div class="swap-color-container">
                            <div class="swap-color-circle" style="background-color: ${fromColor?.hexColor || '#888'}">
                                <span style="color: ${this.getContrastColor(fromColor?.hexColor || '#888')}; font-weight: bold;">
                                    ${fromColor?.id.substring(1) || '?'}
                                </span>
                            </div>
                            <div class="swap-color-label">${fromColor?.name || fromColor?.id || swap.fromColor}</div>
                        </div>
                        
                        <div class="swap-arrow">
                            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                                <line x1="5" y1="12" x2="19" y2="12"></line>
                                <polyline points="12 5 19 12 12 19"></polyline>
                            </svg>
                        </div>
                        
                        <div class="swap-color-container">
                            <div class="swap-color-circle" style="background-color: ${toColor?.hexColor || '#888'}">
                                <span style="color: ${this.getContrastColor(toColor?.hexColor || '#888')}; font-weight: bold;">
                                    ${toColor?.id.substring(1) || '?'}
                                </span>
                            </div>
                            <div class="swap-color-label">${toColor?.name || toColor?.id || swap.toColor}</div>
                            <div class="swap-slot-indicator">AMS Slot ${swap.slot}</div>
                        </div>
                    </div>
                    
                    <div class="swap-reason">
                        <strong>Why this swap:</strong> ${swap.reason}
                        ${swap.zHeight ? `<br><strong>Height:</strong> Z${swap.zHeight.toFixed(2)}mm` : ''}
                    </div>
                </div>
            `;
        });
        
        // Add timeline visualization
        if (swaps.length > 0) {
            const totalLayers = this.analysisResult.stats.totalLayers;
            swapHtml += `
                <div class="swap-timeline">
                    <h4 style="margin-bottom: 16px;">Swap Timeline</h4>
                    <div class="swap-timeline-bar">
                        ${swaps.map((swap, index) => {
                            const position = (swap.atLayer / totalLayers) * 100;
                            return `
                                <div class="swap-timeline-marker" 
                                     style="left: ${position}%"
                                     title="Swap ${index + 1} at layer ${swap.atLayer}">
                                </div>
                                <div class="swap-timeline-label" style="left: ${position}%">
                                    ${swap.atLayer}
                                </div>
                            `;
                        }).join('')}
                    </div>
                    <div style="display: flex; justify-content: space-between; margin-top: 8px; font-size: 0.85rem; color: var(--text-secondary);">
                        <span>Layer 0</span>
                        <span>Layer ${totalLayers}</span>
                    </div>
                </div>
            `;
        }
        
        document.getElementById('swapInstructions').innerHTML = swapHtml;
    }
    
    getContrastColor(hexColor) {
        // Convert hex to RGB
        const r = parseInt(hexColor.substr(1, 2), 16);
        const g = parseInt(hexColor.substr(3, 2), 16);
        const b = parseInt(hexColor.substr(5, 2), 16);
        
        // Calculate luminance
        const luminance = (0.299 * r + 0.587 * g + 0.114 * b) / 255;
        
        // Return black or white depending on luminance
        return luminance > 0.5 ? '#000000' : '#ffffff';
    }

    drawColorTimeline() {
        const canvas = document.getElementById('colorTimeline');
        const ctx = canvas.getContext('2d');
        const stats = this.analysisResult.stats;
        
        canvas.width = canvas.offsetWidth;
        canvas.height = 200;
        
        ctx.fillStyle = '#334155';
        ctx.fillRect(0, 0, canvas.width, canvas.height);
        
        const barHeight = 60;
        const barY = (canvas.height - barHeight) / 2;
        const layerWidth = canvas.width / stats.totalLayers;
        
        stats.colorUsageRanges.forEach(range => {
            const color = stats.colors.find(c => c.id === range.colorId);
            if (!color) return;
            
            const x = range.startLayer * layerWidth;
            const width = (range.endLayer - range.startLayer + 1) * layerWidth;
            
            ctx.fillStyle = color.hexColor;
            ctx.fillRect(x, barY, width, barHeight);
        });
        
        ctx.strokeStyle = '#475569';
        ctx.strokeRect(0, barY, canvas.width, barHeight);
        
        ctx.fillStyle = '#cbd5e1';
        ctx.font = '12px sans-serif';
        ctx.textAlign = 'center';
        ctx.fillText('Layer 0', 20, barY + barHeight + 20);
        ctx.fillText(`Layer ${stats.totalLayers}`, canvas.width - 30, barY + barHeight + 20);
    }

    displayDebugInfo() {
        const logs = this.analysisResult.logs || [];
        const logHtml = logs.map(log => {
            const time = new Date(log.timestamp).toLocaleTimeString();
            return `<div class="log-entry log-${log.level}">[${time}] [${log.level.toUpperCase()}] ${log.message}</div>`;
        }).join('');
        
        document.getElementById('parserLogs').innerHTML = logHtml || '<p>No logs available</p>';
        
        const perfStats = `
            <div class="stat-item">
                <span class="stat-label">Parse Time</span>
                <span class="stat-value">${this.analysisResult.stats.parseTime}ms</span>
            </div>
            <div class="stat-item">
                <span class="stat-label">Lines Processed</span>
                <span class="stat-value">${this.analysisResult.stats.toolChanges.reduce((max, tc) => Math.max(max, tc.lineNumber), 0)}</span>
            </div>
            <div class="stat-item">
                <span class="stat-label">Warnings</span>
                <span class="stat-value">${this.analysisResult.stats.parserWarnings.length}</span>
            </div>
        `;
        
        document.getElementById('performanceStats').innerHTML = perfStats;
        document.getElementById('rawData').textContent = JSON.stringify(this.analysisResult, null, 2);
    }

    toggleDebug() {
        this.debugSection.style.display = this.debugSection.style.display === 'none' ? 'block' : 'none';
    }

    switchTab(tabName) {
        document.querySelectorAll('.tab-btn').forEach(btn => {
            btn.classList.toggle('active', btn.dataset.tab === tabName);
        });
        
        document.querySelectorAll('.tab-content').forEach(content => {
            content.classList.toggle('active', content.id === tabName + 'Tab');
        });
    }

    exportResults() {
        if (!this.analysisResult) return;
        
        const exportData = {
            fileName: this.analysisResult.stats.fileName,
            analysis: {
                colors: this.analysisResult.stats.colors,
                optimization: this.analysisResult.optimization
            },
            instructions: this.generateInstructions()
        };
        
        const blob = new Blob([JSON.stringify(exportData, null, 2)], { type: 'application/json' });
        const url = URL.createObjectURL(blob);
        
        const a = document.createElement('a');
        a.href = url;
        a.download = `gcode-analysis-${Date.now()}.json`;
        a.click();
        
        URL.revokeObjectURL(url);
    }

    generateInstructions() {
        const opt = this.analysisResult.optimization;
        const stats = this.analysisResult.stats;
        if (!opt) return 'No optimization available';
        
        let instructions = `===========================================\n`;
        instructions += `🎨 G-CODE COLOR OPTIMIZATION REPORT\n`;
        instructions += `===========================================\n\n`;
        
        instructions += `📄 FILE: ${stats.fileName}\n`;
        instructions += `📊 PRINT STATISTICS:\n`;
        instructions += `   • Total Layers: ${stats.totalLayers}\n`;
        instructions += `   • Total Colors: ${opt.totalColors}\n`;
        instructions += `   • Tool Changes: ${stats.toolChanges.length}\n`;
        instructions += `   • Manual Swaps Needed: ${opt.manualSwaps.length}\n`;
        instructions += `   • Estimated Time Saved: ${Math.round(opt.estimatedTimeSaved / 60)} minutes\n\n`;
        
        instructions += `🎯 AMS SLOT ASSIGNMENTS:\n`;
        instructions += `━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n`;
        opt.slotAssignments.forEach(slot => {
            const slotColors = slot.colors.map(colorId => {
                const color = stats.colors.find(c => c.id === colorId);
                return color ? `${color.name || colorId} (${color.hexColor})` : colorId;
            });
            instructions += `   SLOT ${slot.slot}: ${slotColors.join(' → ')}\n`;
            instructions += `           Type: ${slot.isPermanent ? 'PERMANENT' : 'SHARED'}\n\n`;
        });
        
        if (opt.manualSwaps.length > 0) {
            instructions += `\n🔄 MANUAL SWAP INSTRUCTIONS:\n`;
            instructions += `━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n`;
            instructions += `⚠️  IMPORTANT: Pause your print at the specified layers\n`;
            instructions += `   and perform the following filament swaps:\n\n`;
            
            opt.manualSwaps.forEach((swap, index) => {
                const fromColor = stats.colors.find(c => c.id === swap.fromColor);
                const toColor = stats.colors.find(c => c.id === swap.toColor);
                
                instructions += `   SWAP #${index + 1}:\n`;
                instructions += `   ├─ Layer: ${swap.atLayer} (Height: Z${swap.zHeight ? swap.zHeight.toFixed(2) : '0.00'}mm)\n`;
                instructions += `   ├─ Remove: ${fromColor?.name || swap.fromColor} (${fromColor?.hexColor || 'N/A'})\n`;
                instructions += `   ├─ Insert: ${toColor?.name || swap.toColor} (${toColor?.hexColor || 'N/A'})\n`;
                instructions += `   ├─ Slot: AMS Slot ${swap.slot}\n`;
                instructions += `   └─ Reason: ${swap.reason}\n\n`;
            });
            
            instructions += `\n💡 TIPS FOR MANUAL SWAPS:\n`;
            instructions += `   • Set up pause commands in your slicer at the specified layers\n`;
            instructions += `   • Have all required filaments ready before starting the print\n`;
            instructions += `   • Label your filaments clearly to avoid confusion\n`;
            instructions += `   • Consider using the same brand/type of filament for best results\n`;
        } else {
            instructions += `\n✅ NO MANUAL SWAPS REQUIRED!\n`;
            instructions += `   Your print is perfectly optimized for the available AMS slots.\n`;
        }
        
        instructions += `\n===========================================\n`;
        instructions += `Generated on: ${new Date().toLocaleString()}\n`;
        instructions += `G-code Color Mapper v1.0\n`;
        
        return instructions;
    }

    resetAnalyzer() {
        this.currentFile = null;
        this.analysisResult = null;
        this.fileInput.value = '';
        this.uploadSection.style.display = 'block';
        this.resultsSection.style.display = 'none';
        this.debugSection.style.display = 'none';
        this.uploadProgress.style.display = 'none';
    }

    formatFileSize(bytes) {
        const sizes = ['Bytes', 'KB', 'MB', 'GB'];
        if (bytes === 0) return '0 Bytes';
        const i = Math.floor(Math.log(bytes) / Math.log(1024));
        return Math.round(bytes / Math.pow(1024, i) * 100) / 100 + ' ' + sizes[i];
    }
}

document.addEventListener('DOMContentLoaded', () => {
    new GcodeAnalyzer();
});