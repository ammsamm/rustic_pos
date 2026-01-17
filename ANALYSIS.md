# ERPNext v15 POS Analysis for rustic_pos

## Executive Summary

This document analyzes the ERPNext v15 Point of Sale (POS) implementation to determine the optimal extension strategy for the `rustic_pos` custom app.

**Critical Discovery:** ERPNext v15 POS does **NOT** use Vue 3 as originally assumed. It uses traditional Frappe JavaScript with ES6 classes and jQuery. This fundamentally changes our extension approach.

---

## 1. File Structure Map

### Location: `erpnext/selling/page/point_of_sale/`

| File | Purpose |
|------|---------|
| `__init__.py` | Python package initialization |
| `point_of_sale.py` | Backend API endpoints (whitelisted methods) |
| `point_of_sale.json` | Page metadata/configuration |
| `point_of_sale.js` | Page entry point - initializes Controller |
| `pos_controller.js` | **Core controller** - orchestrates all components, manages state |
| `pos_item_cart.js` | Shopping cart UI, customer selection, cart-level discounts |
| `pos_item_details.js` | **Item editing panel** - UOM, discount, warehouse, qty, rate |
| `pos_item_selector.js` | Item grid/search interface |
| `pos_number_pad.js` | Numeric input pad component |
| `pos_past_order_list.js` | Historical orders list |
| `pos_past_order_summary.js` | Order detail view |
| `pos_payment.js` | Payment processing UI |

---

## 2. Component Hierarchy

```
frappe.pages["point-of-sale"].on_page_load
    │
    └── erpnext.PointOfSale.Controller (pos_controller.js)
            │
            ├── erpnext.PointOfSale.ItemSelector (pos_item_selector.js)
            │       └── Item grid with search/filter
            │
            ├── erpnext.PointOfSale.ItemDetails (pos_item_details.js)
            │       └── Form controls: qty, uom, rate, discount, warehouse
            │
            ├── erpnext.PointOfSale.ItemCart (pos_item_cart.js)
            │       ├── Customer section
            │       ├── Cart items list
            │       ├── Cart-level discount (Add Discount button)
            │       └── Totals section
            │
            ├── erpnext.PointOfSale.Payment (pos_payment.js)
            │       └── Payment methods and processing
            │
            ├── erpnext.PointOfSale.PastOrderList (pos_past_order_list.js)
            │       └── Order history listing
            │
            └── erpnext.PointOfSale.PastOrderSummary (pos_past_order_summary.js)
                    └── Individual order details
```

---

## 3. Data Flow: POS Profile Settings

### Backend → Frontend Flow

```
┌─────────────────────────────────────────────────────────────────────┐
│ BACKEND                                                              │
├─────────────────────────────────────────────────────────────────────┤
│ point_of_sale.py                                                     │
│                                                                      │
│ @frappe.whitelist()                                                  │
│ def get_pos_profile_data(pos_profile):                              │
│     pos_profile = frappe.get_doc("POS Profile", pos_profile)        │
│     pos_profile = pos_profile.as_dict()  ← ALL fields returned      │
│     # ... expands customer_groups ...                                │
│     return pos_profile                                               │
└─────────────────────────────────────────────────────────────────────┘
                                    │
                                    ▼
┌─────────────────────────────────────────────────────────────────────┐
│ FRONTEND - pos_controller.js                                         │
├─────────────────────────────────────────────────────────────────────┤
│ async prepare_app_defaults(data) {                                   │
│     this.settings = {};                                              │
│                                                                      │
│     frappe.call({                                                    │
│         method: "...get_pos_profile_data",                          │
│         args: { pos_profile: this.pos_profile },                    │
│         callback: (res) => {                                         │
│             Object.assign(this.settings, res.message);  ← MERGED    │
│             this.make_app();                                         │
│         }                                                            │
│     });                                                              │
│ }                                                                    │
└─────────────────────────────────────────────────────────────────────┘
                                    │
                                    ▼
┌─────────────────────────────────────────────────────────────────────┐
│ COMPONENTS                                                           │
├─────────────────────────────────────────────────────────────────────┤
│ init_item_details() {                                                │
│     this.item_details = new erpnext.PointOfSale.ItemDetails({       │
│         settings: this.settings,  ← PASSED TO COMPONENT             │
│         events: { ... }                                              │
│     });                                                              │
│ }                                                                    │
│                                                                      │
│ // Same pattern for ItemCart, ItemSelector, Payment, etc.           │
└─────────────────────────────────────────────────────────────────────┘
```

