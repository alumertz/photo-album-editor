const express = require('express');
const path = require('path');
const fs = require('fs');
const { spawnSync } = require('child_process');
const exifParser = require('exif-parser');

const app = express();

// Enable CORS
app.use((req, res, next) => {
    res.header('Access-Control-Allow-Origin', '*');
    res.header('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
    res.header('Access-Control-Allow-Headers', 'Content-Type, Authorization');
    next();
});

app.use('/photos', express.static(path.join(__dirname, '../photos')));

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

app.post('/api/load-bereal', (req, res) => {
    // Open native macOS folder picker
    const pickerResult = spawnSync('osascript', [
        '-e', 'POSIX path of (choose folder with prompt "Select your BeReal export folder")'
    ]);

    if (pickerResult.status !== 0) {
        // User cancelled the dialog
        return res.json({ success: false, cancelled: true });
    }

    const folderPath = pickerResult.stdout.toString().trim();
    if (!folderPath) {
        return res.json({ success: false, cancelled: true });
    }

    // Run the Python processing script
    const scriptPath = path.join(__dirname, '../../bereal/process.py');
    const pyResult = spawnSync('python3', [scriptPath, folderPath], { encoding: 'utf8' });

    if (pyResult.status !== 0) {
        return res.status(500).json({ success: false, error: pyResult.stderr || 'Python script failed' });
    }

    // Create symlink api/photos/bereal -> <folder>/processed
    const symlinkPath = path.join(__dirname, '../photos/bereal');
    const processedDir = path.join(folderPath, 'processed');

    try {
        fs.lstatSync(symlinkPath);
        fs.unlinkSync(symlinkPath);
    } catch (e) { /* symlink doesn't exist yet */ }

    try {
        fs.symlinkSync(processedDir, symlinkPath);
    } catch (e) {
        return res.status(500).json({ success: false, error: `Failed to create symlink: ${e.message}` });
    }

    res.json({ success: true, folder: folderPath });
});

app.post('/api/save/album', express.json(), (req, res) => {
    const dataPath = path.join(__dirname, '../data.json');
    const photos = req.body;

    if (!Array.isArray(photos)) {
        return res.status(400).json({ error: 'Invalid photos data' });
    }

    // Read existing album data or create a new object
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
