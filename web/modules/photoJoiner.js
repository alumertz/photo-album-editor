/**
 * Photo Joiner - batches all album photos into joined print-size images and zips them
 */

import { loadJSZip } from './ui.js';

const DPI = 300;
const CM_PER_INCH = 2.54;

const SIZES = {
    '10x15': { w: 10, h: 15 },
    '9x13':  { w: 9,  h: 13 },
    '13x18': { w: 13, h: 18 },
    '15x20': { w: 15, h: 20 },
    '20x25': { w: 20, h: 25 },
    '20x30': { w: 20, h: 30 },
};

// Holds generated blobs between preview and download
let pendingBlobs = [];
let pendingSizeKey = '';
let pendingCount = 0;

function cmToPx(cm) {
    return Math.round((cm / CM_PER_INCH) * DPI);
}

function loadImage(src) {
    return new Promise((resolve, reject) => {
        const img = new Image();
        img.crossOrigin = 'anonymous';
        img.onload = () => resolve(img);
        img.onerror = () => reject(new Error(`Failed to load ${src}`));
        img.src = src;
    });
}

function getSlots(count, canvasW, canvasH) {
    const hw = canvasW / 2;
    const hh = canvasH / 2;
    if (count === 2) {
        return [
            { x: 0, y: 0,  w: canvasW, h: hh },
            { x: 0, y: hh, w: canvasW, h: hh },
        ];
    }
    return [
        { x: 0,  y: 0,  w: hw, h: hh },
        { x: hw, y: 0,  w: hw, h: hh },
        { x: 0,  y: hh, w: hw, h: hh },
        { x: hw, y: hh, w: hw, h: hh },
    ];
}

function drawCenteredCrop(ctx, img, slot) {
    const { x, y, w, h } = slot;
    const srcAspect = img.naturalWidth / img.naturalHeight;
    const dstAspect = w / h;
    const wasCropped = Math.abs(srcAspect - dstAspect) > 0.01;

    const scale = Math.max(w / img.naturalWidth, h / img.naturalHeight);
    const sw = w / scale;
    const sh = h / scale;
    const sx = (img.naturalWidth  - sw) / 2;
    const sy = (img.naturalHeight - sh) / 2;

    ctx.drawImage(img, sx, sy, sw, sh, x, y, w, h);
    return wasCropped;
}

async function buildJoinedCanvas(filenames, slots, canvasW, canvasH) {
    const canvas = document.createElement('canvas');
    canvas.width  = canvasW;
    canvas.height = canvasH;
    const ctx = canvas.getContext('2d');
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(0, 0, canvasW, canvasH);

    const cropped = [];
    for (let i = 0; i < filenames.length; i++) {
        if (!filenames[i]) continue;
        const img = await loadImage(`/photos/${filenames[i]}`);
        if (drawCenteredCrop(ctx, img, slots[i])) cropped.push(filenames[i]);
    }

    return { canvas, cropped };
}

function canvasToBlob(canvas) {
    return new Promise(resolve => canvas.toBlob(resolve, 'image/jpeg', 0.92));
}

function setStatus(msg) {
    $('#join-status').text(msg);
}

function getAlbumCount() {
    return $('.page-wrapper .page-image[data-filename]').length;
}

function updateProcessBtn() {
    const hasPhotos = getAlbumCount() > 0;
    $('#join-process-btn').prop('disabled', !hasPhotos);
    if (hasPhotos) {
        const count = parseInt($('.join-count-btn.active').data('count'));
        const total = getAlbumCount();
        const batches = Math.ceil(total / count);
        setStatus(`${total} photo${total > 1 ? 's' : ''} → ${batches} joined image${batches > 1 ? 's' : ''}`);
    } else {
        setStatus('Add photos to the album first.');
    }
}

function clearResult() {
    pendingBlobs = [];
    $('#join-crop-result').hide();
    $('#join-crop-list').empty();
    $('#join-preview-area').hide();
    $('#join-preview-grid').empty();
    $('#join-download-btn').prop('disabled', true);
    updateProcessBtn();
}