### Key Insight
Custom fields added to POS Profile will automatically be available in `this.settings` on all components, with no backend changes required.

---

## 4. Extension Points Identified

### 4.1 Page-Level Extension (Recommended)

**Method:** `page_js` hook in `hooks.py`

```python
# rustic_pos/hooks.py
page_js = {
    "point-of-sale": "public/js/rustic_pos.js"
}
```

This injects our JS after the POS loads, allowing us to monkey-patch classes.

### 4.2 Class Prototype Override

Since POS components are ES6 classes on `erpnext.PointOfSale` namespace:

```javascript
// Override specific methods
const OriginalItemDetails = erpnext.PointOfSale.ItemDetails;

erpnext.PointOfSale.ItemDetails = class extends OriginalItemDetails {
    render_form(item) {
        super.render_form(item);
        this.apply_rustic_pos_restrictions();
    }

    apply_rustic_pos_restrictions() {
        // Custom logic here
    }
};
```

### 4.3 Event Callbacks

Components accept `events` object for callbacks:
- `form_updated(item, fieldname, value)` - Item field changes
- `item_selected(item_data)` - Item added to cart
- `cart_item_clicked(item)` - Cart item selected
- `checkout()` - Checkout initiated

### 4.4 Post-Initialization Hook

```javascript
// Wait for POS to initialize, then modify
frappe.pages["point-of-sale"].on_page_show = function(wrapper) {
    if (wrapper.pos) {
        // Access controller and components
        wrapper.pos.item_details  // ItemDetails instance
        wrapper.pos.cart          // ItemCart instance
    }
};
```

---

## 5. UOM Implementation Details

### Current Location: `pos_item_details.js`

**Form Fields Array:**
```javascript
get_form_fields(item) {
    const fields = [
        "qty", "uom", "rate", "conversion_factor",
        "discount_percentage", "warehouse", "actual_qty", "price_list_rate"
    ];
    // + serial_no, batch_no if applicable
    return fields;
}
```

**UOM Control Creation:**
```javascript
// In render_form()
this.uom_control = frappe.ui.form.make_control({
    df: {
        ...field_meta,  // From POS Invoice Item doctype
        onchange: function() {
            me.events.form_updated(me.current_item, "uom", this.value);
        }
    },
    parent: this.$form_container.find('.uom-control'),
    render_input: true
});
```

**UOM Change Handler:**
```javascript
// In bind_custom_control_change_event()
this.uom_control.df.onchange = function() {
    me.events.form_updated(me.current_item, "uom", this.value);
    const item_row = frappe.get_doc(me.doctype, me.name);
    me.conversion_factor_control.df.read_only = item_row.stock_uom == this.value;
    me.conversion_factor_control.refresh();
};

this.uom_control.df.get_query = () => ({
    query: "erpnext.controllers.queries.get_item_uom_query",
    filters: { item_code: me.current_item.item_code }
});
```

### Override Strategy for UOM Toggle Buttons

1. Override `render_form()` method
2. After calling `super.render_form(item)`, check:
   - `this.settings.allow_uom_change` (custom field)
   - `item.uoms` array length (multiple UOMs?)
3. If allowed AND multiple UOMs:
   - Hide native `uom_control`
   - Inject custom toggle button HTML
   - Wire up click handlers to call `form_updated()`

---

## 6. Discount UI Location

### Item-Level Discount: `pos_item_details.js`

**Control:** `discount_percentage_control`

```javascript
// Current behavior in bind_custom_control_change_event()
if (this.discount_percentage_control && !this.allow_discount_change) {
    this.discount_percentage_control.df.read_only = 1;
    this.discount_percentage_control.refresh();
}
```

