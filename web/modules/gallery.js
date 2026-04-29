/**
 * Gallery Module - Manages available image gallery
 */

import { createPage, refreshOrder } from './page.js';

/**
 * Loads and displays available image gallery
 */
function loadGallery() {
    $.getJSON('/api/gallery', function (data) {
        const $gallery = $('.gallery');
        $gallery.empty();

        // Add "Add all" button if there are images
        if (data.length > 0) {
            const $addAllBtn = $('<button>', {
                class: 'btn-add-all btn btn-outline-light w-100 mb-3',
                html: `Add all (${data.length})`,
                click: async function() {
                    await addAllImagesToAlbum(data);
                }
            });
            $gallery.append($addAllBtn);
        }

        data.forEach(function (image) {
            const imgUrl = `/photos/${image}`;
            const $container = $('<div>', { class: 'gallery-item', 'data-filename': image });
            const $img = $('<img>', { src: imgUrl, alt: image, class: 'gallery-image' });
            const $checkmark = $('<div>', { class: 'checkmark', html: '✓' });
            
            $img.on('click', async function () {
                const $existing = $('.page-image[data-filename="' + image + '"]').closest('.page-wrapper');
                if ($existing.length > 0) {
                    $existing.remove();
                    refreshOrder();
                } else {
                    await addImageToAlbum(image);
                }
                updateGalleryCheckmarks();
            });
            
            $container.append($img, $checkmark);
            $gallery.append($container);
        });
        
        // Update checkmarks after loading gallery
        updateGalleryCheckmarks();
    }).fail(function() {
        console.error('Error loading gallery');
    });
}

/**
 * Adds an image from gallery to album
 * @param {string} imageName - Image filename
 */
async function addImageToAlbum(imageName) {
    try {
        const $page = await createPage({
            filename: imageName,
            order: $('.page').length + 1,
            caption: '',
            id: generateId(),
            rotation: 0
        });

        if ($page) {
            const $active = $('.page-wrapper.page-active');
            if ($active.length > 0) {
                $active.after($page);
            } else {
                $('.album').append($page);
            }
            refreshOrder();
        }
    } catch (error) {
        console.error('Error adding image to album:', error);
    }
}

/**
 * Adds all images from gallery to album
 * @param {Array} imageList - Array of image filenames
 */
async function addAllImagesToAlbum(imageList) {
    const $addAllBtn = $('.gallery .btn-add-all');
    const originalText = $addAllBtn.text();
    
    try {
        $addAllBtn.prop('disabled', true).text('Adding...');
        
        let currentOrder = $('.page').length;
        
        // Add images in batches to avoid blocking UI
        const batchSize = 3;
        for (let i = 0; i < imageList.length; i += batchSize) {
            const batch = imageList.slice(i, i + batchSize);
            
            const pagePromises = batch.map((imageName, index) => 
                createPage({
                    filename: imageName,
                    order: currentOrder + i + index + 1,
                    caption: '',
                    id: generateId(),
                    rotation: 0
                })
            );
            
            const $pages = await Promise.all(pagePromises);
            
            // Add valid pages to DOM
            $pages.filter(page => page !== null).forEach($page => {
                $('.album').append($page);
            });
            
            // Update progress
            const progress = Math.round(((i + batch.length) / imageList.length) * 100);
            $addAllBtn.text(`Adding... ${progress}%`);
            
            // Small pause between batches to avoid blocking UI
            await new Promise(resolve => setTimeout(resolve, 50));
        }
        
        $addAllBtn.text('Added!').removeClass('btn-outline-light').addClass('btn-success');
        setTimeout(() => {
            $addAllBtn.text(originalText).removeClass('btn-success').addClass('btn-outline-light').prop('disabled', false);
        }, 2000);
        
        // Update checkmarks after adding all images
        updateGalleryCheckmarks();
        
    } catch (error) {
        console.error('Error adding all images to album:', error);
        $addAllBtn.text('Error!').removeClass('btn-primary').addClass('btn-danger');
        setTimeout(() => {
            $addAllBtn.text(originalText).removeClass('btn-danger').addClass('btn-primary').prop('disabled', false);
        }, 2000);
    }
}

/**
 * Updates gallery checkmarks based on which images are currently in the album
 */
function updateGalleryCheckmarks() {
    // Get all filenames currently in the album
    const albumFilenames = new Set();
    $('.page').each(function() {
        const filename = $(this).find('.page-image').attr('data-filename');
        if (filename) {
            albumFilenames.add(filename);
        }
    });
    
    // Update gallery items
    $('.gallery-item').each(function() {
        const filename = $(this).attr('data-filename');
        if (albumFilenames.has(filename)) {
            $(this).addClass('selected');
        } else {
            $(this).removeClass('selected');
        }
    });
}

/**
 * Generates unique ID for new pages
 * @returns {string} Unique 8-character ID
 */
function generateId() {
    const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
    let id = '';
    for (let i = 0; i < 8; i++) {
        id += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    return id;
}

export {
    loadGallery,
    addImageToAlbum,
    addAllImagesToAlbum,
    updateGalleryCheckmarks,
    generateId
};