async function generatePreview() {
    const count   = parseInt($('.join-count-btn.active').data('count'));
    const sizeKey = $('#join-size-select').val();
    const size    = SIZES[sizeKey];
    const canvasW = cmToPx(size.w);
    const canvasH = cmToPx(size.h);
    const slots   = getSlots(count, canvasW, canvasH);

    const allFilenames = [];
    $('.page-wrapper').each(function () {
        const fn = $(this).find('.page-image').attr('data-filename');
        if (fn) allFilenames.push(fn);
    });

    if (allFilenames.length === 0) { setStatus('No photos in album.'); return; }

    const batches = [];
    for (let i = 0; i < allFilenames.length; i += count) {
        batches.push(allFilenames.slice(i, i + count));
    }

    $('#join-process-btn').prop('disabled', true);
    $('#join-download-btn').prop('disabled', true);
    $('#join-preview-area').hide();
    $('#join-preview-grid').empty();
    $('#join-crop-result').hide();

    const allCropped = [];
    pendingBlobs = [];
    pendingSizeKey = sizeKey;
    pendingCount = count;

    try {
        for (let i = 0; i < batches.length; i++) {
            setStatus(`Generating ${i + 1} of ${batches.length}…`);
            const { canvas, cropped } = await buildJoinedCanvas(batches[i], slots, canvasW, canvasH);
            allCropped.push(...cropped);

            const blob = await canvasToBlob(canvas);
            pendingBlobs.push(blob);

            // Add thumbnail
            const previewUrl = URL.createObjectURL(blob);
            const $thumb = $('<div>', { class: 'join-preview-thumb' });
            const $img = $('<img>', { src: previewUrl, alt: `Image ${i + 1}` });
            const $label = $('<span>', { text: `${i + 1}` });
            $thumb.append($img, $label);
            $('#join-preview-grid').append($thumb);
        }

        $('#join-preview-area').show();
        $('#join-download-btn').prop('disabled', false);
        setStatus(`${batches.length} image${batches.length > 1 ? 's' : ''} ready — review and download.`);

        if (allCropped.length > 0) {
            $('#join-crop-list').html(allCropped.map(n => `<div class="join-crop-item">${n}</div>`).join(''));
            $('#join-crop-result').show();
        }

    } catch (err) {
        console.error(err);
        setStatus('Error: ' + err.message);
    } finally {
        $('#join-process-btn').prop('disabled', false);
    }
}

async function downloadZip() {
    if (pendingBlobs.length === 0) return;

    $('#join-download-btn').prop('disabled', true);
    setStatus('Generating ZIP…');

    try {
        const JSZip = await loadJSZip();
        const zip = new JSZip();
        pendingBlobs.forEach((blob, i) => {
            zip.file(`joined_${String(i + 1).padStart(3, '0')}.jpg`, blob);
        });

        const zipBlob = await zip.generateAsync({ type: 'blob' });
        const url = URL.createObjectURL(zipBlob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `joined_${pendingCount}photos_${pendingSizeKey}_${Date.now()}.zip`;
        a.click();
        URL.revokeObjectURL(url);

        setStatus(`Done — ${pendingBlobs.length} image${pendingBlobs.length > 1 ? 's' : ''} downloaded.`);
    } catch (err) {
        console.error(err);
        setStatus('Error: ' + err.message);
    } finally {
        $('#join-download-btn').prop('disabled', false);
    }
}

function openModal() {
    updateProcessBtn();
    $('#join-preview-area').hide();
    $('#join-crop-result').hide();
    $('#join-download-btn').prop('disabled', true);
    $('#join-photos-modal').css('display', 'flex');
}

function closeModal() {
    $('#join-photos-modal').hide();
}

function initJoinModal() {
    $('.btn-join-photos').on('click', openModal);
    $('#join-modal-close, #join-cancel-btn').on('click', closeModal);
    $('#join-photos-modal').on('click', function (e) {
        if ($(e.target).is('#join-photos-modal')) closeModal();
    });

    $(document).on('click', '.join-count-btn', function () {
        $('.join-count-btn').removeClass('active btn-secondary').addClass('btn-outline-secondary');
        $(this).removeClass('btn-outline-secondary').addClass('active btn-secondary');
        clearResult();
    });

    $('#join-size-select').on('change', clearResult);
    $('#join-process-btn').on('click', generatePreview);
    $('#join-download-btn').on('click', downloadZip);
}

export { initJoinModal };
