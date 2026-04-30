/**
 * Main Application Entry Point
 * Coordinates all modules and initializes the application
 */

import './style.css';

import { loadAlbumData, saveAlbum } from './modules/album.js';
import { loadGallery } from './modules/gallery.js';
import { initializeEditor, mirrorWithEditor } from './modules/editor.js';
import { toggleCutMarks, initializeSortable, handlePrint, handlePhotoPrint } from './modules/ui.js';
import { setupPrintEventListeners } from './modules/print.js';

// Global variables needed for compatibility
let quill;

/**
 * Initializes the application when DOM is ready
 */
$(document).ready(function () {
    initializeComponents();
    loadInitialData();
    setupEventListeners();
    initializeSortable();
});

/**
 * Initializes main components
 */
function initializeComponents() {
    quill = initializeEditor();
    
    // Expose globally for module compatibility
    window.quill = quill;
    window.mirrorWithEditor = mirrorWithEditor;
}

/**
 * Loads initial application data
 */
function loadInitialData() {
    loadAlbumData();
    loadGallery();
}

/**
 * Sets up all application event listeners
 */
function setupEventListeners() {
    $('.btn-refresh-gallery').on('click', loadGallery);
    $('.btn-print').on('click', handlePrint);
    $('.btn-print-photo').on('click', handlePhotoPrint);
    $('.btn-save-album').on('click', saveAlbum);
    $('.btn-toggle-marks').on('click', toggleCutMarks);
    setupPrintEventListeners();
    setupTextBoxControls();
    setupAddTextBoxButtons();
    setupAddDateBoxButtons();
    setupDateBoxSidebarControls();
}

/**
 * Sets up add text box button functionality
 */
function setupAddTextBoxButtons() {
    $(document).on('click', '.btn-add-textbox', function(e) {
        e.stopPropagation();
        const $page = $(this).closest('.page');
        const $description = $page.find('.description');
        
        // Create new text box wrapper
        const textBoxId = 'textbox-' + Date.now();
        const $textBoxWrapper = $('<div>', {
            class: 'textbox',
            'data-id': textBoxId,
            'data-orientation': 'vertical'
        });
        
        // Position it
        $textBoxWrapper.css({
            right: '20px',
            bottom: '20px'
        });
        
        const $textContainer = $('<div>', {
            class: 'text-container'
        });
        
        const $deleteBtn = $('<button>', {
            class: 'textbox-delete',
            html: '×',
            title: 'Delete text box'
        });
        
        const $rotateBtn = $('<button>', {
            class: 'textbox-rotate',
            html: '↻',
            title: 'Rotate text box'
        });
        
        const $text = $('<div>', {
            class: 'text',
            html: '<p></p>'
        });
        
        // Append structure: textbox > text-container > (buttons + text)
        $textContainer.append($deleteBtn).append($rotateBtn).append($text);
        $textBoxWrapper.append($textContainer);
        $description.append($textBoxWrapper);
        
        // Make the wrapper draggable
        $textBoxWrapper.draggable({
            containment: 'parent',
            scroll: false,
            cancel: '.textbox-delete, .textbox-rotate'
        });
        
        // Prevent dragging when clicking on text (to allow editing)
        $text.on('mousedown', function(e) {
            e.stopPropagation();
        });
        
        // Connect to editor when clicked
        $text.on('click', function(e) {
            e.stopPropagation();
            const event = { currentTarget: this };
            mirrorWithEditor(event, quill);
            window.currentTextBox = $(this);
            updateTextBoxControls($(this));
        });
        
        // Delete button
        $deleteBtn.on('click', function(e) {
            e.stopPropagation();
            e.preventDefault();
            $textBoxWrapper.remove();
        });
        
        // Rotate button
        $rotateBtn.on('click', function(e) {
            e.stopPropagation();
            e.preventDefault();
            const currentOrientation = $textBoxWrapper.attr('data-orientation');
            const newOrientation = currentOrientation === 'vertical' ? 'horizontal' : 'vertical';
            $textBoxWrapper.attr('data-orientation', newOrientation);
            
            if (newOrientation === 'horizontal') {
                $text.addClass('horizontal');
            } else {
                $text.removeClass('horizontal');
            }
        });
        
        // Auto-click to open editor
        setTimeout(() => {
            $text.trigger('click');
        }, 100);
    });
}

