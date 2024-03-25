# Change Log

## 1.1.0
- Fixed variable fetch before variables are available.
- Fixed variable decoration display if it starts before the loaded memory range.
- Fixed `Memory: Show Memory Inspector` command to open a new Memory Inspector window instance instead of the `Output` channel.
- Enabled reload of variables for variable decoration on successful `scopes` response of the Microsoft Debug Adapter Protocol (DAP).
- Changed Memory Inspector `Output` channel to only show on first log message.
- Changed usage of `Word` to `MAU (Minimum Addressable Unit)` to honor the different meaning of `Word` in different memory architectures.
- Changed `Infinite` scrolling option to `Grow` to remove confusion about its meaning.
- Changed GUI framework library to [Primereact](https://primereact.org/).
- Added Memory Inspector **window instance renaming**.
- Added Memory Inspector **table column resizing**.
- Added hover-over tooltip **display of common data representations**.
- Added **window-specific display options** which use the global display options as default.
- Added `Auto-Append` scroll option to automatically append more data when reaching the bottom of the loaded window content.
- Added `Bytes per MAU` option to specify the number of bytes in a minimum addressable memory unit.
- Added `Autofit` selection to `Groups per Row` option to calculate best usage of the `Data` column.
- Added `Group Endianess` option which applies to display and editing of `Groups`.
- Added **configurability of address value display** (format, prefix, and padding with zeros for a uniform display).
- Added **editing memory contents** on `Group` level.
- Added **storing and applying memory contents** to/from local files in the Intel HEX file format.
- **Reworked context menu** to remove standard entries and added quick access to view specific options.

## 1.0.1
- Initial preview release
