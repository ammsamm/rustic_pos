/**
 * Rustic POS - ERPNext v15 POS Extension
 *
 * Extends the standard ERPNext Point of Sale with:
 * - Configurable warehouse selector visibility
 * - Configurable discount controls visibility
 * - UOM toggle buttons for items with multiple UOMs
 * - Hide loyalty section option
 * - Simplified customer form (name, mobile, email only)
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

    // Patch customer dialog for simplified form
    rustic_pos.patchCustomerDialog();

    rustic_pos.initialized = true;

    // Apply view mode after initialization
    setTimeout(function() {
        rustic_pos.initViewMode();
    }, 500);
};

/**
 * Initialize view mode for ItemSelector based on POS Profile setting
 */
rustic_pos.initViewMode = function() {
    if (!window.cur_pos || !window.cur_pos.item_selector) return;

    const component = window.cur_pos.item_selector;
    const posProfile = window.cur_pos.pos_profile;

    if (!posProfile) return;

    frappe.call({
        method: 'frappe.client.get_value',
        args: {
            doctype: 'POS Profile',
            filters: { name: posProfile },
            fieldname: ['rustic_item_view_mode', 'rustic_hide_loyalty', 'rustic_hide_item_group']
        },
        callback: function(r) {
            if (r.message) {
                rustic_pos.view_mode = r.message.rustic_item_view_mode || 'Grid';
                rustic_pos.hide_loyalty = cint(r.message.rustic_hide_loyalty);
                rustic_pos.hide_item_group = cint(r.message.rustic_hide_item_group);

                // Hide item group filter if setting enabled
                if (rustic_pos.hide_item_group) {
                    rustic_pos.hideItemGroupFilter(component);
                }
                // Refresh items to apply view mode
                rustic_pos.applyViewMode(component);
                // Trigger refresh
                const searchTerm = component.$component.find('.search-field input').val() || '';
                component.search_field.set_value(searchTerm);
            }
        }
    });
};

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
 * Check if list view is active (based on POS Profile setting)
 */
rustic_pos.isListViewActive = function() {
    return rustic_pos.view_mode === 'List';
};

/**
 * Hide item group filter/search box
 */
rustic_pos.hideItemGroupFilter = function(component) {
    if (!component || !component.$component) return;

    // Hide the item group field (usually a Link field or search box)
    component.$component.find('.item-group-field').hide();
    component.$component.find('[data-fieldname="item_group"]').closest('.frappe-control').hide();

    // Also try to hide by class name patterns used in POS
    component.$component.find('.filter-section').hide();
    component.$component.find('.item-group-filter').hide();
};

/**
 * Apply view mode class to items container
 */
rustic_pos.applyViewMode = function(component) {
    const $itemsContainer = component.$component.find('.items-container');
    if (!$itemsContainer.length) return;

    // Remove existing table header
    component.$component.find('.rustic-list-header').remove();

    if (rustic_pos.isListViewActive()) {
        $itemsContainer.addClass('rustic-list-view');
        // Override grid layout to single column
        $itemsContainer.css({
            'display': 'block',
            'grid-template-columns': 'unset'
        });
        // Add table header
        rustic_pos.addListHeader(component);
    } else {
        $itemsContainer.removeClass('rustic-list-view');
        // Restore grid layout
        $itemsContainer.css({
            'display': '',
            'grid-template-columns': ''
        });
    }
};

/**
 * Add fixed header for list view
 */
