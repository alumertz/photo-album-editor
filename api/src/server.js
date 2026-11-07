const express = require('express');
const path = require('path');
const fs = require('fs');
const { spawn, spawnSync } = require('child_process');
const exifParser = require('exif-parser');
const multer = require('multer');

const app = express();

// In-memory store for active import jobs
const jobs = new Map();

// Enable CORS
app.use((req, res, next) => {
    res.header('Access-Control-Allow-Origin', '*');
    res.header('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
    res.header('Access-Control-Allow-Headers', 'Content-Type, Authorization');
    next();
});

app.use('/photos', express.static(path.join(__dirname, '../photos')));

const upload = multer({ dest: path.join(__dirname, '../photos') });

app.post('/api/upload', upload.array('photos'), (req, res) => {
    const photosDir = path.join(__dirname, '../photos');
    const saved = [];
    for (const file of req.files) {
        const ext = path.extname(file.originalname).toLowerCase();
        let base = path.basename(file.originalname, ext);
        let name = file.originalname;
        let dest = path.join(photosDir, name);
        let counter = 1;
        while (fs.existsSync(dest)) {
            name = `${base}-${counter}${ext}`;
            dest = path.join(photosDir, name);
            counter++;
        }
        fs.renameSync(file.path, dest);
        saved.push(name);
    }
    res.json({ success: true, files: saved });
});

app.get('/api/gallery', (req, res) => {
    const photosDir = path.join(__dirname, '../photos');
    try {
        const images = [];
        const entries = fs.readdirSync(photosDir, { withFileTypes: true });

        for (const entry of entries) {
            if (/\.(jpg|jpeg|png|gif|bmp|webp)$/i.test(entry.name)) {
                images.push(entry.name);
            } else {
                // Follow symlinks and recurse one level into subdirectories
                try {
                    const stat = fs.statSync(path.join(photosDir, entry.name));
                    if (stat.isDirectory()) {
                        const subFiles = fs.readdirSync(path.join(photosDir, entry.name));
                        for (const sub of subFiles) {
                            if (/\.(jpg|jpeg|png|gif|bmp|webp)$/i.test(sub)) {
                                images.push(`${entry.name}/${sub}`);
                            }
                        }
                    }
                } catch (e) { /* skip unreadable entries */ }
            }
        }

        images.sort();
        res.json(images);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

app.get('/api/album', (req, res) => {
    const dataPath = path.join(__dirname, '../data.json');
    fs.readFile(dataPath, 'utf8', (err, data) => {
        if (err) {
            if (err.code === 'ENOENT') {
                return res.json({});
            }
            return res.status(500).json({ error: err.message });
        }
        res.json(JSON.parse(data));
    });
});

app.get('/api/photo-exif-date/:filename', (req, res) => {
    // Decode and sanitize — allows one level of subdirectory (e.g. "bereal/photo.jpg")
    const rawName = req.params.filename;
    const parts = rawName.split('/').filter(p => p && p !== '..' && p !== '.');
    const safePath = parts.map(p => path.basename(p)).join('/');
    const photoPath = path.join(__dirname, '../photos', safePath);

    fs.readFile(photoPath, (err, buffer) => {
        if (err) return res.json({ date: '00/00/0000' });
        try {
            const result = exifParser.create(buffer).parse();
            const ts = result.tags.DateTimeOriginal || result.tags.DateTime;
            if (ts) {
                const d = new Date(ts * 1000);
                const dd = String(d.getDate()).padStart(2, '0');
                const mm = String(d.getMonth() + 1).padStart(2, '0');
                const yyyy = d.getFullYear();
                return res.json({ date: `${dd}/${mm}/${yyyy}` });
            }
            res.json({ date: '00/00/0000' });
        } catch (e) {
            res.json({ date: '00/00/0000' });
        }
    });
});

// Opens the native folder picker and starts the Python import job.
// Returns { jobId } immediately so the frontend can subscribe to SSE.
app.post('/api/load-bereal', (req, res) => {
    const pickerResult = spawnSync('osascript', [
        '-e', 'POSIX path of (choose folder with prompt "Select your BeReal export folder")'
    ]);

    if (pickerResult.status !== 0) {
        return res.json({ success: false, cancelled: true });
    }

    const folderPath = pickerResult.stdout.toString().trim();
    if (!folderPath) {
        return res.json({ success: false, cancelled: true });
    }

    const jobId = Date.now().toString(36) + Math.random().toString(36).slice(2, 6);
    const scriptPath = path.join(__dirname, '../../bereal/process.py');
    const pyProcess = spawn('python3', [scriptPath, folderPath]);

    const job = {
        process: pyProcess,
        status: 'running',
        progress: 0,
        total: 0,
        skipped: [],
        folder: folderPath,
        clients: []
    };
    jobs.set(jobId, job);

    let buffer = '';
    pyProcess.stdout.on('data', (chunk) => {
        buffer += chunk.toString();
        const lines = buffer.split('\n');
        buffer = lines.pop();
        for (const line of lines) {
            handlePythonLine(job, line.trim());
        }
    });

    pyProcess.stdout.on('end', () => {
        if (buffer.trim()) handlePythonLine(job, buffer.trim());
    });

    pyProcess.on('close', (code) => {
        if (job.status === 'running') {
            job.status = 'error';
            broadcast(job, { type: 'error', message: `Process exited with code ${code}` });
        }
        scheduleJobCleanup(jobId);
    });

    res.json({ success: true, jobId });
});

// SSE endpoint — streams progress events to the frontend.
app.get('/api/load-bereal/progress/:jobId', (req, res) => {
    const job = jobs.get(req.params.jobId);
    if (!job) {
        res.setHeader('Content-Type', 'text/event-stream');
        res.write(`data: ${JSON.stringify({ type: 'error', message: 'Job not found' })}\n\n`);
        return res.end();
    }

    res.setHeader('Content-Type', 'text/event-stream');
    res.setHeader('Cache-Control', 'no-cache');
    res.setHeader('Connection', 'keep-alive');

    // Send current state immediately so late subscribers catch up
    res.write(`data: ${JSON.stringify({ type: 'state', status: job.status, progress: job.progress, total: job.total, skipped: job.skipped })}\n\n`);

    job.clients.push(res);
    req.on('close', () => {
        job.clients = job.clients.filter(c => c !== res);
    });
});

// Kills the running Python process for a job.
app.post('/api/load-bereal/cancel/:jobId', (req, res) => {
    const job = jobs.get(req.params.jobId);
    if (!job) return res.json({ success: false, error: 'Job not found' });

    job.process.kill();
    job.status = 'cancelled';
    broadcast(job, { type: 'cancelled' });
    scheduleJobCleanup(req.params.jobId);
    res.json({ success: true });
});

function handlePythonLine(job, line) {
    if (!line) return;
    try {
        const event = JSON.parse(line);
        if (event.type === 'total') {
            job.total = event.count;
            broadcast(job, event);
        } else if (event.type === 'progress') {
            job.progress = event.current;
            broadcast(job, event);
        } else if (event.type === 'done') {
            job.status = 'done';
            job.skipped = event.skipped || [];
            createSymlinks(job.folder);
            broadcast(job, event);
        } else if (event.type === 'error') {
            job.status = 'error';
            broadcast(job, event);
        }
    } catch (e) {
        // Non-JSON line (e.g. pip warnings) — ignore
    }
}

function broadcast(job, event) {
    const data = `data: ${JSON.stringify(event)}\n\n`;
    job.clients.forEach(client => client.write(data));
}

function createSymlinks(folderPath) {
    for (const subdir of ['bereal', 'post']) {
        const target = path.join(folderPath, 'Photos', subdir);
        if (!fs.existsSync(target)) continue;

        const symlinkPath = path.join(__dirname, '../photos', subdir);
        try { fs.lstatSync(symlinkPath); fs.unlinkSync(symlinkPath); } catch (e) { /* doesn't exist */ }
        try { fs.symlinkSync(target, symlinkPath); } catch (e) {
            console.error(`Failed to create symlink for ${subdir}:`, e.message);
        }
    }
}

function scheduleJobCleanup(jobId) {
    // Keep job alive briefly so late SSE clients can still connect and receive final state
    setTimeout(() => jobs.delete(jobId), 30000);
}

app.post('/api/save/album', express.json(), (req, res) => {
    const dataPath = path.join(__dirname, '../data.json');
    const photos = req.body;

    if (!Array.isArray(photos)) {
        return res.status(400).json({ error: 'Invalid photos data' });
    }

    fs.readFile(dataPath, 'utf8', (err, data) => {
        let albumData = {};
        if (!err) {
            try {
                albumData = JSON.parse(data);
            } catch (e) {
                return res.status(500).json({ error: 'Failed to parse album data' });
            }
        }
        if (!albumData.album) albumData.album = {};
        albumData.album.photos = photos;

        fs.writeFile(dataPath, JSON.stringify(albumData, null, 2), 'utf8', err => {
            if (err) {
                return res.status(500).json({ error: err.message });
            }
            res.json({ success: true });
        });
    });
});

const PORT = 5001;
app.listen(PORT, () => {
    console.log(`Backend rodando na porta ${PORT}`);
});