**Override Strategy:**
```javascript
// Check our custom field
if (!this.settings.allow_discount_change) {
    // Remove the control entirely from DOM
    this.$form_container.find('.discount_percentage-control').remove();
}
```

### Cart-Level Discount: `pos_item_cart.js`

**Element:** `.add-discount-wrapper`

**Structure:**
```javascript
make_cart_totals_section() {
    this.$totals_section.append(`
        <div class="add-discount-wrapper">
            ${this.get_discount_icon()} ${__("Add Discount")}
        </div>
        // ... totals, checkout button, etc.
    `);
    this.$add_discount_elem = this.$component.find(".add-discount-wrapper");
}
```

**Override Strategy:**
```javascript
// In overridden make_cart_totals_section or post-init
if (!this.settings.allow_discount_change) {
    this.$component.find('.add-discount-wrapper').remove();
}
```

---

## 7. Warehouse UI Location

### Location: `pos_item_details.js`

**Control:** `warehouse_control`

```javascript
// In bind_custom_control_change_event()
if (this.warehouse_control) {
    this.warehouse_control.df.reqd = 1;
    this.warehouse_control.df.onchange = function() {
        // Stock validation logic
        me.events.form_updated(me.current_item, "warehouse", this.value);
        // ... availability checks ...
    };
    this.warehouse_control.df.get_query = () => ({
        filters: { company: this.events.get_frm().doc.company, is_group: 0 }
    });
}
```

**Override Strategy:**
```javascript
if (!this.settings.allow_warehouse_change) {
    // Remove from form fields list OR
    this.$form_container.find('.warehouse-control').remove();
    // Keep actual_qty display as read-only reference
}
```

---

## 8. Proposed Override Strategy

### 8.1 App Structure

```
rustic_pos/
├── rustic_pos/
│   ├── __init__.py
│   ├── hooks.py
│   ├── fixtures/
│   │   └── rustic_pos_fields.json     # POS Profile custom fields
│   └── public/
│       └── js/
│           ├── rustic_pos.bundle.js   # Main entry point
│           ├── pos_item_details.js    # ItemDetails override
│           └── pos_item_cart.js       # ItemCart override
├── setup.py
└── ...
```

### 8.2 hooks.py Configuration

```python
app_name = "rustic_pos"
app_title = "Rustic POS"
app_publisher = "Your Company"
app_description = "POS customizations for ERPNext v15"
app_version = "0.0.1"

# Fixtures for custom fields
fixtures = [
    {
        "doctype": "Custom Field",
        "filters": [["dt", "=", "POS Profile"], ["module", "=", "Rustic POS"]]
    }
]

# Inject JS into POS page
page_js = {
    "point-of-sale": "public/js/rustic_pos.bundle.js"
}
```

### 8.3 Custom Fields (fixtures/rustic_pos_fields.json)

```json
[
    {
        "doctype": "Custom Field",
        "dt": "POS Profile",
        "fieldname": "allow_warehouse_change",
        "fieldtype": "Check",
        "label": "Allow Warehouse Change",
        "insert_after": "warehouse",
        "default": "1",
        "module": "Rustic POS"
    },
    {
        "doctype": "Custom Field",
        "dt": "POS Profile",
        "fieldname": "allow_discount_change",
        "fieldtype": "Check",
        "label": "Allow Discount Change",
        "insert_after": "allow_warehouse_change",
        "default": "1",
        "module": "Rustic POS"
    },
    {
        "doctype": "Custom Field",
        "dt": "POS Profile",
        "fieldname": "allow_uom_change",
        "fieldtype": "Check",
        "label": "Allow UOM Change",
        "insert_after": "allow_discount_change",
        "default": "1",
        "module": "Rustic POS"
    }
]
```

### 8.4 JavaScript Override Pattern