/**
 * Sets up add date box button functionality
 */
function setupAddDateBoxButtons() {
    $(document).on('click', '.btn-add-datebox', async function(e) {
        e.stopPropagation();
        const $page = $(this).closest('.page');
        const $description = $page.find('.description');
        const filename = $page.find('.page-image').attr('data-filename') || '';

        let dateValue = '00/00/0000';
        try {
            const result = await $.getJSON(`/api/photo-exif-date/${encodeURIComponent(filename)}`);
            if (result.date) dateValue = result.date;
        } catch (e) { /* fallback to zeros */ }

        const dateBoxId = 'datebox-' + Date.now();
        const $dateBoxWrapper = $('<div>', {
            class: 'datebox',
            'data-id': dateBoxId,
            'data-divider': '/'
        });

        $dateBoxWrapper.css({ right: '20px', bottom: '60px' });

        const $textContainer = $('<div>', { class: 'text-container' });
        const $deleteBtn = $('<button>', {
            class: 'textbox-delete',
            html: '×',
            title: 'Delete date box'
        });
        const $rotateBtn = $('<button>', {
            class: 'textbox-rotate',
            html: '↻',
            title: 'Rotate date box'
        });
        const $text = $('<div>', {
            class: 'text preset-overlay',
            html: `<p>${dateValue}</p>`
        });

        $textContainer.append($deleteBtn).append($rotateBtn).append($text);
        $dateBoxWrapper.append($textContainer);
        $description.append($dateBoxWrapper);

        $dateBoxWrapper.draggable({
            containment: 'parent',
            scroll: false,
            cancel: '.textbox-delete'
        });

        $text.on('mousedown', function(e) { e.stopPropagation(); });

        $text.on('click', function(e) {
            e.stopPropagation();
            const event = { currentTarget: this };
            mirrorWithEditor(event, quill);
            window.currentTextBox = $(this);
            window.currentDateBox = $dateBoxWrapper;
            updateDateBoxSidebarControls($dateBoxWrapper);
            updateTextBoxControls($(this));
        });

        $deleteBtn.on('click', function(e) {
            e.stopPropagation();
            e.preventDefault();
            $dateBoxWrapper.remove();
        });

        $rotateBtn.on('click', function(e) {
            e.stopPropagation();
            e.preventDefault();
            const isVertical = $text.css('writing-mode') === 'vertical-rl';
            if (isVertical) {
                $text.css({ 'writing-mode': 'horizontal-tb', 'transform': 'none' });
            } else {
                $text.css({ 'writing-mode': 'vertical-rl', 'transform': 'rotate(180deg)' });
            }
        });

        setTimeout(() => { $text.trigger('click'); }, 100);
    });
}

/**
 * Updates the datebox sidebar controls to reflect the active date box state
 */
function updateDateBoxSidebarControls($dateBox) {
    const currentDivider = $dateBox.attr('data-divider') || '/';
    $('.datebox-divider').removeClass('active');
    $(`.datebox-divider[data-divider="${CSS.escape(currentDivider)}"]`).addClass('active');

    const $text = $dateBox.find('.text');
    const presetClasses = ['preset-overlay', 'preset-classic', 'preset-stamp', 'preset-film'];
    const activePreset = presetClasses.find(p => $text.hasClass(p));
    $('.datebox-preset').removeClass('active btn-secondary').addClass('btn-outline-light');
    if (activePreset) {
        const name = activePreset.replace('preset-', '');
        $(`.datebox-preset[data-preset="${name}"]`).removeClass('btn-outline-light').addClass('btn-secondary active');
    }
}

/**
 * Sets up datebox sidebar preset and divider controls
 */
