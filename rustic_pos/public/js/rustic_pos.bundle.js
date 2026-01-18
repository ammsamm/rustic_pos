/**
 * Rustic POS - ERPNext v15 POS Extension
 *
 * Extends the standard ERPNext Point of Sale with:
 * - Configurable warehouse selector visibility
 * - Configurable discount controls visibility
 * - UOM toggle buttons for items with multiple UOMs
 */

frappe.provide('rustic_pos');

rustic_pos.initialized = false;

/**
 * Initialize Rustic POS
 */
rustic_pos.init = function() {
    if (rustic_pos.initialized) return;

    // Patch ItemSelector prototype (fix qty display)
    rustic_pos.patchItemSelector();

    // Patch ItemDetails prototype
    rustic_pos.patchItemDetails();

    // Patch ItemCart prototype
    rustic_pos.patchItemCart();

    rustic_pos.initialized = true;

    // Add view toggle after initialization
    setTimeout(function() {
        rustic_pos.initViewToggle();
    }, 500);
};

/**
 * Initialize view toggle for ItemSelector
 */
rustic_pos.initViewToggle = function() {
    if (!window.cur_pos || !window.cur_pos.item_selector) return;

    const component = window.cur_pos.item_selector;
    const posProfile = window.cur_pos.pos_profile;

    if (!posProfile) return;

    frappe.call({
        method: 'frappe.client.get_value',
        args: {
            doctype: 'POS Profile',
            filters: { name: posProfile },
            fieldname: ['rustic_enable_list_view']
        },
        callback: function(r) {
            if (r.message && cint(r.message.rustic_enable_list_view)) {
                rustic_pos.renderViewToggle(component);
            }
        }
    });

/**
 * Patch ItemSelector to fix floating-point qty display and add list view
 */
rustic_pos.patchItemSelector = function() {
    if (!erpnext.PointOfSale || !erpnext.PointOfSale.ItemSelector) {
        return;
    }

    const ItemSelector = erpnext.PointOfSale.ItemSelector.prototype;
    const originalGetItemHtml = ItemSelector.get_item_html;
    const originalMake = ItemSelector.make;
    const originalRenderItemList = ItemSelector.render_item_list;

    // Patch make() to add view toggle button
    ItemSelector.make = function() {
        originalMake.call(this);
        rustic_pos.addViewToggle(this);
    };

    // Patch get_item_html() to fix qty and support list view
    ItemSelector.get_item_html = function(item) {
        // Fix floating-point precision for actual_qty before rendering
        if (item.actual_qty !== undefined && item.actual_qty !== null) {
            item.actual_qty = flt(item.actual_qty, 2);
        }

        // Check if list view is active
        if (rustic_pos.isListViewActive()) {
            return rustic_pos.getListItemHtml(item, this);
        }

        return originalGetItemHtml.call(this, item);
    };

    // Patch render_item_list() to apply list view class
    ItemSelector.render_item_list = function(items) {
        originalRenderItemList.call(this, items);
        rustic_pos.applyViewMode(this);
    };
};

/**
 * Check if list view is active
 */
rustic_pos.isListViewActive = function() {
    return localStorage.getItem('rustic_pos_view_mode') === 'list';
};

/**
 * Add view toggle button to ItemSelector
 */
rustic_pos.addViewToggle = function(component) {
    // Get settings first
    const posProfile = window.cur_pos && window.cur_pos.pos_profile;
    if (!posProfile) return;

    frappe.call({
        method: 'frappe.client.get_value',
        args: {
            doctype: 'POS Profile',
            filters: { name: posProfile },
            fieldname: ['rustic_enable_list_view']
        },
        async: false,
        callback: function(r) {
            if (r.message && cint(r.message.rustic_enable_list_view)) {
                rustic_pos.renderViewToggle(component);
            }
        }
    });
};

/**
 * Render view toggle button
 */
rustic_pos.renderViewToggle = function(component) {
    // Try different selectors
    let $header = component.$component.find('.filter-section .label');
    if (!$header.length) {
        $header = component.$component.find('.filter-section');
    }
    if (!$header.length) {
        $header = component.$component.find('.search-field');
    }
    if (!$header.length) return;

    // Check if toggle already exists
    if (component.$component.find('.rustic-view-toggle').length) return;

    const currentView = rustic_pos.isListViewActive() ? 'list' : 'grid';

    const toggleHtml = `
        <div class="rustic-view-toggle" style="display:inline-flex;margin-left:10px;vertical-align:middle;">
            <button type="button" class="btn btn-xs ${currentView === 'grid' ? 'btn-primary' : 'btn-default'} rustic-grid-btn" title="${__('Grid View')}" style="padding:4px 8px;">
                <svg width="14" height="14" viewBox="0 0 16 16" fill="currentColor">
                    <rect x="1" y="1" width="6" height="6" rx="1"/>
                    <rect x="9" y="1" width="6" height="6" rx="1"/>
                    <rect x="1" y="9" width="6" height="6" rx="1"/>
                    <rect x="9" y="9" width="6" height="6" rx="1"/>
                </svg>
            </button>
            <button type="button" class="btn btn-xs ${currentView === 'list' ? 'btn-primary' : 'btn-default'} rustic-list-btn" title="${__('List View')}" style="padding:4px 8px;margin-left:2px;">
                <svg width="14" height="14" viewBox="0 0 16 16" fill="currentColor">
                    <rect x="1" y="2" width="14" height="2" rx="0.5"/>
                    <rect x="1" y="7" width="14" height="2" rx="0.5"/>
                    <rect x="1" y="12" width="14" height="2" rx="0.5"/>
                </svg>
            </button>
        </div>
    `;

    $header.after(toggleHtml);

    // Bind click events
    component.$component.find('.rustic-grid-btn').on('click', function() {
        rustic_pos.setViewMode('grid', component);
    });

    component.$component.find('.rustic-list-btn').on('click', function() {
        rustic_pos.setViewMode('list', component);
    });
};

/**
 * Set view mode and refresh items
 */
rustic_pos.setViewMode = function(mode, component) {
    localStorage.setItem('rustic_pos_view_mode', mode);

    // Update button states
    const $toggle = component.$component.find('.rustic-view-toggle');
    $toggle.find('.rustic-grid-btn').removeClass('btn-primary').addClass('btn-default');
    $toggle.find('.rustic-list-btn').removeClass('btn-primary').addClass('btn-default');

    if (mode === 'grid') {
        $toggle.find('.rustic-grid-btn').removeClass('btn-default').addClass('btn-primary');
    } else {
        $toggle.find('.rustic-list-btn').removeClass('btn-default').addClass('btn-primary');
    }

    // Refresh item display
    rustic_pos.applyViewMode(component);

    // Re-render items by triggering search
    const searchTerm = component.$component.find('.search-field input').val() || '';
    component.search_field.set_value(searchTerm);
};

/**
 * Apply view mode class to items container
 */
rustic_pos.applyViewMode = function(component) {
    const $itemsContainer = component.$component.find('.items-container');
    if (!$itemsContainer.length) return;

    if (rustic_pos.isListViewActive()) {
        $itemsContainer.addClass('rustic-list-view');
    } else {
        $itemsContainer.removeClass('rustic-list-view');
    }
};

/**
 * Get list view HTML for an item
 */
rustic_pos.getListItemHtml = function(item, component) {
    const me = component;

    const { item_code, item_name, stock_uom, price_list_rate, actual_qty, is_stock_item } = item;

    // Determine stock indicator
    let stockClass = 'text-muted';
    let stockQty = actual_qty || 0;
    if (is_stock_item) {
        if (stockQty > 10) stockClass = 'text-success';
        else if (stockQty > 0) stockClass = 'text-warning';
        else stockClass = 'text-danger';
    }

    // Format price
    const formattedPrice = format_currency(price_list_rate, me.currency);

    return `
        <div class="item-wrapper rustic-list-item"
            data-item-code="${escape(item_code)}"
            data-serial-no="${escape(item.serial_no || '')}"
            data-batch-no="${escape(item.batch_no || '')}"
            data-uom="${escape(stock_uom || '')}"
            data-rate="${escape(price_list_rate || 0)}"
            style="display:flex; align-items:center; padding:8px 12px; border-bottom:1px solid var(--border-color); cursor:pointer;">
            <div style="flex:1; min-width:0;">
                <div style="font-weight:500; white-space:nowrap; overflow:hidden; text-overflow:ellipsis;">
                    ${frappe.utils.escape_html(item_name || item_code)}
                </div>
                <div class="text-muted small">${frappe.utils.escape_html(item_code)}</div>
            </div>
            <div style="width:80px; text-align:right; margin-right:15px;">
                <span class="${stockClass}">${flt(stockQty, 2)} ${frappe.utils.escape_html(stock_uom || '')}</span>
            </div>
            <div style="width:80px; text-align:right; font-weight:500;">
                ${formattedPrice}
            </div>
        </div>
    `;
};

/**
 * Patch ItemDetails to add UOM toggle buttons
 */
rustic_pos.patchItemDetails = function() {
    if (!erpnext.PointOfSale || !erpnext.PointOfSale.ItemDetails) {
                return;
    }

    const ItemDetails = erpnext.PointOfSale.ItemDetails.prototype;
    const originalRenderForm = ItemDetails.render_form;

    ItemDetails.render_form = function(item) {
        // Call original method
        originalRenderForm.call(this, item);

        // Apply Rustic POS customizations
        rustic_pos.applyItemDetailsCustomizations(this, item);
    };
};

/**
 * Patch ItemCart to hide discount button
 */
rustic_pos.patchItemCart = function() {
    if (!erpnext.PointOfSale || !erpnext.PointOfSale.ItemCart) {
        console.warn('Rustic POS: ItemCart not found');
        return;
    }

    const ItemCart = erpnext.PointOfSale.ItemCart.prototype;
    const originalMakeCartTotals = ItemCart.make_cart_totals_section;

    ItemCart.make_cart_totals_section = function() {
        // Call original method
        originalMakeCartTotals.call(this);

        // Apply Rustic POS customizations
        rustic_pos.applyCartCustomizations(this);
    };
};

/**
 * Apply customizations to ItemDetails
 */
rustic_pos.applyItemDetailsCustomizations = function(component, item) {
    // Fetch rustic settings directly from POS Profile
    rustic_pos.getRusticSettings(component, function(settings) {
        
        // Hide warehouse if not allowed
        if (!settings.rustic_allow_warehouse_change) {
            component.$form_container.find('.warehouse-control').hide();
        }

        // Hide discount if not allowed
        if (!settings.rustic_allow_discount_change) {
            component.$form_container.find('.discount_percentage-control').hide();
        }

        // Handle UOM
        if (!settings.rustic_allow_uom_change) {
            rustic_pos.showUomReadonly(component, item);
        } else {
            rustic_pos.fetchAndShowUomButtons(component, item);
        }
    });
};

/**
 * Get Rustic POS settings from POS Profile
 */
rustic_pos.getRusticSettings = function(component, callback) {
    // Check cache first
    if (rustic_pos.settings_cache) {
        callback(rustic_pos.settings_cache);
        return;
    }

    // Get POS Profile name from component
    const posProfile = component.settings?.name ||
                       (window.cur_pos && window.cur_pos.pos_profile);

    if (!posProfile) {
        console.warn('Rustic POS: No POS Profile found');
        callback({});
        return;
    }

    frappe.call({
        method: 'frappe.client.get_value',
        args: {
            doctype: 'POS Profile',
            filters: { name: posProfile },
            fieldname: [
                'rustic_allow_warehouse_change',
                'rustic_allow_discount_change',
                'rustic_allow_uom_change',
                'rustic_enable_list_view'
            ]
        },
        async: false,
        callback: function(r) {
            if (r.message) {
                rustic_pos.settings_cache = {
                    rustic_allow_warehouse_change: cint(r.message.rustic_allow_warehouse_change),
                    rustic_allow_discount_change: cint(r.message.rustic_allow_discount_change),
                    rustic_allow_uom_change: cint(r.message.rustic_allow_uom_change),
                    rustic_enable_list_view: cint(r.message.rustic_enable_list_view)
                };
                callback(rustic_pos.settings_cache);
            } else {
                callback({});
            }
        }
    });
};

/**
 * Apply customizations to ItemCart
 */
rustic_pos.applyCartCustomizations = function(component) {
    rustic_pos.getRusticSettings(component, function(settings) {
        if (!settings.rustic_allow_discount_change) {
            component.$component.find('.add-discount-wrapper').remove();
        }
    });
};

/**
 * Show UOM as readonly text
 */
rustic_pos.showUomReadonly = function(component, item) {
    const $uomControl = component.$form_container.find('.uom-control');
    if (!$uomControl.length) return;

    $uomControl.hide();

    // Hide conversion factor and price list rate
    component.$form_container.find('.conversion_factor-control').hide();
    component.$form_container.find('.price_list_rate-control').hide();

    component.$form_container.find('.rustic-uom-readonly').remove();

    const html = `
        <div class="rustic-uom-readonly" style="padding:8px 0;font-size:var(--text-md);">
            <span style="color:var(--text-muted);">${__('UOM')}:</span>
            <span style="font-weight:500;margin-left:4px;">${item.uom || item.stock_uom || ''}</span>
        </div>
    `;
    // Append at the end
    component.$form_container.append(html);
};

/**
 * Fetch UOMs and show toggle buttons
 */
rustic_pos.fetchAndShowUomButtons = function(component, item) {
    if (!item || !item.item_code) return;

    
    // Fetch UOMs from Item doctype
    frappe.call({
        method: 'frappe.client.get',
        args: {
            doctype: 'Item',
            name: item.item_code
        },
        async: false,
        callback: function(r) {
            if (r.message && r.message.uoms && r.message.uoms.length > 1) {
                rustic_pos.renderUomToggleButtons(component, item, r.message.uoms);
            }
        }
    });
};

/**
 * Render UOM toggle buttons
 */
rustic_pos.renderUomToggleButtons = function(component, item, uoms) {
    const $uomControl = component.$form_container.find('.uom-control');
    if (!$uomControl.length) return;

    // Hide original UOM control
    $uomControl.hide();

    // Hide conversion factor and price list rate
    component.$form_container.find('.conversion_factor-control').hide();
    component.$form_container.find('.price_list_rate-control').hide();

    // Remove existing custom elements
    component.$form_container.find('.rustic-uom-container').remove();

    const currentUom = item.uom || item.stock_uom;

    // Build buttons
    let buttonsHtml = '';
    uoms.forEach(function(uomRow) {
        const uomName = uomRow.uom;
        const isActive = uomName === currentUom;
        const cf = uomRow.conversion_factor || 1;

        buttonsHtml += `
            <button type="button"
                class="btn btn-${isActive ? 'primary' : 'default'} btn-sm rustic-uom-btn"
                data-uom="${frappe.utils.escape_html(uomName)}"
                data-cf="${cf}"
                style="margin-right:5px;margin-bottom:5px;">
                ${frappe.utils.escape_html(uomName)}
            </button>
        `;
    });

    // Find stock UOM for conversion display
    const stockUomRow = uoms.find(u => u.conversion_factor === 1);
    const stockUom = stockUomRow ? stockUomRow.uom : '';
    const currentCf = uoms.find(u => u.uom === currentUom)?.conversion_factor || 1;

    let conversionText = '';
    if (currentCf !== 1 && stockUom) {
        conversionText = `1 ${currentUom} = ${currentCf} ${stockUom}`;
    }

    const containerHtml = `
        <div class="rustic-uom-container" style="padding:8px 0;">
            <label class="control-label" style="display:block;margin-bottom:5px;">${__('Unit of Measure')}</label>
            <div class="rustic-uom-buttons">${buttonsHtml}</div>
            <div class="rustic-uom-info text-muted small" style="margin-top:5px;">${conversionText}</div>
        </div>
    `;

    // Append at the end of form container
    component.$form_container.append(containerHtml);

    // Bind click events
    component.$form_container.find('.rustic-uom-btn').on('click', function() {
        const $btn = $(this);
        const newUom = $btn.data('uom');
        const newCf = $btn.data('cf');

        // Update button styles
        component.$form_container.find('.rustic-uom-btn')
            .removeClass('btn-primary').addClass('btn-default');
        $btn.removeClass('btn-default').addClass('btn-primary');

        // Update item UOM
        component.events.form_updated(component.current_item, 'uom', newUom);

        // Update conversion factor
        component.events.form_updated(component.current_item, 'conversion_factor', newCf);

        // Update conversion info
        let infoText = '';
        if (newCf !== 1 && stockUom) {
            infoText = `1 ${newUom} = ${newCf} ${stockUom}`;
        }
        component.$form_container.find('.rustic-uom-info').text(infoText);
    });
};

/**
 * Wait for POS to load and initialize
 */
$(document).on('page-change', function() {
    if (frappe.get_route_str() === 'point-of-sale') {
        rustic_pos.waitAndInit();
    }
});

// Also handle direct page load
$(document).ready(function() {
    setTimeout(function() {
        if (frappe.get_route_str() === 'point-of-sale') {
            rustic_pos.waitAndInit();
        }
    }, 100);
});

rustic_pos.waitAndInit = function() {
    let attempts = 0;
    const maxAttempts = 50;

    const checkInterval = setInterval(function() {
        attempts++;

        if (erpnext.PointOfSale && erpnext.PointOfSale.ItemDetails && erpnext.PointOfSale.ItemCart) {
            clearInterval(checkInterval);
            rustic_pos.init();
        }

        if (attempts >= maxAttempts) {
            clearInterval(checkInterval);
            console.warn('Rustic POS: Timeout waiting for POS components');
        }
    }, 100);
};