```javascript
// rustic_pos/public/js/rustic_pos.bundle.js

frappe.provide('rustic_pos');

// Wait for POS components to be defined
$(document).ready(function() {
    // Store original classes
    const OriginalItemDetails = erpnext.PointOfSale.ItemDetails;
    const OriginalItemCart = erpnext.PointOfSale.ItemCart;

    // Extended ItemDetails
    erpnext.PointOfSale.ItemDetails = class extends OriginalItemDetails {
        render_form(item) {
            super.render_form(item);
            this.apply_rustic_pos_restrictions(item);
        }

        apply_rustic_pos_restrictions(item) {
            // Warehouse control
            if (!this.settings.allow_warehouse_change) {
                this.$form_container.find('.warehouse-control').hide();
            }

            // Discount control
            if (!this.settings.allow_discount_change) {
                this.$form_container.find('.discount_percentage-control').hide();
            }

            // UOM control - replace with toggle buttons
            if (this.settings.allow_uom_change && item.uoms && item.uoms.length > 1) {
                this.render_uom_toggle_buttons(item);
            } else if (!this.settings.allow_uom_change) {
                // Show as read-only text
                this.$form_container.find('.uom-control').hide();
                this.render_uom_readonly(item);
            }
        }

        render_uom_toggle_buttons(item) {
            // Implementation for toggle buttons
        }

        render_uom_readonly(item) {
            // Show UOM as non-interactive text
        }
    };

    // Extended ItemCart
    erpnext.PointOfSale.ItemCart = class extends OriginalItemCart {
        make_cart_totals_section() {
            super.make_cart_totals_section();

            if (!this.settings.allow_discount_change) {
                this.$component.find('.add-discount-wrapper').remove();
            }
        }
    };
});
```

---

## 9. Technical Considerations

### 9.1 Architecture Correction

| Original Assumption | Actual Implementation |
|---------------------|----------------------|
| Vue 3 Composition API | ES6 Classes + jQuery |
| Pinia/reactive store | Object properties (`this.settings`) |
| Vue's `extends` | Class inheritance / prototype override |
| `v-if` directives | jQuery `.hide()` / `.remove()` |
| `.vue` component files | `.js` class files |

### 9.2 Bundle Loading Order

1. ERPNext bundles load first (including POS classes)
2. `page_js` scripts load when page is accessed
3. Our override must execute after classes are defined

### 9.3 Settings Availability

Custom fields on POS Profile are automatically available because:
- `get_pos_profile_data()` calls `.as_dict()` on the full document
- All fields (standard + custom) are included
- Controller stores this in `this.settings`
- Components receive `settings` in constructor

### 9.4 DOM Manipulation vs Class Override

**Recommended: Class Override**
- Cleaner, more maintainable
- Works with Frappe's control lifecycle
- Less prone to timing issues

**Fallback: Post-render DOM manipulation**
- For edge cases where class override isn't sufficient
- Use `MutationObserver` if needed for dynamic content

---

## 10. Implementation Checklist

- [ ] Create `rustic_pos` app with `bench new-app`
- [ ] Add fixtures for custom fields on POS Profile
- [ ] Configure `page_js` hook in `hooks.py`
- [ ] Override `ItemDetails` class:
  - [ ] Hide warehouse control when disabled
  - [ ] Hide discount control when disabled
  - [ ] Implement UOM toggle buttons when enabled + multiple UOMs
  - [ ] Show read-only UOM text when disabled
- [ ] Override `ItemCart` class:
  - [ ] Remove cart-level discount when disabled
- [ ] Test all combinations of settings
- [ ] Build and deploy

---

## References

- [ERPNext v15 POS Source](https://github.com/frappe/erpnext/tree/version-15/erpnext/selling/page/point_of_sale)
- [Frappe Hooks Documentation](https://docs.frappe.io/framework/v15/user/en/python-api/hooks)
- [Extending POS Controller Discussion](https://discuss.frappe.io/t/extending-point-of-sale-in-erpnext-using-pos-controller/101521)
- [Fixtures and Custom Fields](https://codewithkarani.com/2021/09/06/fixtures-and-custom-fields-in-and-frappe-erpnext/)

---

**Document Status:** Ready for Review
**Next Step:** Await approval before proceeding with implementation