rustic_pos.addListHeader = function(component) {
    const $itemsContainer = component.$component.find('.items-container');
    if (!$itemsContainer.length) return;

    // Add CSS styles for list view if not already added
    if (!$('#rustic-list-styles').length) {
        const styles = `
            <style id="rustic-list-styles">
                .rustic-list-view .rustic-list-item {
                    display: flex;
                    align-items: center;
                    padding: 10px 12px;
                    border-bottom: 1px solid var(--border-color);
                    cursor: pointer;
                    background: var(--bg-color);
                    width: 100%;
                }
                .rustic-list-view .rustic-list-item:hover {
                    background: var(--subtle-fg) !important;
                }
                .rustic-list-view .rustic-item-name {
                    flex: 1;
                    min-width: 0;
                    font-weight: 500;
                    white-space: nowrap;
                    overflow: hidden;
                    text-overflow: ellipsis;
                }
                .rustic-list-view .rustic-item-stock {
                    width: 100px;
                    text-align: right;
                    margin-right: 15px;
                }
                .rustic-list-view .rustic-item-price {
                    width: 100px;
                    text-align: right;
                    font-weight: 600;
                }
                .rustic-list-header {
                    display: flex;
                    align-items: center;
                    padding: 10px 12px;
                    background: var(--subtle-fg);
                    border-bottom: 2px solid var(--border-color);
                    font-weight: 600;
                    font-size: var(--text-sm);
                    position: sticky;
                    top: 0;
                    z-index: 1;
                }
                .rustic-list-header > div:first-child {
                    flex: 1;
                    min-width: 0;
                }
                .rustic-list-header > div:nth-child(2) {
                    width: 100px;
                    text-align: right;
                    margin-right: 15px;
                }
                .rustic-list-header > div:last-child {
                    width: 100px;
                    text-align: right;
                }
            </style>
        `;
        $('head').append(styles);
    }

    const headerHtml = `
        <div class="rustic-list-header">
            <div>${__('Item')}</div>
            <div>${__('Stock')}</div>
            <div>${__('Price')}</div>
        </div>
    `;

    $itemsContainer.prepend(headerHtml);
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
            data-rate="${escape(price_list_rate || 0)}">
            <div class="rustic-item-name">${frappe.utils.escape_html(item_name || item_code)}</div>
            <div class="rustic-item-stock ${stockClass}">${flt(stockQty, 2)} ${frappe.utils.escape_html(stock_uom || '')}</div>
            <div class="rustic-item-price">${formattedPrice}</div>
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
 * Patch ItemCart to hide discount button and loyalty fields
 */
rustic_pos.patchItemCart = function() {
    if (!erpnext.PointOfSale || !erpnext.PointOfSale.ItemCart) {
        console.warn('Rustic POS: ItemCart not found');
        return;
    }

    const ItemCart = erpnext.PointOfSale.ItemCart.prototype;
    const originalMakeCartTotals = ItemCart.make_cart_totals_section;
    const originalRenderCustomerFields = ItemCart.render_customer_fields;

    ItemCart.make_cart_totals_section = function() {
        // Call original method
        originalMakeCartTotals.call(this);

        // Apply Rustic POS customizations
        rustic_pos.applyCartCustomizations(this);
    };

    // Patch render_customer_fields to hide loyalty and restrict to name/mobile/email
    ItemCart.render_customer_fields = function(customer_info) {
        // Call original method first
        originalRenderCustomerFields.call(this, customer_info);

        // Apply rustic customizations to customer fields
        rustic_pos.applyCustomerFieldsCustomizations(this);
    };
};

/**
 * Apply customizations to customer fields section
 */
rustic_pos.applyCustomerFieldsCustomizations = function(component) {
    rustic_pos.getRusticSettings(component, function(settings) {
        // Hide loyalty fields if setting is enabled
        if (settings.rustic_hide_loyalty) {
            // Hide loyalty_program field
            component.$customer_section.find('[data-fieldname="loyalty_program"]').closest('.frappe-control').hide();
            // Hide loyalty_points field
            component.$customer_section.find('[data-fieldname="loyalty_points"]').closest('.frappe-control').hide();
        }

        // Always restrict to only name, mobile, email for editing
        // Hide any other fields that may appear
        const allowedFields = ['email_id', 'mobile_no'];
        component.$customer_section.find('.frappe-control').each(function() {
            const $control = $(this);
            const fieldname = $control.find('[data-fieldname]').attr('data-fieldname');
            if (fieldname && !allowedFields.includes(fieldname)) {
                // Check if this is loyalty field (always hide if setting enabled)
                if (settings.rustic_hide_loyalty &&
                    (fieldname === 'loyalty_program' || fieldname === 'loyalty_points')) {
                    $control.hide();
                }
            }
        });
    });
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
                'rustic_item_view_mode',
                'rustic_hide_loyalty',
                'rustic_hide_item_group'
            ]
        },
        async: false,
        callback: function(r) {
            if (r.message) {
                rustic_pos.settings_cache = {
                    rustic_allow_warehouse_change: cint(r.message.rustic_allow_warehouse_change),
                    rustic_allow_discount_change: cint(r.message.rustic_allow_discount_change),
                    rustic_allow_uom_change: cint(r.message.rustic_allow_uom_change),
                    rustic_item_view_mode: r.message.rustic_item_view_mode || 'Grid',
                    rustic_hide_loyalty: cint(r.message.rustic_hide_loyalty),
                    rustic_hide_item_group: cint(r.message.rustic_hide_item_group)
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

        // Hide loyalty fields if setting is enabled
        if (settings.rustic_hide_loyalty) {
            rustic_pos.hideLoyaltyFields(component);
        }
    });
};

