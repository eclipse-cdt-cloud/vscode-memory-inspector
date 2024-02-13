# Memory Inspector

This extension contributes a set of widgets for viewing memory in different ways.

## Requirements

This extension must be used in conjunction with a Debug Adapter that implements a ReadMemoryRequest handler or alternative custom request that returns
memory data. It has been tested against the [CDT-GDB Adapter](https://github.com/eclipse-cdt/cdt-gdb-adapter) used as the backend for the 
[CDT-GDB VSCode](https://github.com/eclipse-cdt/cdt-gdb-vscode) plugin.

## The Memory Provider

The primary entry point for the backend functionality of the plugin is the the [`MemoryProvider`](./src/plugin/memory-provider.ts) class. That class
has two primary functions: it handles requests that are specified by the [Debug Adapter Protocol](https://microsoft.github.io/debug-adapter-protocol/),
and it instantiates custom handlers that can provide additional functionality depending on the capabilities of a given debug adapter. In order to
register custom capabilities, the [`AdapterRegistry`](./src/plugin/adapter-registry/adapter-registry.ts) matches debug types to objects implementing
the [`AdapterCapabilities`](./src/plugin/adapter-registry/adapter-capabilities.ts) interface.

## The Widgets

### Memory Widget

The basic [`MemoryWidget` class](./src/webview/components/memory-widget.ts) is a wrapper around two functional widgets, a `MemoryOptionsWidget` and
a`MemoryTableWidget`. The [`MemoryOptionsWidget`](./src/webview/components/options-widget.tsx) is responsible for configuring the display
and fetching memory, and the [`MemoryTableWidget`](./src/webview/components/table.tsx) renders the memory according to the options
specified by the user in the `MemoryOptionsWidget`. The basic combination of these three classes offers variable highlighting, ascii display, and
dynamic updating in response to events from the debug session, as well as the option to lock the view to ignore changes from the session.
