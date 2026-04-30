/**
 * Editor Module - Manages text editor for captions
 */

/**
 * Initializes Quill editor
 * @returns {Quill} Quill editor instance
 */
function initializeEditor() {
    const SizeStyle = Quill.import('attributors/style/size');
    SizeStyle.whitelist = null;
    Quill.register(SizeStyle, true);

    const quill = new Quill('#caption-editor', {
        theme: 'snow',
        modules: {
            toolbar: [
                [{ 'color': [] }, { 'background': [] }],
                [{ 'align': [] }],
                ['bold', 'italic', 'underline'],
                ['clean']
            ]
        }
    });

    addFontSizeInput(quill);
    addOpacityInput(quill);

    return quill;
}

/**
 * Adds a numeric pt font-size input to the toolbar
 * @param {Quill} quill - Quill editor instance
 */
function addFontSizeInput(quill) {
    const toolbar = quill.getModule('toolbar').container;

    const wrapper = document.createElement('span');
    wrapper.className = 'ql-formats ql-font-size-control';
    wrapper.innerHTML = `<input type="number" id="ql-font-size-input" min="1" max="999" placeholder="pt" title="Font size (pt)"><span class="ql-font-size-label">pt</span>`;

    toolbar.insertBefore(wrapper, toolbar.firstChild);

    const input = wrapper.querySelector('#ql-font-size-input');
    let lastSelection = null;

    quill.on('selection-change', function(range) {
        if (!range) return;
        lastSelection = range;
        const format = quill.getFormat(range);
        if (format.size) {
            const pt = parseFloat(format.size);
            input.value = isNaN(pt) ? '' : pt;
        } else {
            const pxSize = parseFloat(getComputedStyle(quill.root).fontSize);
            input.value = isNaN(pxSize) ? '' : Math.round(pxSize * 0.75);
        }
    });

    function applySize() {
        const pt = parseInt(input.value);
        if (!pt || pt < 1) return;
        if (lastSelection && lastSelection.length > 0) {
            quill.formatText(lastSelection.index, lastSelection.length, 'size', pt + 'pt');
            setTimeout(() => quill.setSelection(lastSelection.index, lastSelection.length), 0);
        } else {
            const len = quill.getLength() - 1;
            if (len > 0) quill.formatText(0, len, 'size', pt + 'pt');
        }
    }

    input.addEventListener('mousedown', e => e.stopPropagation());
    input.addEventListener('keydown', e => e.stopPropagation());
    input.addEventListener('focus', function() { this.select(); });
    input.addEventListener('input', applySize);
    input.addEventListener('blur', applySize);
    input.addEventListener('keypress', function(e) {
        if (e.key === 'Enter') { e.preventDefault(); applySize(); }
    });
}

/**
 * Adds opacity input field to the toolbar
 * @param {Quill} quill - Quill editor instance
 */
function addOpacityInput(quill) {
    const toolbar = quill.getModule('toolbar').container;
    
    // Wait for the color pickers to be initialized
    setTimeout(() => {
        // Find the background color picker - it's in a span.ql-picker that has class ql-color-picker
        const colorPickers = toolbar.querySelectorAll('.ql-picker.ql-color-picker');
        
        if (colorPickers.length >= 2) {
            const textColorPicker = colorPickers[0];
            const bgColorPicker = colorPickers[1];
            
            // Add custom color picker to text color
            addCustomColorPicker(quill, textColorPicker, 'color');
            
            // Add custom color picker and opacity to background color
            addCustomColorPicker(quill, bgColorPicker, 'background');
            addOpacityControlToBackground(quill, bgColorPicker);
        }
    }, 200);
}

/**
 * Adds custom color picker to a color dropdown
 * @param {Quill} quill - Quill editor instance
 * @param {Element} pickerContainer - The picker container element
 * @param {string} type - 'color' or 'background'
 */
function addCustomColorPicker(quill, pickerContainer, type) {
    const pickerOptions = pickerContainer.querySelector('.ql-picker-options');
    if (!pickerOptions) return;
    
    // Create custom color picker control
    const customColorControl = document.createElement('div');
    customColorControl.className = 'ql-custom-color-control';
    customColorControl.innerHTML = `
        <label>Custom Color:</label>
        <input type="color" class="custom-color-input" data-type="${type}" value="#000000">
    `;
    
    pickerOptions.appendChild(customColorControl);
    
    const colorInput = customColorControl.querySelector('.custom-color-input');
    let lastSelection = null;
    
    // Track selection
    quill.on('selection-change', function(range) {
        if (range && range.length > 0) {
            lastSelection = range;
        }
    });
    
    // Prevent closing picker when clicking color input
    colorInput.addEventListener('mousedown', function(e) {
        e.stopPropagation();
    });
    
    colorInput.addEventListener('click', function(e) {
        e.stopPropagation();
    });
    
    // Apply color when changed
    colorInput.addEventListener('change', function() {
        const color = this.value;
        if (lastSelection && lastSelection.length > 0) {
            quill.formatText(lastSelection.index, lastSelection.length, type, color);
            setTimeout(() => {
                quill.setSelection(lastSelection.index, lastSelection.length);
            }, 0);
        }
    });
}

