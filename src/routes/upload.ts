import { Request, Response } from 'express';
import path from 'path';
import fs from 'fs/promises';

export const uploadRoute = async (req: Request, res: Response) => {
  try {
    if (!req.file) {
      return res.status(400).json({ error: 'No file uploaded' });
    }

    const fileStats = await fs.stat(req.file.path);
    
    const response = {
      success: true,
      file: {
        id: path.basename(req.file.filename, path.extname(req.file.filename)),
        originalName: req.file.originalname,
        filename: req.file.filename,
        size: fileStats.size,
        sizeFormatted: formatFileSize(fileStats.size),
        uploadTime: new Date().toISOString()
      }
    };

    res.json(response);
  } catch (error) {
    console.error('Upload error:', error);
    return res.status(500).json({ 
      error: 'Failed to process upload',
      details: error instanceof Error ? error.message : 'Unknown error'
    });
  }
};

function formatFileSize(bytes: number): string {
  const sizes = ['Bytes', 'KB', 'MB', 'GB'];
  if (bytes === 0) return '0 Bytes';
  const i = Math.floor(Math.log(bytes) / Math.log(1024));
  return Math.round(bytes / Math.pow(1024, i) * 100) / 100 + ' ' + sizes[i];
}