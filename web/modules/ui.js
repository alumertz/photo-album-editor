/**
 * UI Module - Manages user interface functionality
 */

import { clearImageCache } from './cache.js';
import { refreshOrder } from './page.js';

/**
 * Toggles visibility of cut marks
 */
function toggleCutMarks() {
    const $album = $('.album');
    const currentState = $album.attr('data-cut-preview');
    const newState = currentState === 'true' ? 'false' : 'true';
    
    $album.attr('data-cut-preview', newState);
    
    // Updates button text
    const $button = $('.btn-toggle-marks');
    if (newState === 'true') {
        $button.text('Hide Cut Marks');
    } else {
        $button.text('Show Cut Marks');
    }
}

/**
 * Initializes page sorting functionality
 */
function initializeSortable() {
    $('.album').sortable({
        items: '.page-wrapper',
        axis: 'y',
        tolerance: 'intersect',
        placeholder: 'sortable-placeholder',
        scroll: true,
        scrollSensitivity: 200,
        scrollSpeed: 20,
        helper: 'clone',
        opacity: 0.8,
        
        start: function(event, ui) {
            ui.helper.addClass('sortable-being-dragged');
            ui.placeholder.height(0);
        },
        
        stop: function(event, ui) {
            ui.item.removeClass('sortable-being-dragged');
        },

        update: function() {
            refreshOrder();
        }
    });
}

/**
 * Handles print event
 */
function handlePrint() {
    window.print();
}

/**
 * Handles photo print event - Creates multiple JPGs with 4 photos each and downloads as ZIP
 */
function handlePhotoPrint() {
    const $pages = $('.page');
    const photos = [];
    
    // Collect ALL photos
    $pages.each(function() {
        const $img = $(this).find('.page-image');
        if ($img.length > 0) {
            const src = $img.attr('src') || $img.css('background-image').replace(/url\(['"]?(.*?)['"]?\)/, '$1');
            if (src && src !== 'none') {
                photos.push(src);
            }
        }
    });
    
    if (photos.length === 0) {
        alert('No photos found to combine.');
        return;
    }
    
    createPhotoCollagesZip(photos);
}

/**
 * Draws photos on canvas in 2x2 grid
 */
function drawPhotosOnCanvas(ctx, images, photoWidth, photoHeight) {
    // Clear canvas with white background
    ctx.fillStyle = 'white';
    ctx.fillRect(0, 0, ctx.canvas.width, ctx.canvas.height);
    
    // Draw images in 2x2 grid
    images.forEach((img, index) => {
        if (img) {
            const col = index % 2;
            const row = Math.floor(index / 2);
            const x = col * photoWidth;
            const y = row * photoHeight;
            
            // Draw image to fit the designated area
            ctx.drawImage(img, x, y, photoWidth, photoHeight);
        }
    });
}

/**
 * Downloads canvas as JPG file
 */
function downloadCanvasAsJPG(canvas) {
    canvas.toBlob(function(blob) {
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `photo-collage-${new Date().getTime()}.jpg`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
    }, 'image/jpeg', 0.9); // 90% quality
}

/**
 * Creates multiple photo collages (4 photos each) and downloads them as a ZIP file
 */
async function createPhotoCollagesZip(allPhotos) {
    // Group photos into batches of 4
    const photoGroups = [];
    for (let i = 0; i < allPhotos.length; i += 4) {
        photoGroups.push(allPhotos.slice(i, i + 4));
    }
    
    if (photoGroups.length === 0) {
        alert('No photos to process.');
        return;
    }
    
    // Load JSZip dynamically
    const JSZip = await loadJSZip();
    const zip = new JSZip();
    
    let processedGroups = 0;
    const totalGroups = photoGroups.length;
    
    // Process each group of 4 photos
    for (let groupIndex = 0; groupIndex < photoGroups.length; groupIndex++) {
        const photoGroup = photoGroups[groupIndex];
        
        // Create canvas for this group
        const canvas = document.createElement('canvas');
        const ctx = canvas.getContext('2d');
        
        const photoWidth = 400;
        const photoHeight = 300;
        canvas.width = photoWidth * 2;
        canvas.height = photoHeight * 2;
        
        // Load all images in this group
        const images = await loadImagesGroup(photoGroup);
        
        // Draw photos on canvas
        drawPhotosOnCanvas(ctx, images, photoWidth, photoHeight);
        
        // Convert canvas to blob and add to ZIP
        const blob = await canvasToBlob(canvas);
        const filename = `photo-collage-${groupIndex + 1}.jpg`;
        zip.file(filename, blob);
        
        processedGroups++;
        console.log(`Processed group ${processedGroups}/${totalGroups}`);
    }
    
    // Generate and download ZIP file
    const zipBlob = await zip.generateAsync({type: 'blob'});
    const url = URL.createObjectURL(zipBlob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `photo-collages-${new Date().getTime()}.zip`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
    
    alert(`Successfully created ${photoGroups.length} photo collages in ZIP file!`);
}

/**
 * Loads JSZip library dynamically
 */
async function loadJSZip() {
    if (window.JSZip) {
        return window.JSZip;
    }
    
    return new Promise((resolve, reject) => {
        const script = document.createElement('script');
        script.src = 'https://cdnjs.cloudflare.com/ajax/libs/jszip/3.10.1/jszip.min.js';
        script.onload = () => resolve(window.JSZip);
        script.onerror = reject;
        document.head.appendChild(script);
    });
}

/**
 * Loads a group of images and returns them as an array
 */
async function loadImagesGroup(photoPaths) {
    const loadPromises = photoPaths.map((path, index) => {
        return new Promise((resolve) => {
            const img = new Image();
            img.crossOrigin = 'anonymous';
            img.onload = () => resolve({index, img});
            img.onerror = () => {
                console.error('Failed to load image:', path);
                resolve({index, img: null});
            };
            img.src = path;
        });
    });
    
    const results = await Promise.all(loadPromises);
    const images = [];
    results.forEach(result => {
        images[result.index] = result.img;
    });
    
    return images;
}

/**
 * Converts canvas to blob using Promise
 */
function canvasToBlob(canvas) {
    return new Promise((resolve) => {
        canvas.toBlob(resolve, 'image/jpeg', 0.9);
    });
}

export {
    toggleCutMarks,
    initializeSortable,
    handlePrint,
    handlePhotoPrint,
    clearImageCache
};
