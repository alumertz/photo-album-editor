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
}