function setupDateBoxSidebarControls() {
    $(document).on('click', '.datebox-preset', function() {
        if (!window.currentDateBox) return;
        const preset = $(this).data('preset');
        const $text = window.currentDateBox.find('.text');
        $text.removeClass('preset-overlay preset-classic preset-stamp preset-film');
        $text.addClass('preset-' + preset);
        updateDateBoxSidebarControls(window.currentDateBox);
    });

    $(document).on('click', '.datebox-divider', function() {
        if (!window.currentDateBox) return;
        const newDivider = $(this).attr('data-divider');
        const currentDivider = window.currentDateBox.attr('data-divider') || '/';
        const $text = window.currentDateBox.find('.text');
        replaceDividerInTextNodes($text[0], currentDivider, newDivider);
        window.currentDateBox.attr('data-divider', newDivider);
        updateDateBoxSidebarControls(window.currentDateBox);
    });
}

/**
 * Replaces divider characters in text nodes only (preserving HTML tags)
 */
function replaceDividerInTextNodes(element, oldStr, newStr) {
    element.childNodes.forEach(node => {
        if (node.nodeType === Node.TEXT_NODE) {
            node.textContent = node.textContent.split(oldStr).join(newStr);
        } else {
            replaceDividerInTextNodes(node, oldStr, newStr);
        }
    });
}

/**
 * Sets up text box background controls
 */
function setupTextBoxControls() {
    window.currentTextBox = null;
    
    // Track which text box is being edited - use event delegation
    $(document).on('click', '.textbox .text', function(e) {
        e.stopPropagation();
        window.currentTextBox = $(this);
        updateTextBoxControls($(this));
        $('#textbox-size').val($(this).attr('data-size') || '');
    });
    
    // Color change
    $('#textbox-bg-color').on('change', function() {
        if (window.currentTextBox) {
            applyTextBoxBackground(window.currentTextBox);
        }
    });
    
    // Opacity change
    $('#textbox-bg-opacity').on('input change', function() {
        if (window.currentTextBox) {
            applyTextBoxBackground(window.currentTextBox);
        }
    });
    
    // Remove background (set to transparent)
    $('#textbox-bg-remove').on('click', function() {
        if (window.currentTextBox) {
            window.currentTextBox.css('background', 'transparent');
            $('#textbox-bg-opacity').val(0);
        }
    });
    
    // Reset to default background
    $('#textbox-bg-default').on('click', function() {
        if (window.currentTextBox) {
            window.currentTextBox.css('background', 'rgba(0, 0, 0, 0.67)');
            $('#textbox-bg-color').val('#000000');
            $('#textbox-bg-opacity').val(67);
        }
    });

    // Size change
    $('#textbox-size').on('change', function() {
        if (!window.currentTextBox) return;
        const padding = $(this).val();
        window.currentTextBox.css('padding', padding || '');
        window.currentTextBox.attr('data-size', padding);
    });
}

/**
 * Updates text box controls based on current text box
 */
function updateTextBoxControls($textBox) {
    const bgColor = $textBox.css('background-color');
    
    // Default values
    let hexColor = '#000000';
    let opacityValue = 67;
    
    if (bgColor && bgColor !== 'rgba(0, 0, 0, 0)' && bgColor !== 'transparent') {
        // Extract color and opacity
        const rgba = bgColor.match(/rgba?\((\d+),\s*(\d+),\s*(\d+)(?:,\s*([\d.]+))?\)/);
        if (rgba) {
            const r = parseInt(rgba[1]);
            const g = parseInt(rgba[2]);
            const b = parseInt(rgba[3]);
            const a = rgba[4] ? parseFloat(rgba[4]) : 1;
            
            hexColor = '#' + [r, g, b].map(x => x.toString(16).padStart(2, '0')).join('');
            opacityValue = Math.round(a * 100);
        }
    }
    
    $('#textbox-bg-color').val(hexColor);
    $('#textbox-bg-opacity').val(opacityValue);
}

/**
 * Applies background color to text box
 */
function applyTextBoxBackground($textBox) {
    const color = $('#textbox-bg-color').val();
    const opacity = $('#textbox-bg-opacity').val() / 100;
    
    // Convert hex to rgba
    const r = parseInt(color.substr(1, 2), 16);
    const g = parseInt(color.substr(3, 2), 16);
    const b = parseInt(color.substr(5, 2), 16);
    
    $textBox.css('background', `rgba(${r}, ${g}, ${b}, ${opacity})`);
}
