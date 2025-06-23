import express from 'express';
import cors from 'cors';
import path from 'path';
import multer from 'multer';
import { analyzeRoute } from './routes/analyze';
import { uploadRoute } from './routes/upload';

const app = express();
const PORT = process.env.PORT || 3000;

const storage = multer.diskStorage({
  destination: (_req, _file, cb) => {
    cb(null, 'uploads/');
  },
  filename: (_req, file, cb) => {
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
    cb(null, file.fieldname + '-' + uniqueSuffix + path.extname(file.originalname));
  }
});

const upload = multer({ 
  storage,
  limits: {
    fileSize: 200 * 1024 * 1024 // 200MB limit
  },
  fileFilter: (_req, file, cb) => {
    const ext = path.extname(file.originalname).toLowerCase();
    if (ext === '.gcode' || ext === '.gco' || ext === '.g') {
      cb(null, true);
    } else {
      cb(new Error('Only G-code files are allowed'));
    }
  }
});

app.use(cors());
app.use(express.json());
app.use(express.static('public'));

app.post('/api/upload', upload.single('gcode'), uploadRoute as any);
app.post('/api/analyze/:fileId', analyzeRoute as any);

app.get('/api/health', (_req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

app.use((err: any, _req: express.Request, res: express.Response, _next: express.NextFunction) => {
  console.error(err.stack);
  res.status(500).json({
    error: err.message || 'Something went wrong!',
    type: err.name
  });
});

app.listen(PORT, () => {
  console.log(`🚀 Server is running on http://localhost:${PORT}`);
  console.log(`📁 Serving static files from /public`);
  console.log(`📤 Upload endpoint: POST /api/upload`);
  console.log(`🔍 Analyze endpoint: POST /api/analyze/:fileId`);
});