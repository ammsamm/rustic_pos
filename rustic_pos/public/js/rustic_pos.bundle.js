/**
 * Rustic POS - ERPNext v15 POS Extension
 *
 * This bundle extends the standard ERPNext Point of Sale with:
 * - Configurable warehouse selector visibility
 * - Configurable discount controls visibility
 * - UOM toggle buttons for items with multiple UOMs
 */

frappe.provide('rustic_pos');

// Store original classes before overriding
rustic_pos.OriginalItemDetails = null;
rustic_pos.OriginalItemCart = null;

/**
 * Initialize Rustic POS overrides
 * Called when POS page loads
 */
rustic_pos.init = function() {
    if (!erpnext.PointOfSale) {
        console.warn('Rustic POS: ERPNext POS not loaded yet');
        return;
    }

    // Only initialize once
    if (rustic_pos.initialized) {
        return;
    }

    // Store original classes
    rustic_pos.OriginalItemDetails = erpnext.PointOfSale.ItemDetails;
    rustic_pos.OriginalItemCart = erpnext.PointOfSale.ItemCart;

    // Apply overrides
    rustic_pos.overrideItemDetails();
    rustic_pos.overrideItemCart();

    rustic_pos.initialized = true;
    console.log('Rustic POS: Initialized successfully');
};

/**
 * Override ItemDetails class to control UOM, discount, and warehouse visibility
 */
