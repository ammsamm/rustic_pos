/**
 * Rustic POS - ERPNext v15 POS Extension
 *
 * Extends the standard ERPNext Point of Sale with:
 * - Configurable discount controls visibility
 * - UOM toggle buttons for items with multiple UOMs
 * - Hide loyalty section option
 * - Hide item group filter option
 * - Simplified customer form (name, mobile, email only)
 */

frappe.provide('rustic_pos');

rustic_pos.initialized = false;
rustic_pos.prototypesPatched = false;
rustic_pos.settingsLoaded = false;

/**
 * Clean up dynamic styles from previous session
 */
rustic_pos.cleanupStyles = function() {
    $('#rustic-hide-item-group-styles').remove();
    $('#rustic-hide-loyalty-styles').remove();
    $('#rustic-hide-form-view-styles').remove();
    $('#rustic-list-styles').remove();
};

/**
 * Pre-load settings before POS initializes (called early)
 */
rustic_pos.preloadSettings = function(posProfile) {
    if (!posProfile || rustic_pos.settingsLoaded) return;

    frappe.call({
        method: 'frappe.client.get_value',
        args: {
            doctype: 'POS Profile',
            filters: { name: posProfile },
            fieldname: [
                'rustic_allow_discount_change',
                'rustic_allow_uom_change',
                'rustic_item_view_mode',
                'rustic_hide_loyalty',
                'rustic_hide_item_group',
                'rustic_hide_warehouse',
                'rustic_hide_form_view'
            ]
        },
        async: false,
        callback: function(r) {
            if (r.message) {
                rustic_pos.settings_cache = {
                    rustic_allow_discount_change: cint(r.message.rustic_allow_discount_change),
                    rustic_allow_uom_change: cint(r.message.rustic_allow_uom_change),
                    rustic_item_view_mode: r.message.rustic_item_view_mode || 'Grid',
                    rustic_hide_loyalty: cint(r.message.rustic_hide_loyalty),
                    rustic_hide_item_group: cint(r.message.rustic_hide_item_group),
                    rustic_hide_warehouse: cint(r.message.rustic_hide_warehouse),
                    rustic_hide_form_view: cint(r.message.rustic_hide_form_view)
                };
                rustic_pos.view_mode = rustic_pos.settings_cache.rustic_item_view_mode;
                rustic_pos.hide_loyalty = rustic_pos.settings_cache.rustic_hide_loyalty;
                rustic_pos.hide_item_group = rustic_pos.settings_cache.rustic_hide_item_group;
                rustic_pos.hide_form_view = rustic_pos.settings_cache.rustic_hide_form_view;
                rustic_pos.settingsLoaded = true;

                // Inject CSS immediately based on settings
                rustic_pos.injectPersistentStyles();
            }
        }
    });
};

/**
 * Inject CSS styles immediately based on settings
 */
