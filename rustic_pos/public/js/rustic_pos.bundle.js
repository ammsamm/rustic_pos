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

    // Patch ItemDetails prototype
    rustic_pos.patchItemDetails();

    // Patch ItemCart prototype
    rustic_pos.patchItemCart();

    rustic_pos.initialized = true;
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
                'rustic_allow_uom_change'
            ]
        },
        async: false,
        callback: function(r) {
            if (r.message) {
                rustic_pos.settings_cache = {
                    rustic_allow_warehouse_change: cint(r.message.rustic_allow_warehouse_change),
                    rustic_allow_discount_change: cint(r.message.rustic_allow_discount_change),
                    rustic_allow_uom_change: cint(r.message.rustic_allow_uom_change)
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
    component.$form_container.find('.rustic-uom-readonly').remove();

    const html = `
        <div class="rustic-uom-readonly" style="padding:8px 0;font-size:var(--text-md);">
            <span style="color:var(--text-muted);">${__('UOM')}:</span>
            <span style="font-weight:500;margin-left:4px;">${item.uom || item.stock_uom || ''}</span>
        </div>
    `;
    $uomControl.after(html);
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

    // Hide original control
    $uomControl.hide();

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

    $uomControl.after(containerHtml);

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

        // Update conversion factor control if exists
        if (component.conversion_factor_control) {
            component.conversion_factor_control.set_value(newCf);
        }

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
