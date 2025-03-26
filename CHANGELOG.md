# Change Log

## 1.2.0
- Fixed [#112](https://github.com/eclipse-cdt-cloud/vscode-memory-inspector/issues/112): Edit memory value can cause "line break" in row for "autofit" groups per row. ([Martin Fleck](https://github.com/martin-fleck-at))
- Fixed [#120](https://github.com/eclipse-cdt-cloud/vscode-memory-inspector/issues/120): Variable tracker evaluates variables using `evaluateName` if present. ([Hampus Adolfsson](https://github.com/HampusAdolfsson))
- Fixed [#126](https://github.com/eclipse-cdt-cloud/vscode-memory-inspector/issues/126): Memory Inspector issues memory request if address field is empty. ([Tobias Ortmayr](https://github.com/tortmayr))
- Fixed [#134](https://github.com/eclipse-cdt-cloud/vscode-memory-inspector/issues/134): "Load \<n\> more bytes above/below" button should be only sensitive to mouse hovering over the text. ([Colin Grant](https://github.com/colin-grant-work))
- Fixed [#145](https://github.com/eclipse-cdt-cloud/vscode-memory-inspector/issues/145): Form validated before initial values loaded. This caused undesired, temporary error messages below `Address` and `Count` fields of the Memory Inspector. ([Colin Grant](https://github.com/colin-grant-work))
- Fixed [#150](https://github.com/eclipse-cdt-cloud/vscode-memory-inspector/issues/150): Switched preferred extension host to `workspace` to enable WSL support. ([Rob Moran](https://github.com/thegecko)).
- Fixed a number of error messages to the Developer Tools console. ([Colin Grant](https://github.com/colin-grant-work))
- Added functionality to follow pointer variables. ([Gabriel Bodeen](https://github.com/gbodeen))
- Added functionality to automatically refresh the Memory Inspector window on specific triggers and/or periodically. ([Martin Fleck](https://github.com/martin-fleck-at))
- Added more details to the context data for the Memory Inspector context menu. ([Philip Langer](https://github.com/planger))
- Added support for switching Memory Inspector contents between active debug sessions. ([Rob Moran](https://github.com/thegecko))
- Improved keyboard navigation in Memory Inspector window. ([Martin Fleck](https://github.com/martin-fleck-at))
- Improved `AdapterCapabilities` to allow provision of customized default settings through the extension API. ([Philip Langer](https://github.com/planger))
- Improved gap between memory value groups for better readability and interaction. ([Colin Grant](https://github.com/colin-grant-work))
- Improved styling and context menu entry appearance. ([Philip Langer](https://github.com/planger))
- Improved some descriptions and display strings. ([Philip Langer](https://github.com/planger))
- Removed preview status of extension. ([Philip Langer](https://github.com/planger))

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