rustic_pos.injectPersistentStyles = function() {
    if (!rustic_pos.settings_cache) return;

    // Inject hide styles immediately so elements are hidden from first render
    if (rustic_pos.settings_cache.rustic_hide_item_group && !$('#rustic-hide-item-group-styles').length) {
        $('head').append(`
            <style id="rustic-hide-item-group-styles">
                .point-of-sale-app .item-group-field,
                .point-of-sale-app [data-fieldname="item_group"],
                .point-of-sale-app .frappe-control[data-fieldname="item_group"],
                .point-of-sale-app .item-group-filter {
                    display: none !important;
                }
            </style>
        `);
    }

    if (rustic_pos.settings_cache.rustic_hide_loyalty && !$('#rustic-hide-loyalty-styles').length) {
        $('head').append(`
            <style id="rustic-hide-loyalty-styles">
                .point-of-sale-app [data-fieldname="loyalty_program"],
                .point-of-sale-app [data-fieldname="loyalty_points"],
                .point-of-sale-app .loyalty_program-control,
                .point-of-sale-app .loyalty_points-control {
                    display: none !important;
                }
            </style>
        `);
    }

    if (rustic_pos.settings_cache.rustic_hide_form_view && !$('#rustic-hide-form-view-styles').length) {
        $('head').append(`
            <style id="rustic-hide-form-view-styles">
                .point-of-sale-app .new-pos-invoice,
                .point-of-sale-app [data-name="new-pos-invoice"],
                .point-of-sale-app a[href*="new-pos-invoice"],
                .point-of-sale-app .open-form-view-btn,
                .point-of-sale-app [data-action="open_form_view"],
                .point-of-sale-app .edit-cart-btn,
                .point-of-sale-app .btn-open-form {
                    display: none !important;
                }
            </style>
        `);
    }

    if (!rustic_pos.settings_cache.rustic_allow_discount_change && !$('#rustic-hide-discount-styles').length) {
        $('head').append(`
            <style id="rustic-hide-discount-styles">
                .point-of-sale-app .add-discount-wrapper,
                .point-of-sale-app .discount_percentage-control {
                    display: none !important;
                }
            </style>
        `);
    }

    // Always inject list view styles (they only apply when class is added)
    if (!$('#rustic-list-styles').length) {
        $('head').append(`
            <style id="rustic-list-styles">
                .rustic-list-view .rustic-list-item {
                    display: flex !important;
                    align-items: center;
                    padding: 8px;
                    border-bottom: 1px solid var(--border-color);
                    cursor: pointer;
                    background: var(--bg-color);
                }
                .rustic-list-view .rustic-list-item:hover {
                    background: var(--subtle-fg) !important;
                }
                .rustic-list-view .rustic-item-name {
                    flex: 1;
                    font-weight: 500;
                    white-space: nowrap;
                    overflow: hidden;
                    text-overflow: ellipsis;
                    padding-right: 8px;
                }
                .rustic-list-view .rustic-item-stock {
                    width: 50px;
                    text-align: right;
                    padding-right: 8px;
                }
                .rustic-list-view .rustic-item-price {
                    width: 65px;
                    text-align: right;
                    font-weight: 600;
                }
                .rustic-list-header {
                    display: flex !important;
                    align-items: center;
                    padding: 8px;
                    background: var(--subtle-fg);
                    border-bottom: 2px solid var(--border-color);
                    font-weight: 600;
                    position: sticky;
                    top: 0;
                    z-index: 1;
                }
                .rustic-list-header > div:first-child {
                    flex: 1;
                }
                .rustic-list-header > div:nth-child(2) {
                    width: 50px;
                    text-align: right;
                    padding-right: 8px;
                }
                .rustic-list-header > div:last-child {
                    width: 65px;
                    text-align: right;
                }
            </style>
        `);
    }
};

/**
 * Initialize Rustic POS - patches prototypes before components are created
 */
rustic_pos.init = function() {
    // Patch prototypes ONCE - must happen before POS components are instantiated
    if (!rustic_pos.prototypesPatched) {
        rustic_pos.patchItemSelector();
        rustic_pos.patchItemDetails();
        rustic_pos.patchItemCart();
        rustic_pos.patchCustomerDialog();
        rustic_pos.prototypesPatched = true;
    }

    rustic_pos.initialized = true;
};

/**
 * Apply customizations after POS is ready
 */
rustic_pos.onPOSReady = function() {
    if (!window.cur_pos) return;

    // Apply view mode
    if (window.cur_pos.item_selector) {
        rustic_pos.applyViewMode(window.cur_pos.item_selector);
        if (rustic_pos.hide_item_group) {
            rustic_pos.hideItemGroupFilter(window.cur_pos.item_selector);
        }
    }

    // Apply cart customizations
    if (window.cur_pos.cart) {
        rustic_pos.applyCartCustomizations(window.cur_pos.cart);
    }

    // Hide form view button
    if (rustic_pos.hide_form_view) {
        rustic_pos.hideFormViewButton();
    }

    // Start observing for dynamic changes
    rustic_pos.observePOSChanges();
};

/**
 * Initialize view mode for ItemSelector (settings should already be loaded)
 */