rustic_pos.overrideItemDetails = function() {
    const Original = rustic_pos.OriginalItemDetails;

    erpnext.PointOfSale.ItemDetails = class RusticItemDetails extends Original {
        constructor(wrapper) {
            super(wrapper);
        }

        render_form(item) {
            super.render_form(item);
            this.apply_rustic_restrictions(item);
        }

        /**
         * Apply visibility restrictions based on POS Profile settings
         */
        apply_rustic_restrictions(item) {
            const settings = this.settings || {};

            // Hide warehouse control if not allowed
            if (!settings.rustic_allow_warehouse_change) {
                this.hide_warehouse_control();
            }

            // Hide discount control if not allowed
            if (!settings.rustic_allow_discount_change) {
                this.hide_discount_control();
            }

            // Handle UOM display
            this.handle_uom_display(item, settings);
        }

        /**
         * Hide the warehouse selector control
         */
        hide_warehouse_control() {
            const $warehouse = this.$form_container.find('.warehouse-control');
            if ($warehouse.length) {
                $warehouse.hide();
            }
        }

        /**
         * Hide the discount percentage control
         */
        hide_discount_control() {
            const $discount = this.$form_container.find('.discount_percentage-control');
            if ($discount.length) {
                $discount.hide();
            }
        }

        /**
         * Handle UOM display based on settings and item configuration
         */
        handle_uom_display(item, settings) {
            const $uomControl = this.$form_container.find('.uom-control');

            if (!settings.rustic_allow_uom_change) {
                // Show UOM as read-only text
                this.render_uom_readonly(item);
                return;
            }

            // Check if item has multiple UOMs
            const itemUoms = this.get_item_uoms(item);

            if (itemUoms && itemUoms.length > 1) {
                // Replace dropdown with toggle buttons
                this.render_uom_toggle_buttons(item, itemUoms);
            }
            // If single UOM, keep the default display (will show as dropdown or text)
        }

        /**
         * Get available UOMs for an item
         */
        get_item_uoms(item) {
            // Try to get UOMs from item data
            if (item.uoms && item.uoms.length > 0) {
                return item.uoms;
            }

            // Fallback: fetch from server if not available
            // This will be populated when item is selected
            return null;
        }

        /**
         * Render UOM as read-only text (when allow_uom_change = 0)
         */
        render_uom_readonly(item) {
            const $uomControl = this.$form_container.find('.uom-control');

            if ($uomControl.length) {
                // Hide the original control
                $uomControl.hide();

                // Check if readonly element already exists
                if (!this.$form_container.find('.rustic-uom-readonly').length) {
                    // Create read-only display
                    const uomHtml = `
                        <div class="rustic-uom-readonly" style="
                            padding: 8px 0;
                            color: var(--text-color);
                            font-size: var(--text-md);
                        ">
                            <span class="rustic-uom-label" style="color: var(--text-muted);">
                                ${__('UOM')}:
                            </span>
                            <span class="rustic-uom-value" style="font-weight: 500; margin-left: 4px;">
                                ${item.uom || item.stock_uom || ''}
                            </span>
                        </div>
                    `;
                    $uomControl.after(uomHtml);
                } else {
                    // Update existing element
                    this.$form_container.find('.rustic-uom-value').text(item.uom || item.stock_uom || '');
                }
            }
        }

        /**
         * Render UOM toggle buttons for items with multiple UOMs
         */
        render_uom_toggle_buttons(item, uoms) {
            const $uomControl = this.$form_container.find('.uom-control');

            if (!$uomControl.length) return;

            // Hide the original dropdown
            $uomControl.hide();

            // Remove existing toggle buttons if any
            this.$form_container.find('.rustic-uom-toggle-container').remove();

            // Get current UOM
            const currentUom = item.uom || item.stock_uom;

            // Build toggle buttons HTML
            let buttonsHtml = '';
            uoms.forEach(uomRow => {
                const uomName = uomRow.uom;
                const isActive = uomName === currentUom;
                const conversionFactor = uomRow.conversion_factor || 1;

                buttonsHtml += `
                    <button type="button"
                        class="rustic-uom-btn ${isActive ? 'active' : ''}"
                        data-uom="${frappe.utils.escape_html(uomName)}"
                        data-conversion-factor="${conversionFactor}"
                        style="
                            padding: 6px 12px;
                            margin-right: 6px;
                            margin-bottom: 6px;
                            border: 1px solid var(--border-color);
                            border-radius: var(--border-radius);
                            background: ${isActive ? 'var(--primary)' : 'var(--bg-color)'};
                            color: ${isActive ? 'var(--primary-contrast)' : 'var(--text-color)'};
                            cursor: pointer;
                            font-size: var(--text-sm);
                            font-weight: 500;
                            transition: all 0.15s ease;
                        "
                    >
                        ${frappe.utils.escape_html(uomName)}
                    </button>
                `;
            });

            // Create container for toggle buttons
            const containerHtml = `
                <div class="rustic-uom-toggle-container" style="padding: 8px 0;">
                    <div class="rustic-uom-label" style="
                        color: var(--text-muted);
                        font-size: var(--text-sm);
                        margin-bottom: 6px;
                    ">
                        ${__('Unit of Measure')}
                    </div>
                    <div class="rustic-uom-buttons">
                        ${buttonsHtml}
                    </div>
                    <div class="rustic-uom-conversion-info" style="
                        color: var(--text-muted);
                        font-size: var(--text-xs);
                        margin-top: 4px;
                    "></div>
                </div>
            `;

            $uomControl.after(containerHtml);

            // Bind click handlers
            this.bind_uom_toggle_events(item, uoms);

            // Show conversion info for current UOM
            this.update_conversion_info(currentUom, uoms);
        }

        /**
         * Bind click events for UOM toggle buttons
         */
        bind_uom_toggle_events(item, uoms) {
            const me = this;
            const $container = this.$form_container.find('.rustic-uom-toggle-container');

            $container.find('.rustic-uom-btn').on('click', function() {
                const $btn = $(this);
                const newUom = $btn.data('uom');
                const conversionFactor = $btn.data('conversion-factor');

                // Update button states
                $container.find('.rustic-uom-btn').css({
                    'background': 'var(--bg-color)',
                    'color': 'var(--text-color)'
                }).removeClass('active');

                $btn.css({
                    'background': 'var(--primary)',
                    'color': 'var(--primary-contrast)'
                }).addClass('active');

                // Update UOM on the item
                me.events.form_updated(me.current_item, 'uom', newUom);

                // Update conversion factor
                if (me.conversion_factor_control) {
                    me.conversion_factor_control.set_value(conversionFactor);
                }

                // Update conversion info display
                me.update_conversion_info(newUom, uoms);
            });

            // Add hover effects
            $container.find('.rustic-uom-btn').hover(
                function() {
                    if (!$(this).hasClass('active')) {
                        $(this).css('background', 'var(--control-bg)');
                    }
                },
                function() {
                    if (!$(this).hasClass('active')) {
                        $(this).css('background', 'var(--bg-color)');
                    }
                }
            );
        }

        /**
         * Update the conversion info display
         */
        update_conversion_info(currentUom, uoms) {
            const $info = this.$form_container.find('.rustic-uom-conversion-info');

            if (!$info.length) return;

            const uomData = uoms.find(u => u.uom === currentUom);
            const stockUom = uoms.find(u => u.conversion_factor === 1)?.uom;

            if (uomData && uomData.conversion_factor !== 1 && stockUom) {
                $info.html(`1 ${frappe.utils.escape_html(currentUom)} = ${uomData.conversion_factor} ${frappe.utils.escape_html(stockUom)}`);
            } else {
                $info.html('');
            }
        }

        /**
         * Override toggle_item_details_section to re-apply restrictions
         */
        toggle_item_details_section(item) {
            super.toggle_item_details_section(item);

            // Re-fetch UOMs if needed and re-apply restrictions
            if (item && item.item_code) {
                this.fetch_and_apply_uoms(item);
            }
        }

        /**
         * Fetch UOMs for item and apply toggle buttons
         */
        fetch_and_apply_uoms(item) {
            const me = this;
            const settings = this.settings || {};

            // If UOM change not allowed, just render readonly
            if (!settings.rustic_allow_uom_change) {
                this.render_uom_readonly(item);
                return;
            }

            // If we already have UOMs, use them
            if (item.uoms && item.uoms.length > 1) {
                this.render_uom_toggle_buttons(item, item.uoms);
                return;
            }

            // Fetch UOMs from server
            frappe.call({
                method: 'frappe.client.get_value',
                args: {
                    doctype: 'Item',
                    filters: { name: item.item_code },
                    fieldname: ['uoms']
                },
                async: false,
                callback: function(r) {
                    if (r.message) {
                        // Fetch the child table data
                        frappe.call({
                            method: 'frappe.client.get_list',
                            args: {
                                doctype: 'UOM Conversion Detail',
                                filters: { parent: item.item_code },
                                fields: ['uom', 'conversion_factor'],
                                limit_page_length: 0
                            },
                            async: false,
                            callback: function(res) {
                                if (res.message && res.message.length > 1) {
                                    item.uoms = res.message;
                                    me.render_uom_toggle_buttons(item, res.message);
                                }
                            }
                        });
                    }
                }
            });
        }
    };
};