/**
 * Hide loyalty-related fields in customer section
 */
rustic_pos.hideLoyaltyFields = function(component) {
    // Hide loyalty program and loyalty points fields
    component.$component.find('[data-fieldname="loyalty_program"]').closest('.frappe-control').hide();
    component.$component.find('[data-fieldname="loyalty_points"]').closest('.frappe-control').hide();

    // Also try alternative selectors for customer info section
    component.$component.find('.loyalty_program-control').hide();
    component.$component.find('.loyalty_points-control').hide();
};

/**
 * Patch customer dialog to restrict fields to name, mobile, email
 */
rustic_pos.patchCustomerDialog = function() {
    // Override frappe.ui.form.make_quick_entry for Customer doctype
    const originalMakeQuickEntry = frappe.ui.form.make_quick_entry;

    frappe.ui.form.make_quick_entry = function(doctype, after_insert, init_callback, doc, force) {
        if (doctype === 'Customer') {
            // Check if we're in POS context
            if (window.cur_pos) {
                rustic_pos.makeSimpleCustomerDialog(after_insert, init_callback, doc);
                return;
            }
        }
        return originalMakeQuickEntry.call(this, doctype, after_insert, init_callback, doc, force);
    };

    // Also patch Link field's new_doc method for Customer
    if (frappe.ui.form.ControlLink) {
        const originalNewDoc = frappe.ui.form.ControlLink.prototype.new_doc;

        frappe.ui.form.ControlLink.prototype.new_doc = function() {
            if (this.df.options === 'Customer' && window.cur_pos) {
                rustic_pos.makeSimpleCustomerDialog((name) => {
                    this.set_value(name);
                });
                return;
            }
            return originalNewDoc.call(this);
        };
    }
};

/**
 * Create simplified customer dialog with only name, mobile, email
 */
rustic_pos.makeSimpleCustomerDialog = function(after_insert, init_callback, doc) {
    const d = new frappe.ui.Dialog({
        title: __('New Customer'),
        fields: [
            {
                fieldname: 'customer_name',
                fieldtype: 'Data',
                label: __('Customer Name'),
                reqd: 1
            },
            {
                fieldname: 'mobile_no',
                fieldtype: 'Data',
                label: __('Mobile Number')
            },
            {
                fieldname: 'email_id',
                fieldtype: 'Data',
                label: __('Email Address'),
                options: 'Email'
            }
        ],
        primary_action_label: __('Create'),
        primary_action: function(values) {
            frappe.call({
                method: 'frappe.client.insert',
                args: {
                    doc: {
                        doctype: 'Customer',
                        customer_name: values.customer_name,
                        customer_type: 'Individual',
                        mobile_no: values.mobile_no,
                        email_id: values.email_id
                    }
                },
                callback: function(r) {
                    if (r.message) {
                        d.hide();
                        frappe.show_alert({
                            message: __('Customer {0} created', [r.message.name]),
                            indicator: 'green'
                        });
                        if (after_insert) {
                            after_insert(r.message.name);
                        }
                    }
                }
            });
        }
    });

    if (init_callback) {
        init_callback(d);
    }

    d.show();
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