rustic_pos.initViewMode = function() {
    if (!window.cur_pos || !window.cur_pos.item_selector) return;

    const component = window.cur_pos.item_selector;

    // Apply view mode
    rustic_pos.applyViewMode(component);

    // Trigger refresh to re-render items with correct view
    if (component.search_field) {
        const searchTerm = component.$component.find('.search-field input').val() || '';
        component.search_field.set_value(searchTerm);
    }
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
 * Hide item group filter only (not the search box)
 */
rustic_pos.hideItemGroupFilter = function(component) {
    if (!component || !component.$component) return;

    // Only hide the item group field/dropdown, NOT the search field
    component.$component.find('.item-group-field').hide();
    component.$component.find('[data-fieldname="item_group"]').closest('.frappe-control').hide();

    // Hide item group specific elements
    component.$component.find('.item-group-filter').hide();

    // Try to find and hide the item group Link field specifically
    component.$component.find('.frappe-control[data-fieldname="item_group"]').hide();

    // Also hide via CSS class for persistence
    if (!$('#rustic-hide-item-group-styles').length) {
        $('head').append(`
            <style id="rustic-hide-item-group-styles">
                .point-of-sale-app .item-group-field,
                .point-of-sale-app [data-fieldname="item_group"],
                .point-of-sale-app .item-group-filter {
                    display: none !important;
                }
            </style>
        `);
    }
};

/**
 * Apply view mode class to items container
 */
rustic_pos.applyViewMode = function(component) {
    if (!component || !component.$component) return;

    const $itemsContainer = component.$component.find('.items-container');
    if (!$itemsContainer.length) return;

    // Get the item selector wrapper for fixed width
    const $selectorWrapper = component.$component.closest('.item-selector-wrapper');

    // Remove existing table header
    component.$component.find('.rustic-list-header').remove();

    if (rustic_pos.isListViewActive()) {
        $itemsContainer.addClass('rustic-list-view');
        if ($selectorWrapper.length) {
            $selectorWrapper.addClass('rustic-list-active');
        }
        // Override grid layout to single column
        $itemsContainer.css({
            'display': 'block',
            'grid-template-columns': 'unset'
        });
        // Add table header
        rustic_pos.addListHeader(component);
    } else {
        $itemsContainer.removeClass('rustic-list-view');
        if ($selectorWrapper.length) {
            $selectorWrapper.removeClass('rustic-list-active');
        }
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
    if (!component || !component.$component) return;

    const $itemsContainer = component.$component.find('.items-container');
    if (!$itemsContainer.length) return;

    // Ensure CSS is injected (in case it wasn't already)
    rustic_pos.injectPersistentStyles();

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

    // Determine stock indicator color
    let stockClass = '';
    let stockQty = actual_qty || 0;
    if (is_stock_item) {
        if (stockQty > 10) stockClass = 'text-success';
        else if (stockQty > 0) stockClass = 'text-warning';
        else stockClass = 'text-danger';
    }

    // Format price with currency symbol
    const formattedPrice = format_currency(price_list_rate, me.currency);

    return `
        <div class="item-wrapper rustic-list-item"
            data-item-code="${escape(item_code)}"
            data-serial-no="${escape(item.serial_no || '')}"
            data-batch-no="${escape(item.batch_no || '')}"
            data-uom="${escape(stock_uom || '')}"
            data-rate="${escape(price_list_rate || 0)}">
            <div class="rustic-item-name">${frappe.utils.escape_html(item_name || item_code)}</div>
            <div class="rustic-item-stock ${stockClass}">${flt(stockQty, 2)}</div>
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
    if (!component || !component.$form_container) return;
    if (!item) return;

    // Fetch rustic settings directly from POS Profile
    rustic_pos.getRusticSettings(component, function(settings) {
        // Hide warehouse selector if setting enabled
        if (settings.rustic_hide_warehouse) {
            component.$form_container.find('.warehouse-control').hide();
            component.$form_container.find('[data-fieldname="warehouse"]').closest('.frappe-control').hide();
        }

        // Hide discount if not allowed
        if (!settings.rustic_allow_discount_change) {
            component.$form_container.find('.discount_percentage-control').hide();
        }

        // Hide Open Form View button if setting enabled
        if (settings.rustic_hide_form_view) {
            rustic_pos.hideFormViewButton(component);
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
 * Hide Open Form View button in POS
 */
rustic_pos.hideFormViewButton = function(component) {
    // Hide in item details component
    if (component && component.$component) {
        component.$component.find('.open-form-view-btn').hide();
        component.$component.find('[data-action="open_form_view"]').hide();
        component.$component.find('.edit-cart-btn').hide();
    }

    // Hide the new-pos-invoice button (Open Form View)
    $('.point-of-sale-app .new-pos-invoice').hide();
    $('.point-of-sale-app [data-name="new-pos-invoice"]').hide();
    $('.point-of-sale-app a[href*="new-pos-invoice"]').hide();

    // Hide globally in POS
    $('.point-of-sale-app .open-form-view-btn').hide();
    $('.point-of-sale-app [data-action="open_form_view"]').hide();
    $('.point-of-sale-app .btn-open-form').hide();

    // Hide any menu items containing "Open Form View" or "Edit Full Form"
    $('.point-of-sale-app .dropdown-item:contains("Form View")').hide();
    $('.point-of-sale-app .dropdown-item:contains("Edit Full")').hide();
    $('.point-of-sale-app a:contains("Open Form View")').hide();

    // Add CSS to ensure it stays hidden
    if (!$('#rustic-hide-form-view-styles').length) {
        $('head').append(`
            <style id="rustic-hide-form-view-styles">
                .point-of-sale-app .new-pos-invoice,
                .point-of-sale-app [data-name="new-pos-invoice"],
                .point-of-sale-app a[href*="new-pos-invoice"] {
                    display: none !important;
                }
            </style>
        `);
    }
};

/**
 * Get Rustic POS settings (from cache or fetch if needed)
 */
rustic_pos.getRusticSettings = function(component, callback) {
    // Return cached settings if available
    if (rustic_pos.settings_cache) {
        callback(rustic_pos.settings_cache);
        return;
    }

    // Fallback: fetch settings if not pre-loaded
    let posProfile = null;
    if (component && component.settings && component.settings.name) {
        posProfile = component.settings.name;
    } else if (window.cur_pos && window.cur_pos.pos_profile) {
        posProfile = window.cur_pos.pos_profile;
    }

    if (!posProfile) {
        // Return defaults if no profile
        callback({
            rustic_allow_discount_change: 1,
            rustic_allow_uom_change: 1,
            rustic_item_view_mode: 'Grid',
            rustic_hide_loyalty: 0,
            rustic_hide_item_group: 0,
            rustic_hide_warehouse: 0,
            rustic_hide_form_view: 0
        });
        return;
    }

    // Fetch and cache
    rustic_pos.preloadSettings(posProfile);
    callback(rustic_pos.settings_cache || {});
};

/**
 * Apply customizations to ItemCart
 */
rustic_pos.applyCartCustomizations = function(component) {
    if (!component || !component.$component) return;

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
    if (!component || !component.$component) return;

    // Hide loyalty program and loyalty points fields
    component.$component.find('[data-fieldname="loyalty_program"]').closest('.frappe-control').hide();
    component.$component.find('[data-fieldname="loyalty_points"]').closest('.frappe-control').hide();

    // Also try alternative selectors for customer info section
    component.$component.find('.loyalty_program-control').hide();
    component.$component.find('.loyalty_points-control').hide();

    // Add CSS for persistence
    if (!$('#rustic-hide-loyalty-styles').length) {
        $('head').append(`
            <style id="rustic-hide-loyalty-styles">
                .point-of-sale-app [data-fieldname="loyalty_program"],
                .point-of-sale-app [data-fieldname="loyalty_points"],
                .point-of-sale-app .loyalty_program-control,
                .point-of-sale-app .loyalty_points-control {
                    display: none !important;
                }
            </style>
        `);
    }
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
            if (r.message && r.message.uoms && r.message.uoms.length >= 1) {
                // Always show toggle buttons for items with UOMs configured
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
 * Observe POS DOM changes to reapply customizations (minimal, CSS handles most)
 */
rustic_pos.observePOSChanges = function() {
    if (rustic_pos.observer) {
        rustic_pos.observer.disconnect();
    }

    const posApp = document.querySelector('.point-of-sale-app');
    if (!posApp) return;

    rustic_pos.observer = new MutationObserver(function(mutations) {
        if (rustic_pos.observerTimeout) {
            clearTimeout(rustic_pos.observerTimeout);
        }
        rustic_pos.observerTimeout = setTimeout(function() {
            // Only handle things CSS can't handle (like view mode toggle)
            if (window.cur_pos && window.cur_pos.item_selector) {
                rustic_pos.applyViewMode(window.cur_pos.item_selector);
            }
        }, 100);
    });

    rustic_pos.observer.observe(posApp, {
        childList: true,
        subtree: true
    });
};

/**
 * Reset state when leaving POS
 */
rustic_pos.cleanup = function() {
    if (rustic_pos.observer) {
        rustic_pos.observer.disconnect();
        rustic_pos.observer = null;
    }
    rustic_pos.cleanupStyles();
    $('#rustic-hide-discount-styles').remove();
    rustic_pos.settings_cache = null;
    rustic_pos.settingsLoaded = false;
    rustic_pos.initialized = false;
};

/**
 * Main entry point - hooks into POS page lifecycle
 */
$(document).on('page-change', function() {
    if (frappe.get_route_str() === 'point-of-sale') {
        rustic_pos.cleanup();
        rustic_pos.startInitialization();
    } else {
        rustic_pos.cleanup();
    }
});

// Handle direct page load
$(document).ready(function() {
    if (frappe.get_route_str() === 'point-of-sale') {
        rustic_pos.startInitialization();
    }
});

/**
 * Start initialization process
 */
rustic_pos.startInitialization = function() {
    // Step 1: Wait for POS classes to be defined, then patch prototypes
    rustic_pos.waitForPOSClasses(function() {
        // Patch prototypes BEFORE components are created
        rustic_pos.init();

        // Step 2: Wait for POS profile to be available, then preload settings
        rustic_pos.waitForPOSProfile(function(posProfile) {
            rustic_pos.preloadSettings(posProfile);

            // Step 3: Wait for cur_pos to be ready, then apply customizations
            rustic_pos.waitForCurPOS(function() {
                rustic_pos.onPOSReady();
            });
        });
    });
};

/**
 * Wait for POS classes to be defined
 */
rustic_pos.waitForPOSClasses = function(callback) {
    if (erpnext.PointOfSale && erpnext.PointOfSale.ItemDetails && erpnext.PointOfSale.ItemCart) {
        callback();
        return;
    }

    let attempts = 0;
    const interval = setInterval(function() {
        attempts++;
        if (erpnext.PointOfSale && erpnext.PointOfSale.ItemDetails && erpnext.PointOfSale.ItemCart) {
            clearInterval(interval);
            callback();
        }
        if (attempts >= 100) {
            clearInterval(interval);
            console.warn('Rustic POS: Timeout waiting for POS classes');
        }
    }, 50);
};

/**
 * Wait for POS profile to be available
 */
rustic_pos.waitForPOSProfile = function(callback) {
    // Check if already available
    if (window.cur_pos && window.cur_pos.pos_profile) {
        callback(window.cur_pos.pos_profile);
        return;
    }

    // Try to get from page data or URL
    let attempts = 0;
    const interval = setInterval(function() {
        attempts++;
        if (window.cur_pos && window.cur_pos.pos_profile) {
            clearInterval(interval);
            callback(window.cur_pos.pos_profile);
        }
        if (attempts >= 100) {
            clearInterval(interval);
            // Fallback: try to get from localStorage or default
            const lastProfile = localStorage.getItem('lastPOSProfile');
            if (lastProfile) {
                callback(lastProfile);
            }
        }
    }, 50);
};

/**
 * Wait for cur_pos to be fully initialized
 */
rustic_pos.waitForCurPOS = function(callback) {
    if (window.cur_pos && window.cur_pos.item_selector && window.cur_pos.cart) {
        callback();
        return;
    }

    let attempts = 0;
    const interval = setInterval(function() {
        attempts++;
        if (window.cur_pos && window.cur_pos.item_selector && window.cur_pos.cart) {
            clearInterval(interval);
            callback();
        }
        if (attempts >= 100) {
            clearInterval(interval);
        }
    }, 50);
};

/**
 * Force refresh all customizations (can be called manually)
 */
rustic_pos.refresh = function() {
    rustic_pos.settings_cache = null;
    rustic_pos.settingsLoaded = false;
    if (window.cur_pos && window.cur_pos.pos_profile) {
        rustic_pos.preloadSettings(window.cur_pos.pos_profile);
        rustic_pos.onPOSReady();
    }
};