/**
 * Adds opacity control to background color picker
 * @param {Quill} quill - Quill editor instance
 * @param {Element} bgPickerContainer - Background color picker container
 */
function addOpacityControlToBackground(quill, bgPickerContainer) {
    const bgPicker = bgPickerContainer.querySelector('.ql-picker-options');
    if (!bgPicker) return;
    
    // Create opacity control
    const opacityControl = document.createElement('div');
    opacityControl.className = 'ql-opacity-control';
    opacityControl.innerHTML = `
        <label>Opacity:</label>
        <input type="number" id="bg-opacity-input" min="0" max="100" value="100" step="5">
        <span>%</span>
    `;
    
    bgPicker.appendChild(opacityControl);
    
    // Store the last selection
    let lastSelection = null;
    
    quill.on('selection-change', function(range) {
        if (range && range.length > 0) {
            lastSelection = range;
            const format = quill.getFormat(range);
            if (format.background) {
                const opacity = extractOpacity(format.background);
                opacityInput.value = Math.round(opacity * 100);
            }
        }
    });
    
    // Handle opacity input
    const opacityInput = document.getElementById('bg-opacity-input');
    
    // Prevent input from affecting editor or closing picker
    opacityInput.addEventListener('mousedown', function(e) {
        e.stopPropagation();
    });
    
    opacityInput.addEventListener('keydown', function(e) {
        e.stopPropagation();
    });
    
    opacityInput.addEventListener('focus', function(e) {
        e.stopPropagation();
        this.select();
    });
    
    // Apply on blur or enter key
    opacityInput.addEventListener('blur', function() {
        applyOpacity();
    });
    
    opacityInput.addEventListener('keypress', function(e) {
        if (e.key === 'Enter') {
            e.preventDefault();
            applyOpacity();
        }
    });
    
    function applyOpacity() {
        const opacity = Math.max(0, Math.min(100, parseInt(opacityInput.value) || 100));
        opacityInput.value = opacity;
        
        // Use last selection
        if (lastSelection && lastSelection.length > 0) {
            const format = quill.getFormat(lastSelection);
            if (format.background) {
                const rgbaColor = hexToRgba(format.background, opacity / 100);
                quill.formatText(lastSelection.index, lastSelection.length, 'background', rgbaColor);
                setTimeout(() => {
                    quill.setSelection(lastSelection.index, lastSelection.length);
                }, 0);
            }
        }
    }
}

/**
 * Converts hex color to rgba with opacity
 * @param {string} hex - Hex color code
 * @param {number} opacity - Opacity value (0-1)
 * @returns {string} RGBA color string
 */
function hexToRgba(hex, opacity) {
    // If already rgba, replace opacity
    if (hex.startsWith('rgba')) {
        return hex.replace(/[\d.]+\)$/g, opacity + ')');
    }
    
    // If rgb, convert to rgba
    if (hex.startsWith('rgb')) {
        return hex.replace('rgb', 'rgba').replace(')', `, ${opacity})`);
    }
    
    // Convert hex to rgba
    hex = hex.replace('#', '');
    const r = parseInt(hex.substring(0, 2), 16);
    const g = parseInt(hex.substring(2, 4), 16);
    const b = parseInt(hex.substring(4, 6), 16);
    return `rgba(${r}, ${g}, ${b}, ${opacity})`;
}

/**
 * Extracts opacity from rgba color
 * @param {string} color - Color string
 * @returns {number} Opacity value (0-1)
 */
function extractOpacity(color) {
    if (color.startsWith('rgba')) {
        const match = color.match(/[\d.]+\)$/);
        if (match) {
            return parseFloat(match[0].replace(')', ''));
        }
    }
    return 1; // Default full opacity
}

/**
 * Connects editor with specific page content
 * @param {Event} event - Click event
 * @param {Quill} quill - Quill editor instance
 */
function mirrorWithEditor(event, quill) {
    const $target = $(event.currentTarget);
    
    // Check if target is the text element itself or contains it
    const $textElement = $target.hasClass('text') ? $target : $target.find('.text');
    
    if ($textElement.length === 0) return;
    
    const content = $textElement.html() || '';
    quill.root.innerHTML = content.trim();

    quill.off('text-change');
    quill.on('text-change', function () {
        const htmlContent = quill.root.innerHTML;
        const textContent = quill.getText().trim();
        
        $textElement.html(htmlContent);
        
        // Add or remove "written" class based on content
        if (textContent.length > 0) {
            $textElement.addClass('written');
        } else {
            $textElement.removeClass('written');
        }
    });

    quill.focus();
    setTimeout(_ => quill.setSelection(quill.getLength(), 0), 0);
}

export {
    initializeEditor,
    mirrorWithEditor
};
