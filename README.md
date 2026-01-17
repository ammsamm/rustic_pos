# Rustic POS

POS customizations for ERPNext v15.

## Features

- **Configurable Warehouse Selector**: Show/hide warehouse change option in POS
- **Configurable Discount Controls**: Show/hide discount inputs in POS
- **Configurable UOM Change**: Show/hide UOM selector in POS
- **UOM Toggle Buttons**: Quick-switch between UOMs for items with multiple units

## Installation

```bash
bench get-app https://github.com/ammsamm/rustic_pos.git
bench --site your-site install-app rustic_pos
bench --site your-site migrate
bench build
bench restart
```

## Configuration

After installation, go to **POS Profile** and configure:

- `Allow Warehouse Change` - Enable/disable warehouse selector
- `Allow Discount Change` - Enable/disable discount inputs
- `Allow UOM Change` - Enable/disable UOM selector (shows toggle buttons when enabled)

## License

MIT
