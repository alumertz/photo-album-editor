const express = require('express');
const path = require('path');
const fs = require('fs');
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
    fs.readdir(photosDir, (err, files) => {
        if (err) {
            return res.status(500).json({ error: err.message });
        }
        const images = files.filter(file =>
            /\.(jpg|jpeg|png|gif|bmp|webp)$/i.test(file)
        );
        res.json(images);
    });
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
    const safeName = path.basename(req.params.filename);
    const photoPath = path.join(__dirname, '../photos', safeName);

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