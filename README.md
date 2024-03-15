# Memory Inspector

A Visual Studio Code extension that provides a powerful and configurable memory viewer that works with debug adapters.

![Screenshot of the Memory Inspector](https://raw.githubusercontent.com/eclipse-cdt-cloud/vscode-memory-inspector/master/media/memory-inspector-screenshot.png)

## Features

- **Multiple Format Display**: Shows memory data in different formats, provided your debug adapter supports the `ReadMemoryRequest`.
- **Address Navigation**: Easily jump to and scroll through memory addresses.
- **Variable Highlights**: Marks variable memory ranges.
- **Edit Memory**: Allows in-place memory editing, if the debug adapter supports the `WriteMemoryRequest`.
- **Memory Management**: Enables saving and restoring memory data for specific address ranges.
- **Custom Views**: Create and customize as many memory views as you need.
- **Lock Views**: Keep views static, unaffected by updates from the debug session.
- And much more

## Getting Started

1. **Install**: Add the extension to VS Code.
2. **Debug Session**: Start with a debug adapter that has the [`ReadMemory` request](https://microsoft.github.io/debug-adapter-protocol/specification#Requests_ReadMemory) capability.
3. **Open Memory Inspector**: Either run the *Memory: Show Memory Inspector* command or right-click a variable in the Variables view and select *Show in Memory Inspector*.
4. **Adjust View**: Modify the memory range you're interested in, as needed.

## Configuration

Use the gear symbol in each memory view to customize the individual settings like columns, grouping, and formats.
Default settings can be adjusted in the VS Code settings of this extension.

## Contributing

We welcome contributions on [GitHub](https://github.com/eclipse-cdt-cloud/vscode-memory-inspector).
Check our [contribution guidelines](./CONTRIBUTING.md) for more info.
This open-source project is part of [Eclipse CDT Cloud](https://eclipse.dev/cdt-cloud/).

## Behind the Scenes

### The Memory Provider

The primary entry point for the backend functionality of the plugin is the the [`MemoryProvider`](./src/plugin/memory-provider.ts) class. That class
has two primary functions: it handles requests that are specified by the [Debug Adapter Protocol](https://microsoft.github.io/debug-adapter-protocol/),
and it instantiates custom handlers that can provide additional functionality depending on the capabilities of a given debug adapter. In order to
register custom capabilities, the [`AdapterRegistry`](./src/plugin/adapter-registry/adapter-registry.ts) matches debug types to objects implementing
the [`AdapterCapabilities`](./src/plugin/adapter-registry/adapter-capabilities.ts) interface.

### Memory Widget

The [`MemoryWidget`](./src/webview/components/memory-widget.tsx) is a wrapper around two functional widgets, a `MemoryOptionsWidget` and a`MemoryTableWidget`.
The [`OptionsWidget`](./src/webview/components/options-widget.tsx) is responsible for configuring the display and fetching memory, and the
[`MemoryTable`](./src/webview/components/memory-table.tsx) renders the memory according to the options specified by the user in the options.
