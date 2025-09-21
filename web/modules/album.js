/**
 * Album Module - Manages album data loading and saving
 */

import { createPage } from './page.js';
import { updateGalleryCheckmarks } from './gallery.js';

/**
 * Loads album data from server and creates optimized pages
 */
async function loadAlbumData() {
    try {
        const response = await $.getJSON('/api/album');
        const photos = response.album?.photos || [];
        photos.sort((a, b) => a.order - b.order);

        // Optimized loading: process in batches to avoid blocking UI
        const batchSize = 3;
        const batches = [];
        
        for (let i = 0; i < photos.length; i += batchSize) {
            batches.push(photos.slice(i, i + batchSize));
        }

        $('.album').empty();
        
        // Process batches sequentially for better performance
        for (const batch of batches) {
            const pagePromises = batch.map(photo => createPage(photo));
            const $pages = await Promise.all(pagePromises);
            
            // Add valid pages to DOM
            $pages.filter(page => page !== null).forEach($page => {
                $('.album').append($page);
            });
            
            // Small pause between batches to avoid blocking UI
            await new Promise(resolve => setTimeout(resolve, 10));
        }
        
        // Update gallery checkmarks after loading album
        updateGalleryCheckmarks();
    } catch (error) {
        console.error('Error loading album data:', error);
    }
}

/**
 * Saves album data to server
 */
function saveAlbum() {
    const photos = [];
    
    $('.album .page-wrapper').each(function() {
        const $wrapper = $(this);

        photos.push({
            order: Number($wrapper.attr('data-order')), // not data('order') due JQuery Sortable conflict
            id: $wrapper.data('id') || '',
            filename: $wrapper.find('.page-image').attr('data-filename') || '',
            caption: $wrapper.find('.text').text().trim(),
            rotation: parseInt($wrapper.attr('data-rotation') || '0'),
            orientation: $wrapper.attr('data-orientation') || 'horizontal'
        });
    });

    $.ajax({
        url: '/api/save/album',
        method: 'POST',
        contentType: 'application/json',
        data: JSON.stringify(photos),
        success: function(response) {
            showSaveConfirmation();
        },
        error: function(xhr) {
            console.error('Error saving album: ' + (xhr.responseJSON?.error || xhr.statusText));
        }
    });
}

/**
 * Shows visual save confirmation
 */
function showSaveConfirmation() {
    const $check = $('<span class="save-check" style="margin-left:8px;color:white;">&#10003;</span>');
    $('.btn-save-album').after($check);
    setTimeout(() => $check.fadeOut(400, function() { $(this).remove(); }), 1200);
}

export {
    loadAlbumData,
    saveAlbum
};
