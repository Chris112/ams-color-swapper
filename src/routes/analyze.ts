import { Request, Response } from 'express';
import path from 'path';
import fs from 'fs/promises';
import { GcodeParser } from '../parser/gcodeParser';
import { ColorOptimizer } from '../optimizer/colorOptimizer';
import { Logger } from '../debug/logger';

export const analyzeRoute = async (req: Request, res: Response) => {
  const logger = new Logger();
  
  try {
    const { fileId } = req.params;
    const { optimize = true } = req.body;
    
    logger.info(`Starting analysis for file ${fileId}`);
    
    const files = await fs.readdir('uploads');
    const filename = files.find(f => f.includes(fileId));
    
    if (!filename) {
      return res.status(404).json({ error: 'File not found' });
    }
    
    const filePath = path.join('uploads', filename);
    
    const parser = new GcodeParser(logger);
    const stats = await parser.parse(filePath, filename);
    
    logger.info(`Parse complete. Found ${stats.colors.length} colors, ${stats.toolChanges.length} tool changes`);
    
    let optimizationResult = null;
    
    if (optimize && stats.colors.length > 0) {
      const optimizer = new ColorOptimizer(logger);
      optimizationResult = optimizer.optimize(stats);
      logger.info(`Optimization complete. Required slots: ${optimizationResult.requiredSlots}`);
    }
    
    const response = {
      success: true,
      stats: {
        ...stats,
        layerColorMap: Array.from(stats.layerColorMap.entries())
      },
      optimization: optimizationResult,
      logs: logger.getLogs()
    };
    
    res.json(response);
    
  } catch (error) {
    logger.error('Analysis error:', error);
    return res.status(500).json({
      error: 'Failed to analyze G-code',
      details: error instanceof Error ? error.message : 'Unknown error',
      logs: logger.getLogs()
    });
  }
};