/**
 * Override ItemCart class to control cart-level discount visibility
 */
rustic_pos.overrideItemCart = function() {
    const Original = rustic_pos.OriginalItemCart;

    erpnext.PointOfSale.ItemCart = class RusticItemCart extends Original {
        constructor(wrapper) {
            super(wrapper);
        }

        make_cart_totals_section() {
            super.make_cart_totals_section();
            this.apply_rustic_cart_restrictions();
        }

        /**
         * Apply cart-level restrictions based on POS Profile settings
         */
        apply_rustic_cart_restrictions() {
            const settings = this.settings || {};

            // Hide cart-level discount if not allowed
            if (!settings.rustic_allow_discount_change) {
                this.hide_cart_discount();
            }
        }

        /**
         * Hide the cart-level "Add Discount" button
         */
        hide_cart_discount() {
            const $discountWrapper = this.$component.find('.add-discount-wrapper');
            if ($discountWrapper.length) {
                $discountWrapper.remove();
            }
        }
    };
};

/**
 * Hook into POS page load
 */
$(document).on('page-change', function() {
    if (frappe.get_route_str() === 'point-of-sale') {
        // Wait for POS to initialize
        const checkPOS = setInterval(function() {
            if (erpnext.PointOfSale && erpnext.PointOfSale.ItemDetails && erpnext.PointOfSale.ItemCart) {
                clearInterval(checkPOS);
                rustic_pos.init();
            }
        }, 100);

        // Timeout after 10 seconds
        setTimeout(function() {
            clearInterval(checkPOS);
        }, 10000);
    }
});

// Also try to initialize on DOMContentLoaded
$(document).ready(function() {
    if (frappe.get_route_str() === 'point-of-sale') {
        setTimeout(function() {
            rustic_pos.init();
        }, 500);
    }
});
