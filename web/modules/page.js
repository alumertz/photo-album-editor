/**
 * Page Module - Manages album page creation and manipulation
 */

import { processImage, rotateToTarget, rotateExistingImage } from './imageProcessor.js';
import { updateGalleryCheckmarks } from './gallery.js';

/**
 * Creates a new album page with processed image
 * @param {Object} photo - Object containing photo data
 * @param {string} photo.filename - Image filename
 * @param {number} photo.order - Page order
 * @param {string} photo.caption - Image caption
 * @param {string} photo.id - Unique page ID
 * @returns {Promise<jQuery|null>} Promise that resolves with jQuery page element or null on error
 */
async function createPage(photo) {
    try {
        const imgUrl = `/photos/${photo.filename}`;
        const imageData = await processImage(imgUrl, photo.filename);
        
        const cutmarks = Array(4).fill('<div class="cutmark"></div>').join('');
        const punchmarks = Array(10).fill('<i></i>').join('');
        
        return createPageElement(photo, imageData.imageDataUrl, cutmarks, punchmarks, imageData.originalOrientation);
    } catch (error) {
        console.error('Error creating page:', error);
        return null;
    }
}

/**
 * Creates the page DOM element
 * @param {Object} photo - Photo data
 * @param {string} imageDataUrl - Processed image URL
 * @param {string} cutmarks - Cutmarks HTML
 * @param {string} punchmarks - Punchmarks HTML
 * @param {string} originalOrientation - Original orientation ('vertical' or 'horizontal')
 * @returns {jQuery} jQuery page element
 */
function createPageElement(photo, imageDataUrl, cutmarks, punchmarks, originalOrientation) {
    const pageHtml = `
        <div class="page-wrapper" 
             data-order="${photo.order}" 
             data-id="${photo.id || ''}" 
             data-rotation="${photo.rotation || 0}"
             data-orientation="${originalOrientation}">
            <div class="page">
                ${cutmarks}
                <div class="punchmarks">${punchmarks}</div>
                <button class="btn-add-textbox" title="Add Text Box">
                    <i class="fa fa-font"></i>
                </button>
                <div class="description">
                </div>
            </div>
            <div class="page-bar">
                <div>
                    <span>Page ${photo.order} - ${photo.filename}</span>
                </div>
                <div class="actions">
                    <div class="action btn-rotate">↻ Rotate</div>
                    <div class="action btn-delete">Delete</div>
                </div>
            </div>
        </div>
    `;

    const $page = $(pageHtml);
    
    // Create image div with background-image instead of img element
    const $imageDiv = $('<div>', { 
        class: 'page-image',
        'data-filename': photo.filename
    });
    
    // Set background image with proper CSS
    $imageDiv.css({
        'background-image': `url(${imageDataUrl})`,
    });
    
    $page.find('.page').append($imageDiv);
    
    // Apply saved rotations if any
    const savedRotation = photo.rotation || 0;
    if (savedRotation > 0) {
        applySavedRotations($page, savedRotation);
    }
    
    // Add event listeners
    attachPageEventListeners($page);
    
    return $page;
}

/**
 * Adds event listeners to page elements
 * @param {jQuery} $page - jQuery page element
 */
function attachPageEventListeners($page) {
    $page.find('.btn-delete').on('click', function () {
        $page.remove();
        refreshOrder();
        updateGalleryCheckmarks();
    });

    $page.find('.btn-rotate').on('click', async function () {
        const $wrapper = $page;
        const $imageDiv = $page.find('.page-image')[0];
        const filename = $imageDiv.getAttribute('data-filename');
        const $button = $(this);
        
        // Visual feedback
        $button.html('⟳ Rotating...');
        $button.css('pointer-events', 'none');
        
        try {
            await rotateExistingImage($imageDiv, filename);
            
            // Update rotation count
            const currentRotation = parseInt($wrapper.attr('data-rotation') || '0');
            const newRotation = (currentRotation + 1) % 4; // Keep between 0-3 (0°, 90°, 180°, 270°)
            $wrapper.attr('data-rotation', newRotation);
            
            $button.html('↻ Rotate');
        } catch (error) {
            console.error('Error rotating image:', error);
            $button.html('↻ Error');
        } finally {
            $button.css('pointer-events', 'auto');
        }
    });

    $page.find('.content').on('click', function (event) {
        window.mirrorWithEditor(event, window.quill);
    });
}

/**
 * Applies saved rotations to an image element
 * @param {jQuery} $page - Page element
 * @param {number} rotationCount - Number of 90° rotations to apply
 */
async function applySavedRotations($page, rotationCount) {
    if (rotationCount <= 0) return;
    
    const $imageDiv = $page.find('.page-image')[0];
    const filename = $imageDiv.getAttribute('data-filename');
    
    try {
        // Apply rotations directly to target - MUCH MORE EFFICIENT!
        await rotateToTarget($imageDiv, rotationCount, filename);
    } catch (error) {
        console.error('Error applying saved rotations:', error);
    }
}

/**
 * Updates page order in album
 */
function refreshOrder() {
    $('.album .page-wrapper:not(.sortable-being-dragged)').each(function(index) {
        $(this).attr('data-order', index + 1);
        const filename = $(this).find('.page-image').attr('data-filename') || '<unknown>';
        $(this).find('.page-bar span').text(`Page ${index + 1} - ${filename}`);
    });
}

export {
    createPage,
    createPageElement,
    refreshOrder
};
